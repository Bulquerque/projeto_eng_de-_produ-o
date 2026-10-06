import { buildAppConfig, readRuntimeRequest } from './config.js';
import { getCompanyDefinition, isMockTenant } from './company-registry.js';
import {
  createInitialState,
  createStateStore,
  beginLoading,
  commitProviderSnapshot,
  failLoading,
  resetCompanyScopedState,
  resolveDecisionStatus,
  setRoute,
  setSelectedScenario,
} from './state.js';
import { parseRoute, replaceCompanyQuery, startRouter } from './router.js';
import { renderShell, setActiveNav, showLoading, showToast, updateGlobalContext } from './shell.js';
import { installBindings } from './bindings.js';
import { createOperationGuard } from './operation-guard.js';
import { createScenarioActions } from './scenario-actions.js';
import { createAnalysisActions } from './analysis-actions.js';
import { sanitizeError } from './dev/dev-console.js';
import { escapeHtml, routeFallback } from './view-helpers.js';
import { ROUTE_RENDERERS } from './route-renderers.js';
import { destroyAllCharts } from '../core/chart-renderer.js';
import { renderOverviewAnalytics } from './charts/overview-analytics.js';
import { renderDecisionAnalytics } from './charts/decision-analytics.js';
import { renderTrustAnalytics } from './charts/trust-analytics.js';
import {
  bindMapInteraction,
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
import { loadSavedScenarios } from '../phase3/scenario-persistence.js';
import { loadOptimizationPresets } from '../core/optimization-config-store.js';

const request = readRuntimeRequest();
window.__VISAGIO_NETWORK_UI__ = true;

function initializeNetworkIntelligence() {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./main.css?v=mobile-chart-polish-20261006', import.meta.url);
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
        request,
        location: window.location,
      });
    } catch (error) {
      document.body.insertAdjacentHTML(
        'beforeend',
        `<div class="network-bootstrap-error"><strong>Network Intelligence bloqueado</strong><p>${escapeHtml(sanitizeError(error).message)}</p></div>`
      );
      return;
    }
    const root = createRoot(config);
    const store = createStateStore(createInitialState(config));
    let provider = null;
    let stopRouter = null;
    let companySwitchQueue = Promise.resolve();
    let exportInFlight = false;
    const packageExportsInFlight = new Set();
    const lastPackageExportAt = new Map();
    let drawerReturnFocus = null;

    const {
      nextOperation,
      currentToken,
      isCurrentToken,
      isCurrentOperation,
      beginAction,
      isCurrentAction,
      finishAction,
      cancelActiveAction,
      hasActiveAction,
    } = createOperationGuard({ getState: store.getState, getProvider: () => provider });

    const render = () => {
      const state = store.getState();
      const route = parseRoute(state.ui.route || window.location.hash || config.default_route);
      const renderer = ROUTE_RENDERERS[route.path] || (() => routeFallback(route.hash));
      const page = root.querySelector('#networkPage');
      if (!page) return;
      page.dataset.routeCurrent = route.hash;
      destroyAllCharts();
      page.innerHTML = renderer(state, route);
      setActiveNav(root, route);
      updateGlobalContext(root, state);
      renderCharts(route.path, state);
      if (state.ui.error) {
        page.insertAdjacentHTML(
          'afterbegin',
          `<div class="ni-alert error"><strong>Falha</strong><p>${escapeHtml(sanitizeError(state.ui.error).message)}</p>${state.meta.status === 'error' ? '<button type="button" class="ni-button secondary" data-action="retry-company">Tentar novamente</button>' : ''}</div>`
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
      state.meta.result_kind = 'optimization';
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
      // Keep the global selector tied to the package that just completed. A
      // previous fiscal draft must not survive an optimizer run and make the
      // header disagree with the result shown below.
      state.ui.scenario_draft = selectedScenario;
      state.ui.scenario_draft_dirty = false;
      state.meta.status = resolveDecisionStatus(packageResult);
      state.ui.loading = false;
    };

    const loadCompany = async (companyId, token) => {
      if (!isCurrentToken(token)) return;
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
          state.ui.optimizer_presets = loadOptimizationPresets(companyId);
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
        if (previousProvider && previousCompany !== companyId) {
          showToast(
            root,
            `${getCompanyDefinition(companyId)?.label || companyId} carregada.`,
            'success'
          );
        }
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

    const scenarioActions = createScenarioActions({
      root,
      store,
      getProvider: () => provider,
      operationGuard: {
        currentToken,
        isCurrentOperation,
        beginAction,
        isCurrentAction,
        finishAction,
        hasActiveAction,
      },
      render,
    });
    const analysisActions = createAnalysisActions({
      store,
      getProvider: () => provider,
      operationGuard: { beginAction, isCurrentAction, finishAction, hasActiveAction },
      commitDecisionPackage,
      render,
      showLoading: (visible, title, note) => showLoading(root, visible, title, note),
      showToast: (message, kind) => showToast(root, message, kind),
      navigate: (route) => {
        window.location.hash = route;
      },
    });

    const controller = {
      ...scenarioActions,
      ...analysisActions,
      retryCompany() {
        void this.switchCompany(store.getState().context.company_id);
      },
      async switchCompany(companyId) {
        if (!getCompanyDefinition(companyId)) return;
        const current = store.getState();
        if (current.context.company_id === companyId && (provider || current.ui.loading)) return;
        cancelActiveAction();
        const token = nextOperation();
        replaceCompanyQuery(companyId);
        companySwitchQueue = companySwitchQueue
          .catch(() => {})
          .then(() => loadCompany(companyId, token));
        await companySwitchQueue;
      },
      exportPackage(index = 0) {
        const companyId = store.getState().context.company_id;
        const token = currentToken();
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
      async lock() {
        nextOperation();
        cancelActiveAction();
        const activeProvider = provider;
        provider = null;
        await activeProvider?.dispose({ lock: true });
        showLoading(root, false);
        store.update((state) => {
          resetCompanyScopedState(state, state.context.company_id);
          state.meta.status = 'locked';
        });
        window.location.reload();
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
      renderOverviewAnalytics(state);
      renderDecisionAnalytics(state);
      renderTrustAnalytics(state);
      bindMapInteraction(root);
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
        root.querySelector('#networkToastRoot')?.replaceChildren();
        store.update((state) => setRoute(state, route.hash));
        window.requestAnimationFrame(() => {
          window.scrollTo(0, 0);
          root.querySelector('#networkPage')?.focus({ preventScroll: true });
        });
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

initializeNetworkIntelligence();
