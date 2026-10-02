import { navigate } from './router.js';
import { showLoading, showToast } from './shell.js';
import { escapeHtml } from './view-helpers.js';
import { saveOptimizationPreset } from '../core/optimization-config-store.js';
import {
  parseOptimizerForm,
  parseRiskForm,
  parseScenarioForm,
  validateOptimizerValues,
  validateRiskValues,
  validateScenarioValues,
} from './form-values.js';

const PRESET_SETTINGS = {
  balanced: {
    max_candidates: 2000,
    risk_iterations: 300,
    risk_profile: 'balanced',
    max_risk_level: 'high',
  },
  cfo: {
    max_candidates: 3000,
    risk_iterations: 400,
    risk_profile: 'balanced',
    max_risk_level: 'high',
  },
  supply: {
    max_candidates: 3000,
    risk_iterations: 600,
    risk_profile: 'conservative',
    max_risk_level: 'medium',
  },
  fiscal: {
    max_candidates: 5000,
    risk_iterations: 600,
    risk_profile: 'broad',
    max_risk_level: 'high',
    risk_scatter_driver: 'tax_multiplier',
  },
  conservative: {
    max_candidates: 5000,
    risk_iterations: 1000,
    risk_profile: 'conservative',
    max_risk_level: 'medium',
  },
};

function applyOptimizerSettings(form, settings) {
  if (!form || !settings) return;
  const fields = {
    max_candidates: settings.max_candidates,
    risk_iterations: settings.risk_iterations,
    risk_profile: settings.risk_profile,
    risk_scatter_driver: settings.risk_scatter_driver,
    max_risk_level: settings.max_risk_level,
  };
  for (const [name, value] of Object.entries(fields)) {
    if (value == null) continue;
    const field = form.elements.namedItem(name);
    if (field && [...(field.options || [])].some((option) => option.value === String(value))) {
      field.value = String(value);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (field && !field.options) {
      field.value = String(value);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

export function installBindings({ root, store, controller }) {
  const onClick = (event) => {
    const routeLink = event.target.closest('[data-route]');
    if (routeLink) {
      event.preventDefault();
      navigate(routeLink.getAttribute('data-route'));
      return;
    }
    const mapState = event.target.closest('[data-uf]');
    if (mapState) {
      controller.openDrawer(
        `Estado ${escapeHtml(mapState.dataset.uf || '—')}`,
        `<p>${escapeHtml(mapState.getAttribute('aria-label') || 'Detalhes do estado indisponíveis.')}</p>`
      );
      return;
    }
    const action = event.target.closest('[data-action]')?.getAttribute('data-action');
    if (action === 'skip-to-content') {
      event.preventDefault();
      root.querySelector('#networkPage')?.focus();
    } else if (action === 'open-dev') {
      navigate('#/network/dev/console');
    } else if (action === 'open-help') {
      controller.openDrawer(
        'Ajuda',
        '<ol class="ni-list"><li>Veja a operação atual em Visão geral.</li><li>Escolha um cenário no cabeçalho e ajuste seus parâmetros em Simulação.</li><li>Use Otimização para buscar alternativas.</li><li>Compare custos e risco em Resultados.</li></ol><p>Dados e metodologia reúne fontes, premissas e validações.</p>'
      );
    } else if (action === 'open-export') {
      controller.exportPackage();
    } else if (action === 'close-drawer') {
      controller.closeDrawer();
    } else if (action === 'retry-company') {
      controller.retryCompany();
    } else if (action === 'lock-crypto') {
      controller.lock();
    } else if (action === 'run-decision') {
      void controller.runDecision();
    } else if (action === 'run-decision-manual') {
      const manualScenarioId =
        root.querySelector('#niManualScenarioId')?.value.trim() ||
        root.querySelector('#niManualScenarioSelect')?.value ||
        null;
      void controller.runDecision({
        selectionMode: 'manual',
        manualScenarioId,
      });
    } else if (action === 'select-compared-scenario') {
      const scenarioId = event.target.closest('[data-scenario-id]')?.dataset.scenarioId;
      if (scenarioId) void controller.selectComparedScenario(scenarioId);
    } else if (action === 'run-risk') {
      void controller.runRisk();
    } else if (action === 'download-export') {
      const index = Number(event.target.closest('[data-export-index]')?.dataset.exportIndex);
      controller.exportPackage(index);
    } else if (action === 'load-scenario') {
      controller.loadScenarioDraft(event.target.closest('[data-scenario-id]')?.dataset.scenarioId);
    } else if (action === 'save-current-scenario') {
      controller.saveCurrentScenario();
    } else if (action === 'export-current-scenario') {
      controller.exportCurrentScenario();
    } else if (action === 'delete-saved-scenario') {
      controller.deleteSavedScenario(
        event.target.closest('[data-scenario-id]')?.dataset.scenarioId
      );
    } else if (action === 'clear-saved-scenarios') {
      controller.clearSavedScenarios();
    } else if (action === 'import-scenario') {
      root.querySelector('[data-testid="scenario-import"]')?.click();
    } else if (action === 'reset-scenario-draft') {
      controller.resetScenarioDraft();
    } else if (action === 'open-optimizer-preset-save') {
      const editor = root.querySelector('#optimizerPresetEditor');
      const isOpening = editor?.hidden;
      if (editor) editor.hidden = !isOpening;
      event.target
        .closest('[data-action]')
        ?.setAttribute('aria-expanded', String(Boolean(isOpening)));
      if (isOpening) editor?.querySelector('input[name="custom_preset_name"]')?.focus();
    } else if (action === 'cancel-optimizer-preset-save') {
      const editor = root.querySelector('#optimizerPresetEditor');
      if (editor) editor.hidden = true;
      root
        .querySelector('[data-action="open-optimizer-preset-save"]')
        ?.setAttribute('aria-expanded', 'false');
      const nameInput = root.querySelector('#niOptimizerForm [name="custom_preset_name"]');
      if (nameInput) nameInput.value = '';
    } else if (action === 'save-optimizer-preset') {
      const form = root.querySelector('#niOptimizerForm');
      const name = form?.elements.namedItem('custom_preset_name')?.value.trim();
      if (!name) {
        showToast(root, 'Dê um nome para salvar o preset.', 'error');
        return;
      }
      const values = parseOptimizerForm(new FormData(form), rawInputValues.get(form) || {});
      const preset = saveOptimizationPreset(store.getState().context.company_id, {
        name,
        profile_id: values.profile_id,
        configuration: values,
      });
      if (!preset) {
        showToast(root, 'Não foi possível salvar o preset nesta sessão.', 'error');
        return;
      }
      const state = store.getState();
      state.ui.optimizer_presets = [...(state.ui.optimizer_presets || []), preset];
      const select = form.elements.namedItem('custom_preset_select');
      const option = document.createElement('option');
      option.value = preset.preset_id;
      option.textContent = preset.name;
      select?.append(option);
      if (select) {
        select.disabled = false;
        select.value = preset.preset_id;
      }
      form.elements.namedItem('custom_preset_name').value = '';
      const editor = root.querySelector('#optimizerPresetEditor');
      if (editor) editor.hidden = true;
      root
        .querySelector('[data-action="open-optimizer-preset-save"]')
        ?.setAttribute('aria-expanded', 'false');
      showToast(root, `Preset salvo: ${name}.`, 'success');
    }
  };

  root.addEventListener('click', onClick);
  root.querySelector('#niCompanySelect')?.addEventListener('change', (event) => {
    void controller.switchCompany(event.target.value);
  });
  root.querySelector('#niScenarioSelect')?.addEventListener('change', (event) => {
    if (store.getState().ui.loading) return;
    controller.loadScenarioDraft(event.target.value || null);
  });
  root.addEventListener('change', (event) => {
    if (event.target.id !== 'niScenarioLibrarySelect' || store.getState().ui.loading) return;
    controller.loadScenarioDraft(event.target.value || null);
  });
  root.addEventListener('submit', (event) => {
    if (event.target.id === 'niScenarioForm') {
      event.preventDefault();
      const values = parseScenarioForm(
        new FormData(event.target),
        event.target.querySelectorAll('input[name="active_cds"]:checked'),
        rawInputValues.get(event.target)
      );
      const validation = validateScenarioValues(values);
      if (!validation.valid) {
        showToast(root, validation.message, 'error');
        return;
      }
      void controller.runScenario({ formValues: values });
    }
    if (event.target.id === 'niOptimizerForm') {
      event.preventDefault();
      const data = new FormData(event.target);
      const rawValues = rawInputValues.get(event.target) || {};
      const values = parseOptimizerForm(data, rawValues);
      const validation = validateOptimizerValues(values);
      if (!validation.valid) {
        showToast(root, validation.message, 'error');
        return;
      }
      void controller.runDecision({
        profileId: values.profile_id,
        taxYear: values.tax_year,
        optimizerConfig: {
          max_candidates: values.max_candidates,
          seed: values.seed,
        },
        constraints: values.constraints,
        riskConfig: values.risk_config,
      });
    }
    if (event.target.id === 'niRiskForm') {
      event.preventDefault();
      const data = new FormData(event.target);
      const values = parseRiskForm(data, rawInputValues.get(event.target) || {});
      const validation = validateRiskValues(values);
      if (!validation.valid) {
        showToast(root, validation.message, 'error');
        return;
      }
      void controller.runRisk(values);
    }
  });
  root.addEventListener('change', (event) => {
    if (event.target.matches('input[name="profile_id"]')) {
      applyOptimizerSettings(
        root.querySelector('#niOptimizerForm'),
        PRESET_SETTINGS[event.target.value]
      );
      return;
    }
    if (event.target.matches('select[name="custom_preset_select"]')) {
      const preset = (store.getState().ui.optimizer_presets || []).find(
        (item) => item.preset_id === event.target.value
      );
      const form = root.querySelector('#niOptimizerForm');
      if (preset?.configuration && form) {
        const profile = [...form.querySelectorAll('input[name="profile_id"]')].find(
          (input) => input.value === preset.configuration.profile_id
        );
        if (profile) profile.checked = true;
        const settings = preset.configuration;
        const mapped = {
          max_candidates: settings.max_candidates,
          seed: settings.seed,
          min_active_cds: settings.constraints?.min_active_cds,
          max_active_cds: settings.constraints?.max_active_cds,
          max_cd_volume_share: settings.constraints?.max_cd_volume_share,
          max_risk_level: settings.constraints?.max_risk_level,
          risk_iterations: settings.risk_config?.iterations,
          risk_seed: settings.risk_config?.seed,
          risk_profile: settings.risk_config?.profile,
          risk_scatter_driver: settings.risk_config?.scatter_driver,
          stress_profile: settings.risk_config?.stress_profile,
          sensitivity_variable: settings.risk_config?.sensitivity_variable,
          sensitivity_x: settings.risk_config?.sensitivity_x,
          sensitivity_y: settings.risk_config?.sensitivity_y,
          tax_year: settings.tax_year,
        };
        for (const [name, value] of Object.entries(mapped)) {
          const control = form.elements.namedItem(name);
          if (control && value != null) control.value = String(value);
          control?.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      return;
    }
    if (!event.target.matches('[data-testid="scenario-import"]')) return;
    const file = event.target.files?.[0];
    if (file) void controller.importScenario(file);
    event.target.value = '';
  });
  const rawInputValues = new WeakMap();
  root.addEventListener('input', (event) => {
    const form = event.target.form;
    if (!form || !['niScenarioForm', 'niOptimizerForm', 'niRiskForm'].includes(form.id)) return;
    if (event.target.name === 'custom_preset_name') return;
    const current = rawInputValues.get(form) || {};
    current[event.target.name] = event.target.value;
    rawInputValues.set(form, current);
    const data = new FormData(form);
    const values =
      form.id === 'niScenarioForm'
        ? parseScenarioForm(
            data,
            form.querySelectorAll('input[name="active_cds"]:checked'),
            current
          )
        : form.id === 'niOptimizerForm'
          ? parseOptimizerForm(data, current)
          : parseRiskForm(data, current);
    controller.captureDraft(form.id, values);
  });
  const onKeyDown = (event) => {
    const drawer = root.querySelector('#networkDrawer');
    if (event.key === 'Escape' && drawer && !drawer.hidden) {
      controller.closeDrawer();
      return;
    }
    if (event.key !== 'Tab' || !drawer || drawer.hidden) return;
    const focusable = [
      ...drawer.querySelectorAll('button, [href], input, select, textarea'),
    ].filter((element) => {
      if (element.disabled || element.hidden || element.getAttribute('aria-hidden') === 'true') {
        return false;
      }
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeIndex = focusable.indexOf(document.activeElement);
    if (activeIndex === -1) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', onKeyDown);
  return () => {
    root.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKeyDown);
  };
}

export function showControllerError(root, error) {
  showLoading(root, false);
  showToast(root, error?.message || String(error), 'error');
}
