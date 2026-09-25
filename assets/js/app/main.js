import { buildAppConfig, readRuntimeRequest } from './config.js';
import { getCompanyDefinition, isMockTenant } from './company-registry.js';
import {
  createInitialState,
  createStateStore,
  beginLoading,
  commitProviderSnapshot,
  clearScenarioResults,
  failLoading,
  resetCompanyScopedState,
  setRoute,
  setSelectedScenario,
} from './state.js';
import { navigate, parseRoute, replaceCompanyQuery, startRouter } from './router.js';
import { renderShell, setActiveNav, showLoading, showToast, updateGlobalContext } from './shell.js';
import { installBindings } from './bindings.js';
import { sanitizeError } from './dev/dev-console.js';
import { routeFallback } from './view-helpers.js';
import { ROUTE_RENDERERS } from './route-renderers.js';
import {
  renderDistanceHistogram,
  renderCostChart,
  renderRanking,
  renderRiskCdf,
  renderRiskDrivers,
  renderRiskHistogram,
  renderRiskProbability,
  renderRiskChart,
  renderRiskScatter,
  renderRiskTotalCurve,
  renderSensitivity,
  renderVolumeByCdChart,
} from './charts/charts.js';
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

const request = readRuntimeRequest();
const networkActive = request.network_ui || window.location.hash.startsWith('#/network/');
window.__VISAGIO_NETWORK_UI__ = networkActive;

function findScenario(state, scenarioId) {
  return [
    ...(state.data.scenarios || []),
    ...(state.data.saved_scenarios || []),
    ...(state.data.optimizer?.scored_scenarios || []),
    ...(state.data.optimizer?.best_scenarios || []),
  ].find((scenario) => scenario.scenario_id === scenarioId);
}

function upsertScenario(scenarios, scenario) {
  return [
    ...(scenarios || []).filter((item) => item.scenario_id !== scenario.scenario_id),
    scenario,
  ];
}

if (networkActive) {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./main.css', import.meta.url);
  document.head.append(stylesheet);
  const createRoot = (config) => {
    const existing = document.getElementById('networkAppRoot');
    if (existing) return existing;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderShell({
      companyId: config.company_id,
      route: config.default_route,
      debugEnabled: config.debug_enabled,
    });
    const root = wrapper.firstElementChild;
    document.body.prepend(root);
    document.body.classList.add('network-ui-active');
    return root;
  };

  const createProvider = async (companyId) => {
    if (isMockTenant(companyId)) {
      const { createMockProvider } = await import('./providers/mock-provider.js');
      return createMockProvider();
    }
    const { createProjectProvider } = await import('./providers/project-provider.js');
    return createProjectProvider();
  };

  const bootstrap = async () => {
    let config;
    try {
      config = buildAppConfig({
        request: { ...request, network_ui: true },
        location: window.location,
      });
    } catch (error) {
      document.body.insertAdjacentHTML(
        'beforeend',
        `<div class="network-bootstrap-error"><strong>Network Intelligence bloqueado</strong><p>${sanitizeError(error).message}</p></div>`
      );
      return;
    }
    const root = createRoot(config);
    const store = createStateStore(createInitialState(config));
    let provider = null;
    let stopRouter = null;
    let operationId = 0;
    let companySwitchQueue = Promise.resolve();
    let activeAction = null;
    let exportInFlight = false;
    let lastScenarioExportAt = 0;
    const packageExportsInFlight = new Set();
    const lastPackageExportAt = new Map();
    let drawerReturnFocus = null;

    const nextOperation = () => {
      operationId += 1;
      return operationId;
    };

    const isCurrentOperation = (token, companyId, ownerProvider = null) => {
      const state = store.getState();
      return (
        token === operationId &&
        state.context.company_id === companyId &&
        (!ownerProvider || provider === ownerProvider)
      );
    };

    const beginAction = (kind, activeProvider, companyId) => {
      if (activeAction) return null;
      const action = { kind, activeProvider, companyId, token: operationId };
      activeAction = action;
      return action;
    };

    const isCurrentAction = (action) =>
      activeAction === action &&
      isCurrentOperation(action.token, action.companyId, action.activeProvider);

    const finishAction = (action) => {
      if (activeAction === action) activeAction = null;
    };

    const render = () => {
      const state = store.getState();
      const route = parseRoute(state.ui.route || window.location.hash || config.default_route);
      const renderer = ROUTE_RENDERERS[route.path] || (() => routeFallback(route.hash));
      const page = root.querySelector('#networkPage');
      if (!page) return;
      page.dataset.routeCurrent = route.hash;
      page.innerHTML = renderer(state, route);
      setActiveNav(root, route);
      updateGlobalContext(root, state);
      renderCharts(route.path, state);
      if (state.ui.error) {
        page.insertAdjacentHTML(
          'afterbegin',
          `<div class="ni-alert error"><strong>Falha</strong><p>${sanitizeError(state.ui.error).message}</p></div>`
        );
      }
    };

    const commitDecisionPackage = (state, packageResult, activeProvider) => {
      const selected = packageResult.selected_scenario || null;
      const mockDecision = packageResult.decision || {};
      const selectedScenario = selected?.scenario || null;
      const selectedResult = selected?.result || null;
      const risk = packageResult.risk || {
        monte_carlo: mockDecision.monte_carlo,
        stress: mockDecision.stress_test,
        robustness: mockDecision.robustness,
      };
      state.data.optimizer =
        packageResult.optimizer || activeProvider.getDomainContext()?.optimizer || null;
      state.data.selected_scenario = selectedScenario;
      state.data.scenario_result = selectedResult;
      state.data.scenario_quality = selected?.quality || null;
      state.data.comparison = packageResult.comparison || null;
      state.data.monte_carlo = risk.monte_carlo || null;
      state.data.stress = risk.stress || null;
      state.data.sensitivity = risk.sensitivity || null;
      state.data.sensitivity_matrix = risk.sensitivity_matrix || null;
      state.data.robustness = risk.robustness || null;
      state.data.recommendation =
        packageResult.recommendation || mockDecision.recommendation || null;
      state.data.audit = packageResult.audit || mockDecision.audit || null;
      state.data.final_qa = packageResult.final_qa || mockDecision.final_qa || null;
      state.data.release = packageResult.release || mockDecision.release || null;
      state.data.export_package = packageResult.export_package || null;
      state.context.selected_scenario_id = selectedScenario?.scenario_id || null;
      state.meta.status = 'decision_ready';
      state.ui.loading = false;
    };

    const loadCompany = async (companyId, token) => {
      if (token !== operationId) return;
      const previousProvider = provider;
      const previousCompany = store.getState().context.company_id;
      let nextProvider = null;
      provider = null;
      store.update((state) => {
        resetCompanyScopedState(state, companyId);
        beginLoading(state, `Carregando ${getCompanyDefinition(companyId)?.label || companyId}…`);
      });
      showLoading(
        root,
        true,
        'Carregando empresa',
        getCompanyDefinition(companyId)?.label || companyId
      );
      render();
      try {
        if (previousProvider && previousCompany !== companyId) {
          await previousProvider.dispose({ lock: previousCompany !== 'empresa_mock' });
        }
        if (!isCurrentOperation(token, companyId)) {
          return;
        }
        nextProvider = await createProvider(companyId);
        const snapshot = await nextProvider.init({
          company_id: companyId,
          runtime_mode: config.runtime_mode,
          debug_enabled: config.debug_enabled,
        });
        const baseline = await nextProvider.loadBaseline();
        const scenarios = await nextProvider.loadScenarioLibrary();
        if (!isCurrentOperation(token, companyId)) {
          await nextProvider.dispose({ lock: companyId !== 'empresa_mock' });
          return;
        }
        provider = nextProvider;
        const savedScenarios = loadSavedScenarios(companyId).filter(
          (scenario) => scenario?.company_id === companyId
        );
        store.update((state) => {
          commitProviderSnapshot(state, snapshot);
          state.data.baseline = baseline.baseline;
          state.data.scenarios = scenarios.scenarios || [];
          state.data.saved_scenarios = savedScenarios;
          state.meta.provider_snapshot = {
            ...state.meta.provider_snapshot,
            warnings: [...(baseline.warnings || []), ...(scenarios.warnings || [])],
          };
          const first = state.data.scenarios[0];
          setSelectedScenario(state, first?.scenario_id || null);
        });
        if (isMockTenant(companyId)) {
          const packageResult = await nextProvider.buildDecisionPackage({
            scenarioId: 'mock_consolidation',
          });
          if (!isCurrentOperation(token, companyId, nextProvider)) {
            await nextProvider.dispose({ lock: false });
            return;
          }
          store.update((state) => commitDecisionPackage(state, packageResult, nextProvider));
        }
        showLoading(root, false);
        showToast(
          root,
          `${getCompanyDefinition(companyId)?.label || companyId} carregada.`,
          'success'
        );
      } catch (error) {
        if (!isCurrentOperation(token, companyId)) {
          if (nextProvider) await nextProvider.dispose({ lock: companyId !== 'empresa_mock' });
          if (provider === nextProvider) provider = null;
          return;
        }
        if (nextProvider) {
          try {
            await nextProvider.dispose({ lock: companyId !== 'empresa_mock' });
          } catch {
            // Mantém o erro original de carregamento; a sessão criptográfica já é
            // invalidada pelo provider real quando o dispose consegue concluir.
          } finally {
            if (provider === nextProvider) provider = null;
          }
        }
        store.update((state) => failLoading(state, error));
        showLoading(root, false);
        showToast(root, sanitizeError(error).message, 'error');
      }
      if (isCurrentOperation(token, companyId)) render();
    };

    const controller = {
      async switchCompany(companyId) {
        if (!getCompanyDefinition(companyId)) return;
        const current = store.getState();
        if (current.context.company_id === companyId && (provider || current.ui.loading)) return;
        activeAction = null;
        const token = nextOperation();
        replaceCompanyQuery(companyId);
        companySwitchQueue = companySwitchQueue
          .catch(() => {})
          .then(() => loadCompany(companyId, token));
        await companySwitchQueue;
      },
      loadScenarioDraft(scenarioId) {
        const state = store.getState();
        const scenario = findScenario(state, scenarioId);
        if (!scenario) {
          showToast(root, 'Cenário não encontrado na biblioteca ativa.', 'error');
          return;
        }
        store.update((nextState) => {
          nextState.ui.scenario_draft = scenario;
          nextState.context.selected_scenario_id = scenario.scenario_id;
          clearScenarioResults(nextState);
        });
        navigate('#/network/scenarios/build');
        showToast(
          root,
          `Cenário carregado: ${scenario.scenario_name || scenario.scenario_id}.`,
          'success'
        );
      },
      resetScenarioDraft() {
        store.update((nextState) => {
          nextState.ui.scenario_draft = null;
          nextState.context.selected_scenario_id = null;
          clearScenarioResults(nextState);
        });
        navigate('#/network/scenarios/build');
        showToast(root, 'Rascunho limpo; formulário voltou ao baseline.', 'success');
      },
      selectComparedScenario(scenarioId) {
        const state = store.getState();
        const candidate = findScenario(state, scenarioId);
        if (!candidate) {
          showToast(root, 'Cenário comparado não está disponível para reexecução.', 'error');
          return;
        }
        void this.runScenario({ scenario: candidate.scenario || candidate, scenarioId });
      },
      saveCurrentScenario() {
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
        showToast(
          root,
          `Cenário salvo: ${scenario.scenario_name || scenario.scenario_id}.`,
          'success'
        );
      },
      exportCurrentScenario() {
        const now = Date.now();
        if (now - lastScenarioExportAt < 600) return;
        lastScenarioExportAt = now;
        const state = store.getState();
        const scenario = state.data.selected_scenario;
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
      },
      deleteSavedScenario(scenarioId) {
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
      },
      clearSavedScenarios() {
        const state = store.getState();
        const savedIds = new Set(
          (state.data.saved_scenarios || []).map((item) => item.scenario_id)
        );
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
      },
      async importScenario(file) {
        const state = store.getState();
        const companyId = state.context.company_id;
        const activeProvider = provider;
        const token = operationId;
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
      },
      async runScenario({
        formValues = {},
        scenarioId = null,
        scenario: inputScenario = null,
      } = {}) {
        if (!provider) return;
        const activeProvider = provider;
        const companyId = store.getState().context.company_id;
        const action = beginAction('scenario', activeProvider, companyId);
        if (!action) return;
        const effectiveScenarioId =
          scenarioId ||
          inputScenario?.scenario_id ||
          (store.getState().context.provider_kind === 'mock'
            ? store.getState().ui.scenario_draft?.scenario_id
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
            state.ui.loading = false;
            state.context.selected_scenario_id = scenario?.scenario_id || null;
            state.ui.scenario_draft = scenario;
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
        if (isCurrentAction(action) || !activeAction) render();
      },
      async runRisk(config = {}) {
        if (!provider) return;
        const activeProvider = provider;
        const current = store.getState();
        const companyId = current.context.company_id;
        const selectedScenario = current.data.selected_scenario;
        const deterministicResult = current.data.scenario_result;
        if (!selectedScenario || !deterministicResult) {
          showToast(root, 'Simule um cenário antes de calcular risco.', 'error');
          return;
        }
        const action = beginAction('risk', activeProvider, companyId);
        if (!action) return;
        store.update((state) => {
          beginLoading(state, 'Calculando risco e sensibilidade…');
        });
        showLoading(root, true, 'Calculando risco', 'Monte Carlo, stress e sensibilidade.');
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
            state.meta.status = 'risk_ready';
            state.ui.loading = false;
          });
          showLoading(root, false);
          showToast(root, 'Análise de risco concluída pelo provider ativo.', 'success');
          window.location.hash = '#/network/scenarios/risk';
        } catch (error) {
          if (!isCurrentAction(action)) return;
          store.update((state) => failLoading(state, error));
          showLoading(root, false);
          showToast(root, sanitizeError(error).message, 'error');
        } finally {
          finishAction(action);
        }
        if (isCurrentAction(action) || !activeAction) render();
      },
      async runDecision(options = {}) {
        if (!provider) return;
        const activeProvider = provider;
        const companyId = store.getState().context.company_id;
        const action = beginAction('decision', activeProvider, companyId);
        if (!action) return;
        store.update((state) => {
          beginLoading(state, 'Executando pipeline de decisão…');
        });
        showLoading(root, true, 'Executando decisão', 'Optimizer, risco, Evidence, QA e release.');
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
          });
          showLoading(root, false);
          showToast(root, 'Pipeline de decisão concluído.', 'success');
          window.location.hash = '#/network/trust/validation';
        } catch (error) {
          if (!isCurrentAction(action)) return;
          store.update((state) => failLoading(state, error));
          showLoading(root, false);
          showToast(root, sanitizeError(error).message, 'error');
        } finally {
          finishAction(action);
        }
        if (isCurrentAction(action) || !activeAction) render();
      },
      exportPackage(index = 0) {
        const companyId = store.getState().context.company_id;
        const token = operationId;
        const files = store.getState().data.export_package?.files || [];
        const file = files[index] || files[0];
        if (!file) {
          showToast(root, 'Nenhum pacote de exportação disponível.', 'error');
          return;
        }
        const exportKey = `${index}:${file.filename || 'export'}`;
        const now = Date.now();
        if (index === 0 && exportInFlight) return;
        if (packageExportsInFlight.has(exportKey)) return;
        if (now - (lastPackageExportAt.get(exportKey) || 0) < 600) return;
        lastPackageExportAt.set(exportKey, now);
        packageExportsInFlight.add(exportKey);
        if (index === 0) exportInFlight = true;
        import('../phase5/export-center.js')
          .then(({ triggerBrowserDownload }) => {
            if (!isCurrentOperation(token, companyId)) return;
            triggerBrowserDownload(file.filename, file.content, file.type);
            showToast(root, `Exportado: ${file.filename}`, 'success');
          })
          .catch((error) => {
            if (isCurrentOperation(token, companyId)) {
              showToast(root, sanitizeError(error).message, 'error');
            }
          })
          .finally(() => {
            packageExportsInFlight.delete(exportKey);
            if (index === 0) exportInFlight = false;
          });
      },
      lock() {
        nextOperation();
        activeAction = null;
        const activeProvider = provider;
        provider = null;
        void activeProvider?.dispose({ lock: true });
        showLoading(root, false);
        store.update((state) => {
          resetCompanyScopedState(state, state.context.company_id);
          state.meta.status = 'locked';
        });
        render();
        showToast(root, 'Sessão bloqueada e estado da empresa limpo.', 'success');
      },
      closeDrawer() {
        const drawer = root.querySelector('#networkDrawer');
        const backdrop = root.querySelector('#networkDrawerBackdrop');
        if (drawer) drawer.hidden = true;
        if (backdrop) backdrop.hidden = true;
        const returnFocus = drawerReturnFocus;
        drawerReturnFocus = null;
        if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus();
      },
      openDrawer(title, body) {
        const drawer = root.querySelector('#networkDrawer');
        const backdrop = root.querySelector('#networkDrawerBackdrop');
        const titleNode = root.querySelector('#networkDrawerTitle');
        const bodyNode = root.querySelector('#networkDrawerBody');
        if (!drawer || !backdrop || !titleNode || !bodyNode) return;
        drawerReturnFocus = document.activeElement;
        titleNode.textContent = title || 'Detalhes';
        bodyNode.innerHTML = body || '';
        drawer.hidden = false;
        backdrop.hidden = false;
        titleNode.focus();
      },
    };

    function renderCharts(path, state) {
      if (path === '/network/overview/costs')
        renderCostChart('niCostChart', state.data.scenario_result || state.data.baseline);
      if (path === '/network/overview/network') {
        const flows = state.data.baseline?.flows || [];
        renderVolumeByCdChart('niVolumeByCdChart', flows);
        renderDistanceHistogram('niDistanceHistogramChart', flows);
      }
      if (path.includes('/risk')) {
        renderRiskChart('niRiskChart', state.data.monte_carlo);
        renderSensitivity('niSensitivityChart', state.data.sensitivity);
        const monteCarlo = state.data.monte_carlo;
        renderRiskHistogram('niRiskHistogramChart', monteCarlo);
        renderRiskCdf('niRiskCdfChart', monteCarlo);
        renderRiskTotalCurve('niRiskTotalChart', monteCarlo);
        renderRiskDrivers('niRiskDriversChart', monteCarlo);
        renderRiskScatter('niRiskScatterChart', monteCarlo);
        renderRiskProbability('niRiskProbabilityChart', monteCarlo);
      }
      if (path === '/network/optimizer/results')
        renderRanking('niRankingChart', state.data.optimizer);
    }

    store.subscribe(render);
    stopRouter = startRouter({
      initialRoute: config.default_route,
      onRouteChange(route) {
        store.update((state) => setRoute(state, route.hash));
      },
    });
    installBindings({ root, store, controller });
    await loadCompany(config.company_id, nextOperation());
    window.addEventListener(
      'beforeunload',
      () => {
        void provider?.dispose({ lock: true });
        stopRouter?.();
      },
      { once: true }
    );
  };

  void bootstrap();
}
