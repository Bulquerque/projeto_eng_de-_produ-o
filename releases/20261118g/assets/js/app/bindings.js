import { navigate } from './router.js';
import { setSelectedScenario } from './state.js';
import { showLoading, showToast } from './shell.js';
import { escapeHtml } from './view-helpers.js';
import {
  parseOptimizerForm,
  parseRiskForm,
  parseScenarioForm,
  validateOptimizerValues,
  validateRiskValues,
  validateScenarioValues,
} from './form-values.js';

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
        `<p>${escapeHtml(mapState.getAttribute('aria-label') || 'Detalhes do estado indisponíveis.')}</p><p>O valor exibido segue o recorte e a disponibilidade do provider ativo.</p>`
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
        '<p>Use as seções para explorar baseline, cenários, otimização e confiança. Os resultados continuam sendo calculados pelos engines do projeto.</p><div class="ni-actions"><button type="button" class="ni-button secondary" data-action="open-settings">Configurações</button><button type="button" class="ni-button secondary" data-action="open-styleguide">Style guide</button></div>'
      );
    } else if (action === 'open-settings') {
      controller.openDrawer(
        'Configurações',
        '<p>As configurações de execução são controladas pelo provider ativo. Para empresas reais, os dados protegidos permanecem isolados e a política fiscal é apresentada sem completar campos ausentes.</p>'
      );
    } else if (action === 'open-styleguide') {
      controller.openDrawer(
        'Style guide',
        '<p>Tokens visuais do workspace: azul petróleo para navegação, verde menta para ações positivas, âmbar para alertas e superfícies claras para evidências.</p><div class="ni-styleguide-swatches"><span class="swatch deep">#00363d</span><span class="swatch mint">#a9fdac</span><span class="swatch amber">#f2b84b</span></div>'
      );
    } else if (action === 'open-export') {
      controller.exportPackage();
    } else if (action === 'close-drawer') {
      controller.closeDrawer();
    } else if (action === 'lock-crypto') {
      controller.lock();
    } else if (action === 'run-decision') {
      const state = store.getState();
      const selectedId = state.context.selected_scenario_id;
      const ranked = [
        ...(state.data.optimizer?.scored_scenarios || []),
        ...(state.data.optimizer?.best_scenarios || []),
      ].some((candidate) => candidate.scenario_id === selectedId);
      void controller.runDecision(
        ranked
          ? {
              selectionMode: 'manual',
              manualScenarioId: selectedId,
              existingOptimizerResult: state.data.optimizer,
              riskConfig: state.ui.risk_config || {},
            }
          : {}
      );
    } else if (action === 'run-decision-manual') {
      const manualScenarioId =
        root.querySelector('#niManualScenarioId')?.value.trim() ||
        root.querySelector('#niManualScenarioSelect')?.value ||
        null;
      void controller.runDecision({
        selectionMode: 'manual',
        manualScenarioId,
        existingOptimizerResult: store.getState().data.optimizer,
        riskConfig: store.getState().ui.risk_config || {},
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
    } else if (action === 'reset-scenario-draft') {
      controller.resetScenarioDraft();
    }
  };

  root.addEventListener('network-scenario-select', (event) => {
    if (!store.getState().ui.loading && event.detail?.scenarioId) {
      controller.selectComparedScenario(event.detail.scenarioId);
    }
  });
  root.addEventListener('click', onClick);
  root.querySelector('#niCompanySelect')?.addEventListener('change', (event) => {
    void controller.switchCompany(event.target.value);
  });
  root.querySelector('#niScenarioSelect')?.addEventListener('change', (event) => {
    if (store.getState().ui.loading) return;
    const scenarioId = event.target.value || null;
    store.update((state) => setSelectedScenario(state, scenarioId));
    navigate('#/network/scenarios/result');
    if (scenarioId) controller.selectComparedScenario(scenarioId);
    else void controller.runScenario({ scenarioId });
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
    if (!event.target.matches('[data-testid="scenario-import"]')) return;
    const file = event.target.files?.[0];
    if (file) void controller.importScenario(file);
    event.target.value = '';
  });
  const rawInputValues = new WeakMap();
  root.addEventListener('input', (event) => {
    const form = event.target.form;
    if (!form || !['niScenarioForm', 'niOptimizerForm', 'niRiskForm'].includes(form.id)) return;
    if (event.target.type !== 'number' && event.target.name !== 'scenario_name') return;
    const current = rawInputValues.get(form) || {};
    current[event.target.name] = event.target.value;
    rawInputValues.set(form, current);
  });
  const markDraft = (event) => {
    const form = event.target.form;
    if (form?.id !== 'niScenarioForm' || event.target.disabled) return;
    const values = parseScenarioForm(
      new FormData(form),
      form.querySelectorAll('input[name="active_cds"]:checked'),
      rawInputValues.get(form)
    );
    store.update(
      (state) => {
        state.ui.scenario_draft = {
          ...(state.ui.scenario_draft || {}),
          scenario_name: values.scenario_name,
          changes: { ...values },
        };
        state.ui.scenario_draft_dirty = true;
      },
      { notify: false }
    );
    const status = root.querySelector('[data-testid="scenario-draft-status"]');
    if (status) status.textContent = 'Alterações pendentes; execute para atualizar.';
    for (const control of root.querySelectorAll(
      '[data-testid="scenario-save"], [data-testid="scenario-export"]'
    ))
      control.disabled = true;
  };
  root.addEventListener('input', markDraft);
  root.addEventListener('change', markDraft);
  root.addEventListener('change', (event) => {
    if (!event.target.matches('[data-compare-scenario]')) return;
    const checked = [...root.querySelectorAll('[data-compare-scenario]:checked')];
    if (checked.length > 4) {
      event.target.checked = false;
      showToast(root, 'Selecione até quatro cenários para comparar.', 'neutral');
      return;
    }
    store.update((state) => {
      state.ui.compared_scenario_ids = checked.map((input) => input.value);
    });
    const details = root.querySelector('[data-testid="comparison-choice-details"]');
    if (details) details.open = true;
    [...root.querySelectorAll('[data-compare-scenario]')]
      .find((input) => input.value === event.target.value)
      ?.focus({ preventScroll: true });
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
