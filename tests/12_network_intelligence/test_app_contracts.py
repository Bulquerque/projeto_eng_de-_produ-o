import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / 'assets/js/app'


def run_node(source: str):
    result = subprocess.run(
        ['node', '--input-type=module', '-e', source],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def test_app_foundation_contracts():
    output = run_node(
        """
        import assert from 'node:assert/strict';
        import { COMPANY_REGISTRY, assertCompanyPolicy } from './assets/js/app/company-registry.js';
        import { buildAppConfig, resolveInitialCompany } from './assets/js/app/config.js';
        import { isKnownRoute, normalizeRoute, parseRoute, replaceCompanyQuery } from './assets/js/app/router.js';
        import { clearScenarioResults, createEmptyData, createInitialState, createStateStore, commitProviderSnapshot, getSafeStateSnapshot, resetCompanyScopedState } from './assets/js/app/state.js';
        import { formatMetric, readMetric } from './assets/js/app/metric-registry.js';

        assert.equal(COMPANY_REGISTRY.empresa1.provider, 'project');
        assert.equal(COMPANY_REGISTRY.empresa2.provider, 'project');
        assert.equal(COMPANY_REGISTRY.empresa_mock.release_policy, 'demo_only');
        assert.equal(resolveInitialCompany({ company_id: 'empresa_mock' }, 'project'), 'empresa_mock');
        assert.equal(buildAppConfig({ request: { company_id: 'empresa_mock' }, location: { protocol: 'https:' } }).company_id, 'empresa_mock');
        assert.throws(() => assertCompanyPolicy('empresa1', { providerKind: 'mock' }));
        assert.equal(normalizeRoute('#/network/overview/summary'), '#/network/overview/summary');
        assert.equal(normalizeRoute('#/diagnostico-baseline?company=empresa_mock'), '#/network/overview/summary?company=empresa_mock');
        assert.equal(normalizeRoute('#/simulacao-otimizacao?scenario=abc'), '#/network/scenarios/build?scenario=abc');
        assert.equal(normalizeRoute('#/homologacao-relatorio?tab=checks'), '#/network/trust/validation?tab=checks');
        assert.equal(normalizeRoute('#/fase-3-cenarios?scenario=abc'), '#/network/scenarios/build?scenario=abc');
        assert.equal(normalizeRoute('#/fase-4-score-otimizador'), '#/network/optimizer/configure');
        assert.equal(normalizeRoute('#/fase-5-entrega-final'), '#/network/trust/validation');
        assert.equal(isKnownRoute('#/fase-4-score-otimizador'), true);
        assert.equal(parseRoute('#/simulacao-otimizacao?scenario=abc').query.get('scenario'), 'abc');
        assert.equal(isKnownRoute('#/network/dev/console?tab=errors'), true);
        assert.equal(parseRoute('#/network/dev/console?tab=errors').path, '/network/dev/console');
        const store = createStateStore(createInitialState({ company_id: 'empresa1', default_route: '#/network/overview/summary' }));
        assert.deepEqual(store.getState().data.saved_scenarios, []);
        const firstData = createEmptyData();
        const secondData = createEmptyData();
        firstData.scenarios.push({ scenario_id: 'isolated' });
        assert.deepEqual(secondData.scenarios, []);
        store.getState().data.audit = { company_id: 'empresa1' };
        store.getState().data.release = { release_status: 'passed' };
        store.getState().data.export_package = { files: ['stale'] };
        store.getState().data.selected_scenario = { scenario_id: 'stale' };
        clearScenarioResults(store.getState());
        assert.equal(store.getState().data.selected_scenario, null);
        assert.equal(store.getState().data.audit, null);
        assert.equal(store.getState().data.release, null);
        assert.equal(store.getState().data.export_package, null);
        const transient = createInitialState({ company_id: 'empresa1' });
        transient.ui.optimizer_config = { profile_id: 'cfo', seed: 73 };
        transient.ui.risk_config = { seed: 73 };
        transient.ui.scenario_draft_dirty = true;
        transient.ui.compared_scenario_ids = ['old'];
        resetCompanyScopedState(transient, 'empresa2');
        assert.equal(transient.ui.optimizer_config, null);
        assert.equal(transient.ui.risk_config, null);
        assert.equal(transient.ui.scenario_draft_dirty, false);
        assert.equal(transient.ui.compared_scenario_ids, null);
        assert.equal(replaceCompanyQuery('empresa1'), null);
        commitProviderSnapshot(store.getState(), { company_id: 'empresa1', provider_kind: 'project', status: 'ready', data: { baseline: { model: { active_cds: ['A'] } } } });
        assert.equal(store.getState().data.baseline.model.active_cds[0], 'A');
        const safe = getSafeStateSnapshot(store.getState());
        assert.equal(Object.hasOwn(safe, 'data'), false);
        assert.equal(Object.hasOwn(safe.meta, 'provider_snapshot'), true);
        const view = { result: { total_with_tax: 1234.5 }, comparison: { saving_pct: 4.2 } };
        assert.equal(readMetric(view, 'total_with_tax'), 1234.5);
        assert.ok(formatMetric('total_with_tax', 1234.5).startsWith('R$'));
        console.log('APP_FOUNDATION_OK');
        """
    )
    assert output.endswith('APP_FOUNDATION_OK')


def test_mock_fixture_isolation_contract():
    for path in sorted((ROOT / 'data-demo/empresa_mock').glob('*.json')):
        payload = json.loads(path.read_text(encoding='utf-8'))
        assert payload['company_id'] == 'empresa_mock', path
        assert payload['release_policy'] == 'demo_only', path
        provenance = payload.get('provenance', {})
        assert provenance.get('synthetic') is True, path

    mock_provider = (APP / 'providers/mock-provider.js').read_text(encoding='utf-8')
    project_provider = (APP / 'providers/project-provider.js').read_text(encoding='utf-8')
    main = (APP / 'main.js').read_text(encoding='utf-8')
    scenario_actions = (APP / 'scenario-actions.js').read_text(encoding='utf-8')
    analysis_actions = (APP / 'analysis-actions.js').read_text(encoding='utf-8')
    dev_console = (APP / 'dev/dev-console.js').read_text(encoding='utf-8')
    shell_source = (APP / 'shell.js').read_text(encoding='utf-8')
    bindings_source = (APP / 'bindings.js').read_text(encoding='utf-8')
    crypto_session = (ROOT / 'assets/js/core/crypto-session.js').read_text(encoding='utf-8')
    export_center = (ROOT / 'assets/js/phase5/export-center.js').read_text(encoding='utf-8')
    assert 'data-demo/empresa_mock' in mock_provider
    assert 'runDomainScenario' in mock_provider
    assert 'assertSupportedScenario' in mock_provider
    assert "import('./providers/mock-provider.js')" in main
    assert "import('./providers/project-provider.js')" in main
    assert "import('../phase5/export-center.js')" in main
    assert 'runDomainScenario' in project_provider
    assert 'runDomainOptimization' in project_provider
    assert 'return assertNoMockLeakage(' in project_provider
    assert 'return assertNoMockLeakage(packageResult' in project_provider
    assert "import { createOperationGuard } from './operation-guard.js'" in main
    assert 'createOperationGuard({ getState: store.getState' in main
    assert "import { createScenarioActions } from './scenario-actions.js'" in main
    assert 'const scenarioActions = createScenarioActions({' in main
    assert '...scenarioActions' in main
    assert "import { createAnalysisActions } from './analysis-actions.js'" in main
    assert 'const analysisActions = createAnalysisActions({' in main
    assert '...analysisActions' in main
    assert "beginAction('decision'" in analysis_actions
    assert 'packageExportsInFlight' in main
    assert 'if (index === 0 && exportInFlight) return;' in main
    assert 'isCurrentOperation(token, companyId, activeProvider)' in scenario_actions
    assert 'getSafeStateSnapshot(state)' in dev_console
    assert 'snapshot: sanitize(state)' not in dev_console
    assert 'getSafeStateSnapshot' in dev_console
    assert 'const companyId =' in crypto_session
    assert '`${KEY_PREFIX}${companyId}_' in crypto_session
    assert 'sanitizeExportValue' in export_center
    assert 'STRESS_EXPORT_COLUMNS' in export_center
    assert 'SENSITIVITY_EXPORT_COLUMNS' in export_center
    assert 'return-to-demo' not in shell_source
    assert 'switch-demo-company' not in bindings_source
    assert 'currentSection' in shell_source
    assert 'id="niLockButton"' in shell_source
    assert 'data-action="lock-crypto"' in shell_source
    assert "lockButton.hidden = state.context.provider_kind !== 'project'" in shell_source
    assert 'controller.lock()' in bindings_source

    trust = (APP / 'pages' / 'trust.js').read_text(encoding='utf-8')
    styles = (APP / 'main.css').read_text(encoding='utf-8')
    assert 'auditForPresentation' in trust
    assert 'Fonte protegida (detalhes no pacote de exportação)' in trust
    assert 'body.network-ui-active .network-toast-root' in styles


def test_async_operation_guard_rejects_stale_actions():
    output = run_node(
        """
        import assert from 'node:assert/strict';
        import { createOperationGuard } from './assets/js/app/operation-guard.js';

        const state = { context: { company_id: 'empresa1' } };
        const provider = {};
        const guard = createOperationGuard({ getState: () => state, getProvider: () => provider });
        const token = guard.nextOperation();
        const action = guard.beginAction('scenario', provider, 'empresa1');

        assert.ok(action);
        assert.equal(guard.hasActiveAction(), true);
        assert.equal(guard.isCurrentAction(action), true);
        assert.equal(guard.beginAction('risk', provider, 'empresa1'), null);

        state.context.company_id = 'empresa2';
        assert.equal(guard.isCurrentAction(action), false);
        assert.equal(guard.isCurrentOperation(token, 'empresa2', provider), true);
        assert.notEqual(guard.nextOperation(), token);
        assert.equal(guard.isCurrentToken(token), false);

        guard.cancelActiveAction();
        assert.equal(guard.hasActiveAction(), false);
        assert.equal(guard.isCurrentAction(action), false);
        console.log('OPERATION_GUARD_OK');
        """
    )
    assert output.endswith('OPERATION_GUARD_OK')


def test_scenario_actions_controller_contract():
    output = run_node(
        """
        import assert from 'node:assert/strict';
        import { createScenarioActions } from './assets/js/app/scenario-actions.js';
        import { createOperationGuard } from './assets/js/app/operation-guard.js';

        const state = { context: { company_id: 'empresa1' }, data: {}, ui: {} };
        const provider = {};
        const actions = createScenarioActions({
          root: {},
          store: { getState: () => state, update() {} },
          getProvider: () => provider,
          operationGuard: createOperationGuard({
            getState: () => state,
            getProvider: () => provider,
          }),
          render() {},
        });
        assert.deepEqual(Object.keys(actions).sort(), [
          'clearSavedScenarios',
          'deleteSavedScenario',
          'exportCurrentScenario',
          'importScenario',
          'loadScenarioDraft',
          'resetScenarioDraft',
          'runScenario',
          'saveCurrentScenario',
          'selectComparedScenario',
          'selectScenarioTaxYear',
        ]);
        console.log('SCENARIO_ACTIONS_API_OK');
        """
    )
    assert output.endswith('SCENARIO_ACTIONS_API_OK')


def test_analysis_actions_ignore_stale_work_and_report_failures():
    output = run_node(
        """
        import assert from 'node:assert/strict';
        import { createAnalysisActions } from './assets/js/app/analysis-actions.js';
        import { createOperationGuard } from './assets/js/app/operation-guard.js';
        import { createInitialState, createStateStore, resetCompanyScopedState } from './assets/js/app/state.js';

        const deferred = () => {
          let resolve;
          const promise = new Promise((done) => { resolve = done; });
          return { promise, resolve };
        };
        const makeHarness = (provider) => {
          const state = createInitialState({ company_id: 'empresa1' });
          state.context.provider_kind = 'project';
          state.data.selected_scenario = { scenario_id: 'scenario-1', company_id: 'empresa1' };
          state.data.scenario_result = { total_with_tax: 100 };
          state.data.recommendation = { status: 'old' };
          state.data.audit = { status: 'old' };
          state.data.final_qa = { status: 'old' };
          state.data.release = { status: 'old' };
          state.data.export_package = { files: ['old'] };
          const store = createStateStore(state);
          const guard = createOperationGuard({
            getState: store.getState,
            getProvider: () => provider,
          });
          const toasts = [];
          const routes = [];
          let renderCount = 0;
          let committedDecision = false;
          const actions = createAnalysisActions({
            store,
            getProvider: () => provider,
            operationGuard: guard,
            commitDecisionPackage(target, result) {
              committedDecision = true;
              target.data.optimizer = result.optimizer;
              target.meta.status = 'decision_ready';
              target.ui.loading = false;
            },
            render() { renderCount += 1; },
            showLoading() {},
            showToast(message, kind) { toasts.push({ message, kind }); },
            navigate(route) { routes.push(route); },
          });
          return { state, store, guard, actions, toasts, routes, get renderCount() { return renderCount; }, get committedDecision() { return committedDecision; } };
        };

        const riskResponse = deferred();
        const staleHarness = makeHarness({ runRiskSuite: () => riskResponse.promise });
        const pendingRisk = staleHarness.actions.runRisk({ seed: 9 });
        assert.equal(staleHarness.state.ui.loading, true);
        staleHarness.guard.cancelActiveAction();
        staleHarness.guard.nextOperation();
        staleHarness.store.update((state) => resetCompanyScopedState(state, 'empresa2'));
        riskResponse.resolve({ monte_carlo: { stale: true }, stress: { stale: true } });
        await pendingRisk;
        assert.equal(staleHarness.state.context.company_id, 'empresa2');
        assert.equal(staleHarness.state.data.monte_carlo, null);
        assert.equal(staleHarness.state.meta.status, 'switching_company');

        const successHarness = makeHarness({
          runRiskSuite: async () => ({
            monte_carlo: { seed: 9 }, stress: { cases: [] }, sensitivity: { rows: [] },
            sensitivity_matrix: { cells: [] }, robustness: { score: 80 },
          }),
        });
        await successHarness.actions.runRisk({ seed: 9 });
        assert.equal(successHarness.state.meta.status, 'risk_ready');
        assert.deepEqual(successHarness.state.ui.risk_config, { seed: 9 });
        for (const key of ['recommendation', 'audit', 'final_qa', 'release', 'export_package']) {
          assert.equal(successHarness.state.data[key], null);
        }
        assert.equal(successHarness.routes.at(-1), '#/network/scenarios/risk');

        const failureHarness = makeHarness({
          buildDecisionPackage: async () => { throw new Error('decision failed'); },
        });
        await failureHarness.actions.runDecision({ profileId: 'balanced' });
        assert.equal(failureHarness.state.ui.loading, false);
        assert.equal(failureHarness.state.meta.status, 'error');
        assert.equal(failureHarness.state.ui.error.message, 'decision failed');
        assert.equal(failureHarness.toasts.at(-1).kind, 'error');
        assert.equal(failureHarness.guard.hasActiveAction(), false);
        console.log('ANALYSIS_ACTIONS_STALENESS_FAILURE_OK');
        """
    )
    assert output.endswith('ANALYSIS_ACTIONS_STALENESS_FAILURE_OK')


def test_network_ui_entrypoint_and_e2e_hooks():
    index = (ROOT / 'index.html').read_text(encoding='utf-8')
    assert 'assets/js/app/main.js' in index
    for phase in range(1, 6):
        phase_main = (ROOT / f'assets/js/phase{phase}/main.js').read_text(encoding='utf-8')
        assert '!window.__VISAGIO_NETWORK_UI__' in phase_main

    shell = (APP / 'shell.js').read_text(encoding='utf-8')
    expected_ids = [
        'company-selector',
        'scenario-selector',
        'evidence-topbar',
        'company-badge',
        'export-center',
        'dev-console',
    ]
    for test_id in expected_ids:
        assert f'data-testid="{test_id}"' in shell
    assert '<span>Avaliação de alternativas</span>' in shell
    assert 'Otimizador' not in shell

    page_sources = '\n'.join(
        (APP / 'pages' / filename).read_text(encoding='utf-8')
        for filename in ('overview.js', 'scenarios.js', 'optimizer.js', 'trust.js')
    )
    for test_id in (
        'page-overview-summary',
        'page-scenarios-build',
        'page-scenarios-result',
        'page-optimizer-configure',
        'page-optimizer-results',
        'page-trust-validation',
        'scenario-library',
        'saved-scenarios',
        'network-flow-analytics',
        'tax-periods-panel',
        'risk-controls',
        'scenario-save',
        'scenario-export',
        'scenario-import',
        'scenario-clear-saved',
    ):
        assert f'data-testid="{test_id}"' in page_sources
    assert 'Avaliação de alternativas' in page_sources
    assert 'otimização' not in page_sources.lower()

    assert 'niFlowCountByCdChart' in page_sources


def test_overview_analytics_aggregation():
    result = subprocess.run(
        ['node', str(ROOT / 'tests/12_network_intelligence/overview_analytics_aggregation.mjs')],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    assert 'OVERVIEW_ANALYTICS_AGGREGATION_OK' in result.stdout


def test_draft_reactivation_and_risk_configuration():
    output = run_node(
        """
        import assert from 'node:assert/strict';
        import { createInitialState } from './assets/js/app/state.js';
        import { renderScenarioBuild, renderScenarioRisk } from './assets/js/app/pages/scenarios.js';
        const state = createInitialState({company_id:'empresa1'});
        state.data.baseline = {model:{active_cds:['A','B'],inventory_days:40,wacc:0.15},flows:[]};
        state.ui.scenario_draft = {scenario_name:'Reduced',changes:{active_cds:['A']}};
        state.ui.scenario_draft_dirty = true;
        const html = renderScenarioBuild(state);
        assert.match(html, /name="active_cds" value="A" checked/);
        assert.match(html, /name="active_cds" value="B"(?! checked)/);
        assert.match(html, /Alterações pendentes/);
        state.data.selected_scenario = {scenario_id:'a',company_id:'empresa1'};
        state.data.scenario_result = {total_with_tax:100};
        state.data.monte_carlo = {summary:{iterations:100,seed:42}};
        state.ui.risk_config = {iterations:500,seed:73,profile:'conservative',stress_profile:'conservative'};
        const risk = renderScenarioRisk(state, true);
        assert.match(risk, /name="seed"[^>]*value="73"/);
        assert.match(risk, /value="conservative" selected/);
        console.log('DRAFT_AND_RISK_CONFIG_OK');
        """
    )
    assert output.endswith('DRAFT_AND_RISK_CONFIG_OK')


def test_error_output_is_escaped_and_blocked_decisions_keep_status():
    output = run_node(
        """
        import assert from 'node:assert/strict';
        import { escapeHtml } from './assets/js/app/view-helpers.js';
        import { resolveDecisionStatus } from './assets/js/app/state.js';
        assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
        assert.equal(resolveDecisionStatus({ release: { release_status: 'blocked' } }), 'decision_blocked');
        assert.equal(resolveDecisionStatus({ final_qa: { final_qa_status: 'failed' } }), 'decision_blocked');
        assert.equal(resolveDecisionStatus({ release: { release_status: 'ready' }, final_qa: { final_qa_status: 'passed' } }), 'decision_ready');
        console.log('ERROR_ESCAPING_BLOCKED_DECISION_STATUS_OK');
        """
    )
    assert output.endswith('ERROR_ESCAPING_BLOCKED_DECISION_STATUS_OK')
    main = (APP / 'main.js').read_text(encoding='utf-8')
    assert main.count('escapeHtml(sanitizeError(') >= 2
    assert 'resolveDecisionStatus(packageResult)' in main


if __name__ == '__main__':
    test_app_foundation_contracts()
    test_mock_fixture_isolation_contract()
    test_network_ui_entrypoint_and_e2e_hooks()
    test_scenario_actions_controller_contract()
    test_analysis_actions_ignore_stale_work_and_report_failures()
    test_overview_analytics_aggregation()
    test_draft_reactivation_and_risk_configuration()
    test_error_output_is_escaped_and_blocked_decisions_keep_status()
    print('NETWORK_INTELLIGENCE_APP_CONTRACTS_OK')


def test_annual_tax_scenario_builder_uses_supported_regimes():
    output = run_node(
        """
        import assert from 'node:assert/strict';
        import { buildScenarioFromForm } from './assets/js/phase3/scenario-builder.js';
        const baseline = { model: { scenario_id: 'base', active_cds: ['CD A'] } };
        const regimes = new Map([
          [2026, 'reform_2026'], [2027, 'reform_2027_2028'], [2028, 'reform_2027_2028'],
          [2029, 'transition_2029'], [2030, 'transition_2030'], [2031, 'transition_2031'],
          [2032, 'transition_2032'], [2033, 'reform_full_2033'],
        ]);
        for (const [year, expected] of regimes) {
          const scenario = buildScenarioFromForm({
            companyId: 'empresa1', baselineBundle: baseline,
            scenarioId: `empresa1_tax_reform_${year}`,
            formValues: { scenario_name: `Reforma tributária ${year}`, tax_year: year },
          });
          assert.equal(scenario.changes.tax_year, year);
          assert.equal(scenario.changes.tax_regime, expected);
          assert.deepEqual(scenario.changes.active_cds, ['CD A']);
        }
        console.log('ANNUAL_TAX_SCENARIOS_OK');
        """
    )
    assert output.endswith('ANNUAL_TAX_SCENARIOS_OK')


def test_optimizer_preset_and_tax_year_controls_render():
    output = run_node(
        """
        import assert from 'node:assert/strict';
        import { renderOptimizerConfigure } from './assets/js/app/pages/optimizer.js';
        const html = renderOptimizerConfigure({
          context: { company_id: 'empresa1', provider_kind: 'project' },
          ui: { route: '#/network/optimizer/configure', scenario_draft: { changes: { tax_year: 2030 } },
            optimizer_presets: [{ preset_id: 'fiscal-1', name: 'Fiscal personalizado', configuration: {} }] },
          data: { baseline: { model: { active_cds: ['CD A'] } } },
        });
        assert.match(html, /name="tax_year"/);
        assert.match(html, /value="2030" selected/);
        assert.match(html, /Fiscal personalizado/);
        assert.match(html, /name="custom_preset_name"/);
        assert.match(html, /data-action="save-optimizer-preset"/);
        console.log('OPTIMIZER_PRESET_YEAR_CONTROLS_OK');
        """
    )
    assert output.endswith('OPTIMIZER_PRESET_YEAR_CONTROLS_OK')
