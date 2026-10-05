import { sanitizeError } from './dev/dev-console.js';
import { buildScenarioFromForm } from '../phase3/scenario-builder.js';
import { navigate } from './router.js';
import { showLoading, showToast } from './shell.js';
import { beginLoading, clearScenarioResults, failLoading } from './state.js';
import {
  clearCompanyScenarios,
  deleteScenario,
  loadSavedScenarios,
  saveScenario,
} from '../phase3/scenario-persistence.js';
import {
  downloadScenarioJson,
  parseImportedScenario,
  validateImportedScenario,
} from '../phase3/scenario-import-export.js';

function findScenario(state, scenarioId) {
  return [
    state.data.selected_scenario,
    ...(state.data.scenarios || []),
    ...(state.data.saved_scenarios || []),
    ...(state.data.optimizer?.scored_scenarios || []),
    ...(state.data.optimizer?.best_scenarios || []),
  ].find((scenario) => scenario?.scenario_id === scenarioId);
}

function upsertScenario(scenarios, scenario) {
  return [
    ...(scenarios || []).filter((item) => item.scenario_id !== scenario.scenario_id),
    scenario,
  ];
}

/** Builds scenario actions while keeping their UI, state, provider, and operation guard explicit. */
export function createScenarioActions({ root, store, getProvider, operationGuard, render } = {}) {
  const {
    currentToken,
    isCurrentOperation,
    beginAction,
    isCurrentAction,
    finishAction,
    hasActiveAction,
  } = operationGuard;
  let lastScenarioExportAt = 0;

  function loadScenarioDraft(scenarioId) {
    const state = store.getState();
    const scenario = findScenario(state, scenarioId);
    if (!scenario) {
      showToast(root, 'Cenário não encontrado na biblioteca ativa.', 'error');
      return;
    }
    store.update((nextState) => {
      nextState.ui.scenario_draft = scenario;
      nextState.ui.scenario_draft_dirty = true;
      nextState.context.selected_scenario_id = scenario.scenario_id;
      clearScenarioResults(nextState);
    });
    navigate('#/network/scenarios/build');
    showToast(
      root,
      `Cenário carregado: ${scenario.scenario_name || scenario.scenario_id}.`,
      'success'
    );
  }

  function selectScenarioTaxYear(yearValue) {
    const year = Number(yearValue);
    const state = store.getState();
    const provider = getProvider();
    const baselineBundle = provider?.getDomainContext?.()?.baselineBundle;
    if (!Number.isInteger(year) || year < 2026 || year > 2033 || !baselineBundle) {
      showToast(root, 'Ano fiscal indisponível para o provider ativo.', 'error');
      return;
    }
    const prior = state.ui.scenario_draft || state.data.selected_scenario || {};
    const scenario = buildScenarioFromForm({
      companyId: state.context.company_id,
      baselineBundle,
      scenarioId: prior.scenario_id || null,
      formValues: {
        ...(prior.changes || {}),
        tax_year: year,
        scenario_name: prior.scenario_name || `Cenário fiscal ${year}`,
      },
    });
    store.update((nextState) => {
      nextState.ui.scenario_draft = scenario;
      nextState.ui.scenario_draft_dirty = true;
      nextState.context.selected_scenario_id = scenario.scenario_id;
      clearScenarioResults(nextState);
    });
    render();
    showToast(root, `Rascunho fiscal ${year} atualizado.`, 'success');
  }

  function resetScenarioDraft() {
    store.update((nextState) => {
      nextState.ui.scenario_draft = null;
      nextState.ui.scenario_draft_dirty = false;
      nextState.context.selected_scenario_id = null;
      clearScenarioResults(nextState);
    });
    navigate('#/network/scenarios/build');
    showToast(root, 'Rascunho limpo; formulário voltou ao baseline.', 'success');
  }

  function selectComparedScenario(scenarioId) {
    const state = store.getState();
    const candidate = findScenario(state, scenarioId);
    if (!candidate) {
      showToast(root, 'Cenário comparado não está disponível para reexecução.', 'error');
      return;
    }
    void runScenario({ scenario: candidate.scenario || candidate, scenarioId });
  }

  function saveCurrentScenario() {
    const state = store.getState();
    const scenario = state.data.selected_scenario;
    if (!scenario || !state.data.scenario_result) {
      showToast(root, 'Simule um cenário antes de salvar.', 'error');
      return;
    }
    const result = saveScenario(state.context.company_id, scenario);
    if (!result.saved) {
      showToast(root, 'Persistência local indisponível.', 'error');
      return;
    }
    const saved = loadSavedScenarios(state.context.company_id);
    store.update((nextState) => {
      nextState.data.saved_scenarios = saved;
      nextState.data.scenarios = upsertScenario(nextState.data.scenarios, scenario);
    });
    showToast(root, `Cenário salvo: ${scenario.scenario_name || scenario.scenario_id}.`, 'success');
  }

  function exportCurrentScenario() {
    const now = Date.now();
    if (now - lastScenarioExportAt < 600) return;
    lastScenarioExportAt = now;
    const scenario = store.getState().data.selected_scenario;
    if (!scenario) {
      showToast(root, 'Simule um cenário antes de exportar.', 'error');
      return;
    }
    try {
      downloadScenarioJson(scenario);
      showToast(root, `Cenário exportado: ${scenario.scenario_id}.`, 'success');
    } catch (error) {
      showToast(root, sanitizeError(error).message, 'error');
    }
  }

  function deleteSavedScenario(scenarioId) {
    const state = store.getState();
    const result = deleteScenario(state.context.company_id, scenarioId);
    if (!result.deleted) {
      showToast(root, 'Não foi possível excluir o cenário salvo.', 'error');
      return;
    }
    store.update((nextState) => {
      nextState.data.saved_scenarios = loadSavedScenarios(nextState.context.company_id);
      nextState.data.scenarios = (nextState.data.scenarios || []).filter(
        (scenario) => scenario.scenario_id !== scenarioId
      );
      if (nextState.ui.scenario_draft?.scenario_id === scenarioId) {
        nextState.ui.scenario_draft = null;
        nextState.context.selected_scenario_id = null;
      }
    });
    showToast(root, 'Cenário salvo excluído.', 'success');
  }

  function clearSavedScenarios() {
    const state = store.getState();
    const savedIds = new Set((state.data.saved_scenarios || []).map((item) => item.scenario_id));
    const result = clearCompanyScenarios(state.context.company_id);
    if (!result.cleared) {
      showToast(root, 'Não foi possível limpar os cenários salvos.', 'error');
      return;
    }
    store.update((nextState) => {
      nextState.data.saved_scenarios = [];
      nextState.data.scenarios = (nextState.data.scenarios || []).filter(
        (scenario) => !savedIds.has(scenario.scenario_id)
      );
    });
    showToast(root, 'Cenários salvos limpos para esta empresa.', 'success');
  }

  async function importScenario(file) {
    const state = store.getState();
    const companyId = state.context.company_id;
    const activeProvider = getProvider();
    const token = currentToken();
    try {
      const scenario = await parseImportedScenario(file);
      if (!isCurrentOperation(token, companyId, activeProvider)) return;
      const validation = validateImportedScenario(companyId, scenario);
      if (!validation.valid) throw new Error(validation.error);
      const result = saveScenario(companyId, scenario);
      if (!result.saved) throw new Error('Persistência local indisponível.');
      if (!isCurrentOperation(token, companyId, activeProvider)) return;
      const saved = loadSavedScenarios(companyId);
      store.update((nextState) => {
        nextState.data.saved_scenarios = saved;
        nextState.data.scenarios = upsertScenario(nextState.data.scenarios, scenario);
        nextState.ui.scenario_draft = scenario;
        nextState.context.selected_scenario_id = scenario.scenario_id;
        clearScenarioResults(nextState);
      });
      navigate('#/network/scenarios/build');
      showToast(
        root,
        `Cenário importado: ${scenario.scenario_name || scenario.scenario_id}.`,
        'success'
      );
    } catch (error) {
      if (!isCurrentOperation(token, companyId, activeProvider)) return;
      showToast(root, sanitizeError(error).message, 'error');
    }
  }

  async function runScenario({
    formValues = {},
    scenarioId = null,
    scenario: inputScenario = null,
  } = {}) {
    const activeProvider = getProvider();
    if (!activeProvider) return;
    const companyId = store.getState().context.company_id;
    const action = beginAction('scenario', activeProvider, companyId);
    if (!action) return;
    const currentState = store.getState();
    const effectiveScenarioId =
      scenarioId ||
      inputScenario?.scenario_id ||
      (currentState.context.provider_kind === 'mock'
        ? currentState.ui.scenario_draft?.scenario_id
        : null);
    store.update((state) => {
      beginLoading(state, 'Simulando cenário…');
    });
    showLoading(root, true, 'Simulando cenário', 'Chamando o engine de cenários.');
    try {
      const output = await activeProvider.runScenario({
        formValues,
        scenarioId: effectiveScenarioId,
        scenario: inputScenario,
      });
      if (!isCurrentAction(action) || (output?.company_id && output.company_id !== companyId)) {
        return;
      }
      const scenario = output.scenario || output;
      const result = output.result || null;
      store.update((state) => {
        state.data.selected_scenario = scenario;
        state.data.analysis_runs ||= { simulation: null, optimization: null };
        state.data.analysis_runs.simulation = {
          run_id: result?.run_id || `${Date.now()}`,
          scenario,
          result,
          completed_at: new Date().toISOString(),
        };
        state.data.scenario_result = result;
        state.data.scenario_quality = output.quality || null;
        state.data.comparison = output.comparison || null;
        state.data.monte_carlo = null;
        state.data.stress = null;
        state.data.sensitivity = null;
        state.data.sensitivity_matrix = null;
        state.data.robustness = null;
        state.data.recommendation = null;
        state.meta.status = 'scenario_ready';
        state.meta.result_kind = 'simulation';
        state.ui.loading = false;
        state.context.selected_scenario_id = scenario?.scenario_id || null;
        state.ui.scenario_draft = scenario;
        state.ui.scenario_draft_dirty = false;
        state.data.audit = null;
        state.data.final_qa = null;
        state.data.release = null;
        state.data.export_package = null;
      });
      showLoading(root, false);
      showToast(root, 'Cenário simulado pelo provider ativo.', 'success');
      window.location.hash = '#/network/scenarios/result';
    } catch (error) {
      if (!isCurrentAction(action)) return;
      store.update((state) => failLoading(state, error));
      showLoading(root, false);
      showToast(root, sanitizeError(error).message, 'error');
    } finally {
      finishAction(action);
    }
    if (isCurrentAction(action) || !hasActiveAction()) render();
  }

  return {
    loadScenarioDraft,
    selectScenarioTaxYear,
    resetScenarioDraft,
    selectComparedScenario,
    saveCurrentScenario,
    exportCurrentScenario,
    deleteSavedScenario,
    clearSavedScenarios,
    importScenario,
    runScenario,
  };
}
