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
        import { clearScenarioResults, createEmptyData, createInitialState, createStateStore, commitProviderSnapshot, getSafeStateSnapshot } from './assets/js/app/state.js';
        import { formatMetric, readMetric } from './assets/js/app/metric-registry.js';

        assert.equal(COMPANY_REGISTRY.empresa1.provider, 'project');
        assert.equal(COMPANY_REGISTRY.empresa2.provider, 'project');
        assert.equal(COMPANY_REGISTRY.empresa_mock.release_policy, 'demo_only');
        assert.equal(resolveInitialCompany({ company_id: 'empresa_mock' }, 'project'), 'empresa_mock');
        assert.equal(buildAppConfig({ request: { company_id: 'empresa_mock', network_ui: true }, location: { protocol: 'https:' } }).company_id, 'empresa_mock');
        assert.throws(() => assertCompanyPolicy('empresa1', { providerKind: 'mock' }));
        assert.equal(normalizeRoute('#/diagnostico-baseline'), '#/network/overview/summary');
        assert.equal(normalizeRoute('#erros'), '#/network/dev/console?tab=errors');
        assert.equal(isKnownRoute('#erros'), true);
        assert.equal(parseRoute('#erros').path, '/network/dev/console');
        const store = createStateStore(createInitialState({ company_id: 'empresa1', default_route: '#/network/overview/summary' }));
        assert.deepEqual(store.getState().data.saved_scenarios, []);
        const firstData = createEmptyData();
        const secondData = createEmptyData();
        firstData.scenarios.push({ scenario_id: 'isolated' });
        assert.deepEqual(secondData.scenarios, []);
        for (const key of ['selected_scenario','scenario_result','optimizer','audit','final_qa','release','export_package','monte_carlo']) { store.getState().data[key] = { stale: true }; }
        store.getState().meta.result_kind = 'optimization';
        clearScenarioResults(store.getState());
        for (const key of ['selected_scenario','scenario_result','optimizer','audit','final_qa','release','export_package','monte_carlo']) { assert.equal(store.getState().data[key], null, key); }
        assert.equal(store.getState().meta.result_kind, null);
        assert.equal(normalizeRoute('#/network/optimizer/results'), '#/network/results/summary');
        assert.equal(normalizeRoute('#/network/scenarios/risk/advanced'), '#/network/results/risk/advanced');
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


def test_optimizer_reform_year_and_saved_technical_draft_render():
    output = run_node(
        """
        import assert from 'node:assert/strict';
        import { renderOptimizerConfigure } from './assets/js/app/pages/optimizer.js';

        const state = {
          context: { company_id: 'empresa1', provider_kind: 'project' },
          ui: {
            route: '#/network/optimizer/configure',
            optimizer_drafts: { '2030': { tax_year: 2030, max_candidates: 4200 } },
            optimizer_presets: [{ preset_id: 'custom_1', name: 'Fiscal 2030' }],
          },
          data: {
            baseline: {
              model: { active_cds: ['CD A', 'CD B'] },
              complements: { scenario_registry: [
                { scenario_type: 'baseline_current', scenario_year: 2026, scenario_name: 'Atual' },
                { scenario_type: 'tax_reform_transition', scenario_year: 2027, scenario_name: 'Reforma 2027' },
                { scenario_type: 'tax_reform_transition', scenario_year: 2030, scenario_name: 'Reforma 2030' },
                { scenario_type: 'tax_reform_full', scenario_year: 2033, scenario_name: 'Reforma 2033' },
                { scenario_type: 'operational', scenario_year: 2030, scenario_name: 'PS7' },
              ] },
            },
            selected_scenario: { changes: { tax_year: 2030, active_cds: ['CD A'] } },
          },
        };
        const html = renderOptimizerConfigure(state);
        assert.match(html, /name="tax_year"/);
        assert.match(html, /value="2030" selected/);
        assert.match(html, /value="4200"/);
        assert.match(html, /Fiscal 2030/);
        assert.match(html, /Perfil do ranking/);
        assert.equal((html.match(/name="custom_preset_select"/g) || []).length, 1);
        assert.ok(html.indexOf('ni-optimizer-presets') < html.indexOf('summary>Configuração técnica'));
        assert.match(html, /data-testid="optimizer-preset-editor"[^>]* hidden/);
        assert.doesNotMatch(html, /ni-optimizer-custom-preset/);
        assert.match(html, /value="2026">2026 · Ano-teste/);
        assert.match(html, /value="2031" selected>2031 · Transição do IBS · 30%/);
        assert.doesNotMatch(html, /PS7/);
        console.log('OPTIMIZER_REFORM_UI_OK');
        """
    )
    assert output.endswith('OPTIMIZER_REFORM_UI_OK')


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
            formValues: { scenario_name: `Reforma tributária ${year}`, tax_mode: `reform_${year}`, tax_year: year },
          });
          assert.equal(scenario.changes.tax_year, year);
          assert.equal(scenario.changes.tax_regime, expected);
          assert.deepEqual(scenario.changes.active_cds, ['CD A']);
        }
        console.log('ANNUAL_TAX_SCENARIOS_OK');
        """
    )
    assert output.endswith('ANNUAL_TAX_SCENARIOS_OK')


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
    dev_console = (APP / 'dev/dev-console.js').read_text(encoding='utf-8')
    shell_source = (APP / 'shell.js').read_text(encoding='utf-8')
    bindings_source = (APP / 'bindings.js').read_text(encoding='utf-8')
    crypto_session = (ROOT / 'assets/js/core/crypto-session.js').read_text(encoding='utf-8')
    export_center = (ROOT / 'assets/js/phase5/export-center.js').read_text(encoding='utf-8')
    assert 'data-demo/empresa_mock' in mock_provider
    assert "import('./providers/mock-provider.js')" in main
    assert "import('./providers/project-provider.js')" in main
    assert "import('../phase5/export-center.js')" in main
    assert 'runDomainScenario' in project_provider
    assert 'runDomainOptimization' in project_provider
    assert 'return assertNoMockLeakage(' in project_provider
    assert 'return assertNoMockLeakage(packageResult' in project_provider
    assert 'let operationId = 0' in main
    assert 'let activeAction = null' in main
    assert "beginAction('scenario'" in main
    assert "beginAction('decision'" in main
    assert 'packageExportsInFlight' in main
    assert 'if (index === 0 && exportInFlight) return;' in main
    assert 'isCurrentOperation(token, companyId, activeProvider)' in main
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

    trust = (APP / 'pages' / 'trust.js').read_text(encoding='utf-8')
    styles = (APP / 'main.css').read_text(encoding='utf-8')
    assert 'auditForPresentation' in trust
    assert 'Fonte protegida (detalhes no pacote de exportação)' in trust
    assert '.network-toast-root' in styles


def test_network_ui_compatibility_and_e2e_hooks():
    index = (ROOT / 'index.html').read_text(encoding='utf-8')
    assert 'assets/js/app/main.js' in index
    for phase in range(1, 6):
        phase_main = (ROOT / f'assets/js/phase{phase}/main.js').read_text(encoding='utf-8')
        assert '!window.__VISAGIO_NETWORK_UI__' in phase_main

    shell = (APP / 'shell.js').read_text(encoding='utf-8')
    expected_ids = [
        'company-selector',
        'scenario-selector',
        'network-shell',
        'network-topbar',
    ]
    for test_id in expected_ids:
        assert f'data-testid="{test_id}"' in shell
    for removed in ('evidence-topbar', 'company-badge', 'runtime-badge', 'ni-avatar'):
        assert removed not in shell
    assert 'aria-live="polite"' not in shell.split('<main')[1].split('</main>')[0]
    assert shell.count('data-section="results"') == 1

    page_sources = '\n'.join(
        (APP / 'pages' / filename).read_text(encoding='utf-8')
        for filename in ('overview.js', 'scenarios.js', 'optimizer.js', 'trust.js', 'results.js')
    )
    for test_id in (
        'page-overview-summary',
        'page-scenarios-build',
        'page-results-summary',
        'page-optimizer-configure',
        'optimizer-ranking',
        'page-trust-validation',
        'saved-scenarios',
        'network-flow-analytics',
        'tax-periods-panel',
        'risk-controls',
        'scenario-save',
        'scenario-export',
        'scenario-import',
        'scenario-clear-saved',
    ):
        assert test_id in page_sources, test_id


if __name__ == '__main__':
    test_app_foundation_contracts()
    test_mock_fixture_isolation_contract()
    test_network_ui_compatibility_and_e2e_hooks()
    print('NETWORK_INTELLIGENCE_APP_CONTRACTS_OK')
