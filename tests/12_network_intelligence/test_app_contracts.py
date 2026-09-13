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
        import { isKnownRoute, normalizeRoute, parseRoute, replaceCompanyQuery } from './assets/js/app/router.js';
        import { createInitialState, createStateStore, commitProviderSnapshot, getSafeStateSnapshot } from './assets/js/app/state.js';
        import { formatMetric, readMetric } from './assets/js/app/metric-registry.js';

        assert.equal(COMPANY_REGISTRY.empresa1.provider, 'project');
        assert.equal(COMPANY_REGISTRY.empresa2.provider, 'project');
        assert.equal(COMPANY_REGISTRY.empresa_mock.release_policy, 'demo_only');
        assert.throws(() => assertCompanyPolicy('empresa1', { providerKind: 'mock' }));
        assert.equal(normalizeRoute('#/diagnostico-baseline'), '#/network/overview/summary');
        assert.equal(normalizeRoute('#erros'), '#/network/dev/console?tab=errors');
        assert.equal(isKnownRoute('#erros'), true);
        assert.equal(parseRoute('#erros').path, '/network/dev/console');
        const store = createStateStore(createInitialState({ company_id: 'empresa1', default_route: '#/network/overview/summary' }));
        assert.deepEqual(store.getState().data.saved_scenarios, []);
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
        assert provenance.get('synthetic', True) is True, path

    mock_provider = (APP / 'providers/mock-provider.js').read_text(encoding='utf-8')
    project_provider = (APP / 'providers/project-provider.js').read_text(encoding='utf-8')
    main = (APP / 'main.js').read_text(encoding='utf-8')
    dev_console = (APP / 'dev/dev-console.js').read_text(encoding='utf-8')
    crypto_session = (ROOT / 'assets/js/core/crypto-session.js').read_text(encoding='utf-8')
    assert 'data-demo/empresa_mock' in mock_provider
    assert 'runDomainScenario' not in mock_provider
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
    assert 'if (exportInFlight) return;' in main
    assert 'isCurrentOperation(token, companyId, activeProvider)' in main
    assert 'getSafeStateSnapshot(state)' in dev_console
    assert 'snapshot: sanitize(state)' not in dev_console
    assert 'getSafeStateSnapshot' in dev_console
    assert 'const companyId =' in crypto_session
    assert '`${KEY_PREFIX}${companyId}_' in crypto_session

    trust = (APP / 'pages' / 'trust.js').read_text(encoding='utf-8')
    styles = (APP / 'main.css').read_text(encoding='utf-8')
    assert 'auditForPresentation' in trust
    assert 'Fonte protegida (detalhes no pacote de exportação)' in trust
    assert 'body.network-ui-active .network-toast-root' in styles


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
        'evidence-topbar',
        'company-badge',
        'export-center',
        'dev-console',
    ]
    for test_id in expected_ids:
        assert f'data-testid="{test_id}"' in shell

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
        'scenario-save',
        'scenario-export',
        'scenario-import',
        'scenario-clear-saved',
    ):
        assert f'data-testid="{test_id}"' in page_sources


if __name__ == '__main__':
    test_app_foundation_contracts()
    test_mock_fixture_isolation_contract()
    test_network_ui_compatibility_and_e2e_hooks()
    print('NETWORK_INTELLIGENCE_APP_CONTRACTS_OK')
