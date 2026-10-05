import { sanitizeError } from './dev/dev-console.js';
import { beginLoading, failLoading } from './state.js';

/** Creates the asynchronous risk and decision actions for the application controller. */
export function createAnalysisActions({
  store,
  getProvider,
  operationGuard,
  commitDecisionPackage,
  render,
  showLoading,
  showToast,
  navigate,
} = {}) {
  const { beginAction, isCurrentAction, finishAction, hasActiveAction } = operationGuard;

  async function runRisk(config = {}) {
    const activeProvider = getProvider();
    if (!activeProvider) return;
    config = { ...(store.getState().ui.risk_config || {}), ...config };
    const current = store.getState();
    const companyId = current.context.company_id;
    const selectedScenario = current.data.selected_scenario;
    const deterministicResult = current.data.scenario_result;
    if (!selectedScenario || !deterministicResult) {
      showToast('Simule um cenário antes de calcular risco.', 'error');
      return;
    }
    const action = beginAction('risk', activeProvider, companyId);
    if (!action) return;
    store.update((state) => {
      beginLoading(state, 'Calculando risco e sensibilidade…');
    });
    showLoading(true, 'Calculando risco', 'Monte Carlo, stress e sensibilidade.');
    try {
      const risk = await activeProvider.runRiskSuite({
        selectedScenario,
        deterministicResult,
        config,
      });
      if (!isCurrentAction(action)) return;
      store.update((state) => {
        state.data.monte_carlo = risk?.monte_carlo || null;
        state.data.stress = risk?.stress || null;
        state.data.sensitivity = risk?.sensitivity || null;
        state.data.sensitivity_matrix = risk?.sensitivity_matrix || null;
        state.data.robustness = risk?.robustness || null;
        state.ui.risk_config = structuredClone(config);
        state.data.recommendation = null;
        state.data.audit = null;
        state.data.final_qa = null;
        state.data.release = null;
        state.data.export_package = null;
        state.meta.status = 'risk_ready';
        state.ui.loading = false;
      });
      showLoading(false);
      showToast('Análise de risco concluída pelo provider ativo.', 'success');
      navigate('#/network/scenarios/risk');
    } catch (error) {
      if (!isCurrentAction(action)) return;
      store.update((state) => failLoading(state, error));
      showLoading(false);
      showToast(sanitizeError(error).message, 'error');
    } finally {
      finishAction(action);
    }
    if (isCurrentAction(action) || !hasActiveAction()) render();
  }

  async function runDecision(options = {}) {
    const activeProvider = getProvider();
    if (!activeProvider) return;
    const companyId = store.getState().context.company_id;
    const action = beginAction('decision', activeProvider, companyId);
    if (!action) return;
    store.update((state) => {
      if (options.profileId) {
        state.ui.optimizer_config = {
          profile_id: options.profileId,
          tax_year: options.taxYear,
          max_candidates: options.optimizerConfig?.max_candidates,
          seed: options.optimizerConfig?.seed,
          constraints: structuredClone(options.constraints || {}),
          risk_config: structuredClone(options.riskConfig || {}),
        };
      }
      beginLoading(state, 'Executando pipeline de decisão…');
    });
    showLoading(true, 'Executando decisão', 'Optimizer, risco, Evidence, QA e release.');
    try {
      const packageResult = await activeProvider.buildDecisionPackage(options);
      if (
        !isCurrentAction(action) ||
        (packageResult?.company_id && packageResult.company_id !== companyId)
      ) {
        return;
      }
      store.update((state) => {
        commitDecisionPackage(state, packageResult, activeProvider);
        state.data.analysis_runs ||= { simulation: null, optimization: null };
        state.data.analysis_runs.optimization = {
          run_id: packageResult?.run_id || `${Date.now()}`,
          package: packageResult,
          completed_at: new Date().toISOString(),
        };
        if (options.riskConfig) state.ui.risk_config = structuredClone(options.riskConfig);
      });
      showLoading(false);
      showToast('Pipeline de decisão concluído.', 'success');
      navigate(options.profileId ? '#/network/optimizer/results' : '#/network/trust/validation');
    } catch (error) {
      if (!isCurrentAction(action)) return;
      store.update((state) => failLoading(state, error));
      showLoading(false);
      showToast(sanitizeError(error).message, 'error');
    } finally {
      finishAction(action);
    }
    if (isCurrentAction(action) || !hasActiveAction()) render();
  }

  return { runRisk, runDecision };
}
