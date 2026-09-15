import { navigate } from './router.js';
import { setSelectedScenario } from './state.js';
import { showLoading, showToast } from './shell.js';
import { escapeHtml } from './view-helpers.js';

function formValues(form, rawValues = {}) {
  const data = new FormData(form);
  const read = (name) =>
    Object.prototype.hasOwnProperty.call(rawValues, name) ? rawValues[name] : data.get(name);
  const readNumber = (name, fallback) => {
    const raw = read(name);
    return raw === null || raw === '' ? fallback : Number(raw);
  };
  return {
    scenario_name: read('scenario_name') || 'Cenário manual',
    active_cds: [...form.querySelectorAll('input[name="active_cds"]:checked')].map(
      (input) => input.value
    ),
    freight_multiplier: readNumber('freight_multiplier', 1),
    demand_multiplier: readNumber('demand_multiplier', 1),
    inventory_days: readNumber('inventory_days', 45),
    wacc: readNumber('wacc', 0.15),
    tax_mode: data.get('tax_mode') || 'current',
  };
}

function readFormNumber(data, rawValues, name, fallback) {
  const raw = Object.prototype.hasOwnProperty.call(rawValues, name)
    ? rawValues[name]
    : data.get(name);
  return raw === null || raw === '' ? fallback : Number(raw);
}

function validationError(message) {
  return { valid: false, message };
}

function validateScenarioValues(values) {
  if (!values.scenario_name.trim()) return validationError('Informe um nome para o cenário.');
  if (!values.active_cds.length) return validationError('Selecione ao menos um CD ativo.');
  if (!Number.isFinite(values.freight_multiplier) || values.freight_multiplier < 0.1) {
    return validationError('O multiplicador de frete deve ser maior ou igual a 0,1.');
  }
  if (!Number.isFinite(values.demand_multiplier) || values.demand_multiplier < 0.1) {
    return validationError('O multiplicador de demanda deve ser maior ou igual a 0,1.');
  }
  if (!Number.isFinite(values.inventory_days) || values.inventory_days < 0) {
    return validationError('Dias de estoque não pode ser negativo.');
  }
  if (!Number.isFinite(values.wacc) || values.wacc < 0) {
    return validationError('WACC não pode ser negativo.');
  }
  if (values.tax_mode === 'disabled') {
    return validationError('O modo tributário desligado não é permitido pela política vigente.');
  }
  return { valid: true, message: '' };
}

function validateOptimizerValues(values) {
  const { max_candidates: maxCandidates, seed, constraints = {} } = values;
  if (!Number.isInteger(maxCandidates) || maxCandidates < 100 || maxCandidates > 10000) {
    return validationError('Máximo de candidatos deve ser um inteiro entre 100 e 10.000.');
  }
  if (!Number.isInteger(seed)) return validationError('Seed deve ser um número inteiro.');
  const minCds = constraints.min_active_cds;
  const maxCds = constraints.max_active_cds;
  if (!Number.isInteger(minCds) || minCds < 1) {
    return validationError('CDs mínimos deve ser um inteiro maior ou igual a 1.');
  }
  if (!Number.isInteger(maxCds) || maxCds < minCds) {
    return validationError('CDs máximos deve ser maior ou igual aos CDs mínimos.');
  }
  if (
    !Number.isFinite(constraints.max_cd_volume_share) ||
    constraints.max_cd_volume_share < 0.01 ||
    constraints.max_cd_volume_share > 1
  ) {
    return validationError('A concentração máxima deve estar entre 0,01 e 1.');
  }
  if (!['low', 'medium', 'high'].includes(constraints.max_risk_level)) {
    return validationError('Selecione um nível de risco válido.');
  }
  return { valid: true, message: '' };
}

function validateRiskValues(values) {
  if (!Number.isInteger(values.iterations) || values.iterations < 50 || values.iterations > 5000) {
    return validationError('Iterações devem ser um inteiro entre 50 e 5.000.');
  }
  if (!Number.isInteger(values.seed))
    return validationError('Seed do risco deve ser um número inteiro.');
  if (!['balanced', 'conservative', 'broad'].includes(values.profile)) {
    return validationError('Selecione um perfil de incerteza válido.');
  }
  if (!['standard', 'conservative'].includes(values.stress_profile)) {
    return validationError('Selecione um perfil de stress válido.');
  }
  if (values.sensitivity_x === values.sensitivity_y) {
    return validationError('As variáveis X e Y da matriz precisam ser diferentes.');
  }
  return { valid: true, message: '' };
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
        `<p>${escapeHtml(mapState.getAttribute('aria-label') || 'Detalhes do estado indisponíveis.')}</p><p>O valor exibido segue o recorte e a disponibilidade do provider ativo.</p>`
      );
      return;
    }
    const action = event.target.closest('[data-action]')?.getAttribute('data-action');
    if (action === 'open-dev') {
      navigate('#/network/dev/console');
    } else if (action === 'switch-demo-company') {
      void controller.switchCompany('empresa_mock');
    } else if (action === 'open-help') {
      controller.openDrawer(
        'Ajuda',
        '<p>Use as seções para explorar baseline, cenários, otimização e confiança. Os resultados continuam sendo calculados pelos engines do projeto.</p>'
      );
    } else if (action === 'open-settings') {
      controller.openDrawer(
        'Configurações',
        '<p>As configurações de execução são controladas pelo provider ativo. Para empresas reais, os dados protegidos permanecem isolados e a política fiscal é apresentada sem completar campos ausentes.</p>'
      );
    } else if (action === 'open-styleguide') {
      controller.openDrawer(
        'Style guide',
        '<p>Tokens visuais do workspace: azul petróleo para navegação, verde menta para ações positivas, âmbar para alertas e superfícies claras para evidências.</p><div class="ni-styleguide-swatches"><span class="swatch deep">#062d35</span><span class="swatch mint">#c8f3e0</span><span class="swatch amber">#f2b84b</span></div>'
      );
    } else if (action === 'open-export') {
      controller.exportPackage();
    } else if (action === 'close-drawer') {
      controller.closeDrawer();
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
    } else if (action === 'reset-scenario-draft') {
      controller.resetScenarioDraft();
    }
  };

  root.addEventListener('click', onClick);
  root.querySelector('#niCompanySelect')?.addEventListener('change', (event) => {
    void controller.switchCompany(event.target.value);
  });
  root.querySelector('#niScenarioSelect')?.addEventListener('change', (event) => {
    if (store.getState().ui.loading) return;
    const scenarioId = event.target.value || null;
    store.update((state) => setSelectedScenario(state, scenarioId));
    navigate('#/network/scenarios/result');
    void controller.runScenario({ scenarioId });
  });
  root.addEventListener('submit', (event) => {
    if (event.target.id === 'niScenarioForm') {
      event.preventDefault();
      const values = formValues(event.target, rawInputValues.get(event.target));
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
      const values = {
        max_candidates: readFormNumber(data, rawValues, 'max_candidates', 2000),
        seed: readFormNumber(data, rawValues, 'seed', 42),
        constraints: {
          min_active_cds: readFormNumber(data, rawValues, 'min_active_cds', 1),
          max_active_cds: readFormNumber(data, rawValues, 'max_active_cds', 999),
          max_cd_volume_share: readFormNumber(data, rawValues, 'max_cd_volume_share', 0.75),
          max_risk_level: data.get('max_risk_level') || 'high',
          allow_tax_disabled: false,
        },
      };
      const validation = validateOptimizerValues(values);
      if (!validation.valid) {
        showToast(root, validation.message, 'error');
        return;
      }
      void controller.runDecision({
        profileId: data.get('profile_id') || 'balanced',
        optimizerConfig: {
          max_candidates: values.max_candidates,
          seed: values.seed,
        },
        constraints: values.constraints,
        riskConfig: {
          iterations: readFormNumber(data, rawValues, 'risk_iterations', 300),
          seed: readFormNumber(data, rawValues, 'risk_seed', 42),
          profile: data.get('risk_profile') || 'balanced',
          scatter_driver: data.get('risk_scatter_driver') || 'freight_multiplier',
          stress_profile: data.get('stress_profile') || 'standard',
          sensitivity_variable: data.get('sensitivity_variable') || 'freight_multiplier',
          sensitivity_x: data.get('sensitivity_x') || 'freight_multiplier',
          sensitivity_y: data.get('sensitivity_y') || 'demand_multiplier',
        },
      });
    }
    if (event.target.id === 'niRiskForm') {
      event.preventDefault();
      const data = new FormData(event.target);
      const values = {
        iterations: readFormNumber(data, rawInputValues.get(event.target) || {}, 'iterations', 300),
        seed: readFormNumber(data, rawInputValues.get(event.target) || {}, 'seed', 42),
        profile: data.get('profile') || 'balanced',
        scatter_driver: data.get('scatter_driver') || 'freight_multiplier',
        stress_profile: data.get('stress_profile') || 'standard',
        sensitivity_variable: data.get('sensitivity_variable') || 'freight_multiplier',
        sensitivity_x: data.get('sensitivity_x') || 'freight_multiplier',
        sensitivity_y: data.get('sensitivity_y') || 'demand_multiplier',
      };
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
    if (!form || !['niScenarioForm', 'niOptimizerForm'].includes(form.id)) return;
    if (event.target.type !== 'number' && event.target.name !== 'scenario_name') return;
    const current = rawInputValues.get(form) || {};
    current[event.target.name] = event.target.value;
    rawInputValues.set(form, current);
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
