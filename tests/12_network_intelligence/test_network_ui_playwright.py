import contextlib
import http.server
import os
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]


def read_optional_password():
    value = os.environ.get('VISAGIO_DATA_PASSWORD')
    if value:
        return value
    env_file = ROOT / '.env.local'
    if not env_file.exists():
        return None
    for raw_line in env_file.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if line.startswith('VISAGIO_DATA_PASSWORD='):
            return line.split('=', 1)[1].strip().strip('"').strip("'") or None
    return None


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@contextlib.contextmanager
def run_server():
    class ReusableServer(socketserver.TCPServer):
        allow_reuse_address = True

    previous = Path.cwd()
    os.chdir(ROOT)
    server = ReusableServer(('127.0.0.1', 0), QuietHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield server.server_address[1]
    finally:
        server.shutdown()
        server.server_close()
        os.chdir(previous)


def open_details(page, selector):
    page.locator(selector).first.evaluate(
        "el => { for (let parent = el.parentElement; parent; parent = parent.parentElement) { if (parent.tagName === 'DETAILS') parent.open = true; } }"
    )


def test_network_ui_is_the_default_public_entrypoint():
    requested_urls = []
    page_errors = []
    with run_server() as port, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('request', lambda request: requested_urls.append(request.url))
        page.on('pageerror', lambda error: page_errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{port}/', wait_until='networkidle')
        page.locator('#networkAppRoot').wait_for(state='visible')
        page.locator('[data-testid="page-overview-summary"]').wait_for(state='visible')
        assert page.locator('[data-testid="company-selector"]').input_value() == 'empresa_mock'
        assert page.locator('#niLockButton').count() == 1
        assert page.locator('#niLockButton').is_hidden()
        assert (
            page.locator('[data-testid="network-topbar"]').evaluate(
                'element => getComputedStyle(element).backgroundColor'
            )
            == 'rgb(255, 255, 255)'
        )
        assert page.locator('.network-nav-number').all_text_contents() == ['01', '02', '03', '04']
        trust_shortcut = page.locator('.network-trust-shortcut')
        assert trust_shortcut.inner_text() == 'Dados & confiança'
        assert trust_shortcut.get_attribute('href') == '#/network/trust/overview'
        assert page.locator('.network-product strong').inner_text() == 'Network Intelligence'
        assert page.locator('.network-product small').count() == 0
        trust_shortcut.click()
        page.wait_for_function("location.hash === '#/network/trust/overview'")
        page.locator('.network-trust-shortcut.active').wait_for(state='visible')
        assert page.locator('#networkPage').get_attribute('data-route-current') == '#/network/trust/overview'
        assert not any('/assets/js/phase' in url and '/main.js' in url for url in requested_urls)
        assert not page_errors, f'page_errors={page_errors}'
        browser.close()


def test_network_ui_mock_flow():
    console_errors = []
    page_errors = []
    request_failures = []
    request_urls = []

    with run_server() as port, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        page = context.new_page()
        page.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' else None)
        page.on('pageerror', lambda error: page_errors.append(str(error)))
        page.on('requestfailed', lambda request: request_failures.append(request.url))
        page.on('request', lambda request: request_urls.append(request.url))

        base = f'http://127.0.0.1:{port}'
        page.goto(f'{base}/?company=empresa_mock#/network/overview/summary', wait_until='networkidle')
        page.locator('#networkAppRoot').wait_for(state='visible')
        page.locator('[data-testid="page-overview-summary"]').wait_for(state='visible')
        assert page.locator('[data-testid="company-selector"]').input_value() == 'empresa_mock'
        summary = page.locator('[data-testid="page-overview-summary"]')
        assert summary.is_visible()
        assert page.locator('[data-testid="overview-metrics"]').is_visible()
        assert page.locator('[data-testid="evidence-topbar"]').count() == 0
        assert page.locator('[data-testid="company-badge"]').count() == 0
        assert page.locator('[data-testid="runtime-badge"]').count() == 0
        assert page.locator('#sec-diagnostico-baseline').is_hidden()
        assert not any(f'/assets/js/phase{phase}/main.js' in url for phase in range(1, 6) for url in request_urls)
        assert not any('/data/empresa' in url for url in request_urls)

        # The fiscal context in the top selector must open the same draft
        # surface as a regular scenario and must not leave overview charts
        # showing the previous scenario under a different tax year.
        page.locator('[data-testid="scenario-selector"]').select_option('tax-year:2027')
        page.wait_for_function("location.hash === '#/network/scenarios/build'")
        page.locator('[data-testid="page-scenarios-build"]').wait_for(state='visible')
        assert page.locator('[data-testid="scenario-selector"]').input_value() == 'tax-year:2027'
        assert page.locator('input[name="tax_year"]').input_value() == '2027'
        assert 'Alterações pendentes' in page.locator('[data-testid="scenario-draft-status"]').inner_text()
        page.locator('[data-testid="scenario-run"]').click()
        page.locator('[data-testid="page-results-summary"]').wait_for(state='visible', timeout=10000)
        assert page.locator('[data-testid="scenario-selector"]').input_value() == 'tax-year:2027'
        page.evaluate("window.location.hash = '#/network/overview/tax'")
        page.locator('[data-testid="page-overview-tax"]').wait_for(state='visible')
        assert 'ano fiscal 2027' in page.locator('#networkPage').inner_text()

        page.locator('a[data-route="#/network/scenarios/build"]').first.click()
        page.locator('[data-testid="page-scenarios-build"]').wait_for(state='visible')
        assert page.locator('[data-testid="scenario-library"]').is_visible()
        open_details(page, '[data-testid="scenario-load-mock_consolidation"]')
        assert page.locator('[data-testid="scenario-load-mock_consolidation"]').is_visible()
        open_details(page, '[data-testid="scenario-load-mock_consolidation"]')
        page.locator('[data-testid="scenario-load-mock_consolidation"]').click()
        assert page.locator('input[name="scenario_name"]').input_value() == 'Consolidação demonstrativa'
        page.locator('[data-testid="scenario-run"]').click()
        page.locator('[data-testid="page-results-summary"]').wait_for(state='visible', timeout=10000)
        assert 'R$' in page.locator('#networkPage').inner_text()
        assert page.locator('#networkPage h1').inner_text() == 'Resultados do cenário'
        assert page.locator('a[data-section="results"]').get_attribute('aria-current') == 'page'
        assert page.locator('[data-testid="return-to-demo"]').count() == 0
        page.evaluate("window.location.hash = '#/network/overview/summary'")
        page.locator('[data-testid="page-overview-summary"]').wait_for(state='visible')
        page.locator('a[data-route="#/network/overview/network"]').click()
        page.locator('[data-testid="page-overview-network"]').wait_for(state='visible')
        assert page.locator('a[data-section="overview"]').get_attribute('aria-current') == 'page'
        page.evaluate("window.location.hash = '#/network/scenarios/result'")
        page.locator('[data-testid="page-results-summary"]').wait_for(state='visible')
        page.evaluate("location.hash = '#/network/results/risk'")
        page.locator('[data-testid="page-results-risk"]').wait_for(state='visible')
        open_details(page, '[data-testid="risk-controls"]')
        page.locator('[data-testid="risk-run"]').click()
        page.locator('[data-testid="page-results-risk"]').wait_for(state='visible', timeout=10000)
        assert page.locator('#networkPage h1').inner_text() == 'Risco operacional'
        assert page.locator('[data-testid="risk-controls"] input[name="iterations"]').input_value()
        page.evaluate("window.location.hash = '#/network/scenarios/build'")
        open_details(page, '[data-testid="scenario-save"]')
        page.locator('[data-testid="scenario-save"]').click()
        assert page.locator('[data-testid^="saved-scenario-load-"]').count() == 1
        open_details(page, '[data-testid="scenario-export"]')
        page.locator('[data-testid="scenario-export"]').wait_for(state='visible')
        open_details(page, '[data-testid="scenario-clear-saved"]')
        page.locator('[data-testid="scenario-clear-saved"]').click()
        assert page.locator('[data-testid^="saved-scenario-load-"]').count() == 0
        page.locator('[data-testid="scenario-import"]').set_input_files(
            {
                'name': 'imported.json',
                'mimeType': 'application/json',
                'buffer': b'{"scenario_id":"empresa_mock_imported_e2e","scenario_name":"Importado E2E","company_id":"empresa_mock","base_scenario_id":"mock_baseline","changes":{"active_cds":["CD Demo Norte"],"freight_multiplier":1,"demand_multiplier":1,"inventory_days":45,"wacc":0.15,"tax_mode":"current"}}',
            }
        )
        open_details(page, '[data-testid="saved-scenario-load-empresa_mock_imported_e2e"]')
        page.locator('[data-testid="saved-scenario-load-empresa_mock_imported_e2e"]').wait_for(
            state='visible', timeout=5000
        )
        assert page.locator('input[name="scenario_name"]').input_value() == 'Importado E2E'
        page.locator('[data-testid="scenario-import"]').set_input_files(
            {
                'name': 'invalid-company.json',
                'mimeType': 'application/json',
                'buffer': b'{"scenario_id":"wrong-company","scenario_name":"Invalido","company_id":"empresa1","base_scenario_id":"mock_baseline"}',
            }
        )
        page.locator('.network-toast.error', has_text='outra empresa').wait_for(state='visible', timeout=5000)
        open_details(page, '[data-testid="scenario-clear-saved"]')
        page.locator('[data-testid="scenario-clear-saved"]').click()
        assert page.locator('[data-testid^="saved-scenario-load-"]').count() == 0

        page.locator('[data-testid="company-selector"]').select_option('empresa1')
        assert 'company=empresa1' in page.url
        page.locator('#cryptoPasswordInput').fill('senha-incorreta-para-teste')
        page.locator('#cryptoPasswordPrompt button[type="submit"]').click()
        page.locator('#cryptoPasswordPrompt').wait_for(state='visible', timeout=10000)
        assert 'Senha inválida ou dados corrompidos' in page.locator('#cryptoPasswordPrompt').inner_text()
        page.locator('#cryptoCancel').click()
        page.goto(f'{base}/?company=empresa_mock#/network/overview/summary', wait_until='networkidle')

        page.locator('a[data-route="#/network/optimizer/configure"]').first.click()
        page.locator('[data-testid="page-optimizer-configure"]').wait_for(state='visible')
        page.locator('[data-testid="optimizer-run"]').click()
        page.locator('[data-testid="page-optimizer-results"]').wait_for(state='visible', timeout=20000)
        page.evaluate("window.location.hash = '#/network/trust/validation'")
        page.locator('[data-testid="page-trust-validation"]').wait_for(state='visible', timeout=20000)
        assert page.locator('[data-testid="qa-status"]').is_visible()
        assert page.locator('[data-testid="release-status"]').is_visible()
        assert page.locator('#niCompanySelect').input_value() == 'empresa_mock'
        assert page.locator('[data-testid="export-center-panel"]').is_visible()
        with page.expect_download(timeout=10000) as download_info:
            page.locator('[data-testid="export-center"]').click()
        assert download_info.value.suggested_filename == 'empresa_mock_decision_package.json'

        page.goto(f'{base}/?company=empresa_mock#/network/overview/summary', wait_until='networkidle')
        page.locator('[data-testid="page-overview-summary"]').wait_for(state='visible')
        assert page.locator('#networkPage').get_attribute('data-route-current') == '#/network/overview/summary'

        page.goto(
            f'{base}/?dev=1&company=empresa_mock#/network/dev/console',
            wait_until='networkidle',
        )
        page.locator('[data-testid="page-dev-console"]').wait_for(state='visible')
        assert 'Snapshot seguro' in page.locator('#networkPage').inner_text()
        page.goto(
            f'{base}/?dev=1&company=empresa_mock#/network/dev/console?tab=errors',
            wait_until='networkidle',
        )
        page.locator('[data-testid="page-dev-console"]').wait_for(state='visible')
        assert page.locator('#networkPage').get_attribute('data-route-current') == '#/network/dev/console?tab=errors'
        assert 'Console técnico · erros' in page.locator('#networkPage').inner_text()
        assert page.locator('a[data-section="dev"]').get_attribute('aria-current') == 'page'

        context.close()
        browser.close()

    assert not console_errors, console_errors
    assert not page_errors, page_errors
    assert not request_failures, request_failures


def test_network_ui_reference_shell_overview_and_scenario_contracts():
    """Lock the selectors and visible content required by the reference UI.

    The data-testid hooks in this test are intentionally independent of the
    current markup implementation: the test describes the contract the new UI
    must satisfy while preserving the existing end-to-end flow.
    """
    with run_server() as port, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        base = f'http://127.0.0.1:{port}'

        page.goto(
            f'{base}/?company=empresa_mock#/network/overview/summary',
            wait_until='networkidle',
        )
        shell = page.locator('[data-testid="network-shell"]')
        shell.wait_for(state='visible', timeout=5000)
        assert shell.get_attribute('data-runtime') == 'network-intelligence'

        assert shell.locator('[data-testid="runtime-badge"]').count() == 0
        assert shell.locator('[data-testid="evidence-topbar"]').count() == 0
        assert shell.locator('[data-testid="company-badge"]').count() == 0

        page.locator('[data-action="open-help"]').click()
        page.locator('#networkDrawer [data-action="open-styleguide"]').click()
        page.locator('#networkDrawer').wait_for(state='visible')
        assert 'Style guide' in page.locator('#networkDrawer').inner_text()
        page.locator('[data-action="close-drawer"]').first.click()

        page.locator('a[data-route="#/network/overview/network"]').click()
        page.locator('[data-testid="page-overview-network"]').wait_for(state='visible')
        brazil_map = page.locator('[data-testid="brazil-map"]')
        brazil_map.wait_for(state='visible', timeout=5000)
        assert brazil_map.locator('.ni-map-state').count() == 27
        assert 'fluxos com uf' in brazil_map.inner_text().lower()
        brazil_map.locator('.ni-map-state').first.click()
        page.locator('#networkDrawer').wait_for(state='visible')
        assert 'Estado' in page.locator('#networkDrawer').inner_text()
        page.locator('[data-action="close-drawer"]').first.click()

        page.locator('a[data-route="#/network/scenarios/build"]').first.click()
        page.locator('[data-testid="page-scenarios-build"]').wait_for(state='visible')
        scenario_preview = page.locator('[data-testid="scenario-preview"]')
        scenario_preview.wait_for(state='visible', timeout=5000)
        assert scenario_preview.inner_text().strip()

        open_details(page, '[data-testid="scenario-load-mock_consolidation"]')
        page.locator('[data-testid="scenario-load-mock_consolidation"]').click()
        page.locator('[data-testid="scenario-run"]').click()
        page.locator('[data-testid="page-results-summary"]').wait_for(state='visible', timeout=10000)
        page.evaluate("window.location.hash = '#/network/overview/summary'")
        page.locator('[data-testid="page-overview-summary"]').wait_for(state='visible')

        recommendation = page.locator('[data-testid="overview-metrics"]')
        recommendation.wait_for(state='visible', timeout=5000)
        assert recommendation.inner_text().strip()
        assert page.locator('#niOverviewCostCompositionChart').is_visible()

        browser.close()


def test_network_ui_fallback_debug_drawer_and_manual_decision():
    console_errors = []
    page_errors = []
    request_failures = []

    with run_server() as port, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' else None)
        page.on('pageerror', lambda error: page_errors.append(str(error)))
        page.on('requestfailed', lambda request: request_failures.append(request.url))
        base = f'http://127.0.0.1:{port}'

        page.goto(
            f'{base}/?company=empresa_mock#/network/overview/summary',
            wait_until='networkidle',
        )
        page.locator('[data-testid="page-overview-summary"]').wait_for(state='visible')
        assert page.locator('[data-testid="dev-console"]').count() == 0

        page.goto(
            f'{base}/?company=empresa_mock#/network/route-does-not-exist',
            wait_until='networkidle',
        )
        page.locator('[data-testid="page-route-fallback"]').wait_for(state='visible')
        assert 'Rota não encontrada' in page.locator('#networkPage').inner_text()
        page.locator('[data-testid="page-route-fallback"] [data-route]').click()
        page.locator('[data-testid="page-overview-summary"]').wait_for(state='visible')

        page.locator('[data-action="open-help"]').click()
        page.locator('#networkDrawer').wait_for(state='visible')
        styleguide = page.locator('[data-action="open-styleguide"]')
        styleguide.click()
        page.locator('#networkDrawer').wait_for(state='visible')
        assert page.evaluate('document.activeElement?.id') == 'networkDrawerTitle'
        page.keyboard.press('Tab')
        assert page.evaluate('document.querySelector("#networkDrawer").contains(document.activeElement)')
        page.keyboard.press('Escape')
        page.locator('#networkDrawer').wait_for(state='hidden')

        page.goto(
            f'{base}/?company=empresa_mock#/network/optimizer/configure',
            wait_until='networkidle',
        )
        page.locator('[data-testid="page-optimizer-configure"]').wait_for(state='visible')
        open_details(page, 'input[name="max_candidates"]')
        page.locator('input[name="max_candidates"]').fill('0')
        page.locator('[data-testid="optimizer-run"]').click()
        page.locator('[data-testid="page-optimizer-configure"]').wait_for(state='visible')
        assert page.locator('.network-toast.error', has_text='Máximo de candidatos').is_visible()
        open_details(page, 'input[name="max_candidates"]')
        page.locator('input[name="max_candidates"]').fill('1000')
        open_details(page, 'input[name="seed"]')
        page.locator('input[name="seed"]').fill('0')
        open_details(page, 'input[name="min_active_cds"]')
        page.locator('input[name="min_active_cds"]').fill('1')
        open_details(page, 'input[name="max_active_cds"]')
        page.locator('input[name="max_active_cds"]').fill('10')
        page.locator('[data-testid="optimizer-run"]').click()
        page.locator('[data-testid="page-optimizer-results"]').wait_for(state='visible', timeout=20000)
        assert page.locator('[data-testid="page-optimizer-results"]').is_visible()
        assert page.locator('.ni-workspace-config-summary').inner_text().find('Seed da busca') >= 0
        page.locator('.ni-section-tabs a[data-route="#/network/optimizer/tradeoffs"]').click()
        page.locator('[data-testid="page-optimizer-tradeoffs"]').wait_for(state='visible')
        assert page.locator('#niDecisionOptimizerFrontierChart').count() == 1
        page.locator('.ni-section-tabs a[data-route="#/network/optimizer/results"]').click()
        page.locator('[data-testid="page-optimizer-results"]').wait_for(state='visible')
        open_details(page, '[data-testid="manual-scenario-selector"]')
        page.locator('[data-testid="manual-scenario-selector"]').wait_for(state='visible')
        page.locator('[data-action="run-decision-manual"]').click()
        page.locator('[data-testid="page-trust-validation"]').wait_for(state='visible', timeout=20000)
        export_rows = page.locator('[data-testid="export-center-panel"] [data-action="download-export"]')
        assert export_rows.count() >= 1
        with page.expect_download(timeout=10000) as download_info:
            export_rows.first.click()
        assert download_info.value.suggested_filename == 'empresa_mock_decision_package.json'

        page.close()
        browser.close()

    assert not console_errors, console_errors
    assert not page_errors, page_errors
    assert not request_failures, request_failures


def test_network_ui_parity_extensions():
    with run_server() as port, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        base = f'http://127.0.0.1:{port}/?company=empresa_mock'
        page.goto(f'{base}#/network/overview/network', wait_until='networkidle')
        page.locator('[data-testid="network-flow-analytics"]').wait_for(state='visible')
        assert page.locator('#niVolumeByCdChart').count() == 1
        assert page.locator('#niDistanceHistogramChart').count() == 1
        page.goto(f'{base}#/network/overview/tax', wait_until='networkidle')
        page.locator('[data-testid="tax-periods-panel"]').wait_for(state='visible')
        page.locator('#niOverviewTaxCoverageChart').wait_for(state='visible')

        page.goto(f'{base}#/network/optimizer/configure', wait_until='networkidle')
        page.locator('[data-testid="page-optimizer-configure"]').wait_for(state='visible')
        for name in (
            'risk_iterations',
            'risk_seed',
            'risk_profile',
            'risk_scatter_driver',
            'stress_profile',
            'sensitivity_variable',
            'sensitivity_x',
            'sensitivity_y',
        ):
            assert page.locator(f'[name="{name}"]').count() == 1

        page.goto(f'{base}#/network/scenarios/build', wait_until='networkidle')
        open_details(page, '[data-testid="scenario-load-mock_consolidation"]')
        page.locator('[data-testid="scenario-load-mock_consolidation"]').click()
        page.locator('[data-testid="scenario-run"]').click()
        page.locator('[data-testid="page-results-summary"]').wait_for(state='visible', timeout=10000)
        page.locator('[data-route="#/network/results/comparison"]').first.click()
        page.locator('[data-testid="page-results-comparison"]').wait_for(state='visible')
        assert page.locator('.ni-workspace-matrix-wrap').is_visible()
        assert 'Economia ante referência' in page.locator('.ni-workspace-matrix-wrap').inner_text()
        page.evaluate("location.hash = '#/network/results/risk'")
        page.locator('[data-testid="page-results-risk"]').wait_for(state='visible')
        open_details(page, '[data-testid="risk-controls"]')
        page.locator('[data-testid="risk-run"]').click()
        page.locator('[data-testid="page-results-risk"]').wait_for(state='visible', timeout=10000)
        assert page.locator('[data-testid="risk-controls"]').count() == 1
        assert page.locator('#niRiskHistogramChart').count() == 1
        assert page.locator('#niRiskDriversChart').count() == 1
        page.get_by_role('link', name='Ver análise detalhada').click()
        open_details(page, '[data-testid="risk-controls"]')
        page.locator('[data-testid="risk-controls"]').wait_for(state='visible')
        for canvas_id in (
            'niRiskProbabilityChart',
            'niRiskHistogramChart',
            'niRiskTotalChart',
            'niRiskDriversChart',
            'niRiskScatterChart',
        ):
            assert page.locator(f'#{canvas_id}').count() == 1
        page.evaluate("location.hash = '#/network/results/risk'")
        page.locator('[data-testid="page-results-risk"]').wait_for(state='visible')
        page.get_by_role('link', name='Ver análise detalhada').click()
        page.locator('[data-testid="page-results-risk"]').wait_for(state='visible')
        assert page.evaluate('location.hash') == '#/network/results/risk/advanced'
        assert page.locator('#niRiskProbabilityChart').count() == 1
        assert 'Matriz de sensibilidade' in page.locator('#networkPage').inner_text()
        page.evaluate("location.hash = '#/network/scenarios/risk/advanced'")
        page.wait_for_function("location.hash === '#/network/results/risk/advanced'")
        page.locator('[data-testid="page-results-risk"]').wait_for(state='visible')
        assert page.locator('#niRiskProbabilityChart').count() == 1
        assert 'Matriz de sensibilidade' in page.locator('#networkPage').inner_text()
        browser.close()


def test_network_ui_real_tenant_preserves_crypto_boundary():
    with run_server() as port, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()
        base = f'http://127.0.0.1:{port}'
        page.goto(f'{base}/?company=empresa1#/network/overview/summary', wait_until='networkidle')
        page.locator('#networkAppRoot').wait_for(state='visible')
        page.locator('#cryptoPasswordPrompt').wait_for(state='visible', timeout=10000)
        assert page.locator('#cryptoPasswordPrompt').is_visible()
        assert page.locator('#niCompanySelect').input_value() == 'empresa1'
        assert page.locator('[data-testid="company-badge"]').count() == 0
        password = read_optional_password()
        if not password:
            print('NETWORK_UI_REAL_TENANT_SKIPPED: VISAGIO_DATA_PASSWORD ausente')
            page.close()
            browser.close()
            return
        if password:
            page.locator('#cryptoPasswordInput').fill(password)
            page.locator('#cryptoPasswordPrompt button[type="submit"]').click()
            page.locator('#cryptoPasswordPrompt').wait_for(state='detached', timeout=20000)
            page.locator('[data-testid="page-overview-summary"]').wait_for(state='visible', timeout=20000)
            page.evaluate("window.location.hash = '#/network/scenarios/build'")
            page.locator('[data-testid="page-scenarios-build"]').wait_for(state='visible', timeout=20000)
            page.locator('#networkLoadingOverlay').wait_for(state='hidden', timeout=20000)
            open_details(page, 'input[name="freight_multiplier"]')
            page.locator('input[name="freight_multiplier"]').fill('0')
            page.locator('[data-testid="scenario-run"]').click()
            page.locator('[data-testid="page-scenarios-build"]').wait_for(state='visible', timeout=5000)
            assert page.locator('.network-toast.error', has_text='multiplicador de frete').is_visible()
            page.evaluate("window.location.hash = '#/network/optimizer/configure'")
            page.locator('[data-testid="page-optimizer-configure"]').wait_for(state='visible', timeout=20000)
            page.locator('[data-testid="optimizer-run"]').click()
            page.locator('[data-testid="page-optimizer-results"]').wait_for(state='visible', timeout=20000)
            page.evaluate("window.location.hash = '#/network/trust/validation'")
            page.locator('[data-testid="page-trust-validation"]').wait_for(state='visible', timeout=20000)
            page.locator('[data-testid="qa-status"]').wait_for(state='visible', timeout=20000)
            page.locator('summary', has_text='Registro técnico').first.click()
            page.locator('pre.ni-json', has_text='Fonte protegida').wait_for(state='visible', timeout=20000)
            audit_text = page.locator('#networkPage').inner_text()
            assert 'data/empresa1' not in audit_text
            assert 'Fonte protegida (detalhes no pacote de exportação)' in audit_text
            page.evaluate("window.location.hash = '#/network/scenarios/risk'")
            page.locator('[data-testid="page-results-risk"]').wait_for(state='visible', timeout=20000)
            assert page.locator('[data-testid="risk-controls"]').count() == 1
            assert page.locator('#niRiskHistogramChart').count() == 1
            assert page.locator('#niRiskDriversChart').count() == 1
            page.evaluate("window.location.hash = '#/network/scenarios/risk/advanced'")
            page.locator('[data-testid="risk-controls"]').evaluate("form => { form.closest('details').open = true; }")
            page.locator('[data-testid="risk-controls"]').wait_for(state='visible', timeout=20000)
            for canvas_id in (
                'niRiskProbabilityChart',
                'niRiskHistogramChart',
                'niRiskTotalChart',
                'niRiskDriversChart',
                'niRiskScatterChart',
            ):
                chart = page.locator(f'#{canvas_id}')
                chart.wait_for(state='visible', timeout=20000)
                data_table = page.locator(f'#{canvas_id} + .vg-chart-controls + .vg-chart-data')
                data_table.wait_for(state='attached', timeout=20000)
                assert data_table.locator('tbody tr').count() > 0
            page.evaluate("window.location.hash = '#/network/trust/validation'")
            page.locator('[data-testid="page-trust-validation"]').wait_for(state='visible', timeout=20000)
            lock_button = page.locator('#niLockButton')
            assert lock_button.count() == 1
            assert lock_button.is_visible()
            toast = page.locator('.network-toast').last
            if toast.count() and toast.is_visible() and lock_button.is_visible():
                toast_box = toast.bounding_box()
                lock_box = lock_button.bounding_box()
                if toast_box and lock_box:
                    assert not (
                        toast_box['x'] < lock_box['x'] + lock_box['width']
                        and toast_box['x'] + toast_box['width'] > lock_box['x']
                        and toast_box['y'] < lock_box['y'] + lock_box['height']
                        and toast_box['y'] + toast_box['height'] > lock_box['y']
                    )
            with page.expect_navigation(wait_until='networkidle', timeout=20000):
                lock_button.click()
            page.locator('#cryptoPasswordPrompt').wait_for(state='visible', timeout=20000)
            assert page.locator('#cryptoPasswordInput').input_value() == ''
            assert page.locator('#niLockButton').is_visible()
            page.locator('#cryptoCancel').click()
            page.goto(
                f'{base}/?dev=1&company=empresa1#/network/dev/console',
                wait_until='networkidle',
            )
            page.locator('[data-testid="page-dev-console"]').wait_for(state='visible', timeout=20000)
            if page.locator('#cryptoPasswordPrompt').count():
                page.locator('#cryptoCancel').click()
            snapshot_text = page.locator('pre.ni-json').last.inner_text()
            lowered = snapshot_text.lower()
            assert 'baseline' not in lowered
            assert 'core_data' not in lowered
            assert 'flows' not in lowered
            assert 'data/empresa1' not in lowered
            assert password not in snapshot_text
            page.close()
            browser.close()


def test_network_ui_mobile_has_no_horizontal_overflow():
    with run_server() as port, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 390, 'height': 844})
        base = f'http://127.0.0.1:{port}'
        page.goto(
            f'{base}/?company=empresa_mock#/network/overview/network',
            wait_until='networkidle',
        )
        page.locator('[data-testid="brazil-map"]').wait_for(state='visible')
        assert page.evaluate('document.body.scrollWidth <= window.innerWidth + 1')
        assert page.locator('.ni-map-state').count() == 27
        browser.close()


def test_network_ui_reentrant_submissions_and_export_deduplication():
    downloads = []
    with run_server() as port, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('download', lambda download: downloads.append(download))
        base = f'http://127.0.0.1:{port}'
        page.goto(
            f'{base}/?dev=1&company=empresa_mock#/network/scenarios/build',
            wait_until='networkidle',
        )
        page.locator('[data-testid="page-scenarios-build"]').wait_for(state='visible')
        open_details(page, '[data-testid="scenario-load-mock_consolidation"]')
        page.locator('[data-testid="scenario-load-mock_consolidation"]').click()
        page.locator('[data-testid="scenario-form"]').evaluate(
            """form => {
                for (let index = 0; index < 2; index += 1) {
                    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                }
            }"""
        )
        page.locator('[data-testid="page-results-summary"]').wait_for(state='visible', timeout=10000)
        # The simulation toast is cleared when the result route renders, so it
        # cannot linger over the completed result screen.
        assert page.locator('.network-toast', has_text='Cenário simulado pelo provider ativo.').count() == 0

        page.goto(
            f'{base}/?dev=1&company=empresa_mock#/network/optimizer/configure',
            wait_until='networkidle',
        )
        page.locator('[data-testid="page-optimizer-configure"]').wait_for(state='visible')
        page.locator('[data-testid="optimizer-form"]').evaluate(
            """form => {
                for (let index = 0; index < 2; index += 1) {
                    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                }
            }"""
        )
        page.locator('[data-testid="page-optimizer-results"]').wait_for(state='visible', timeout=20000)
        # Route transitions clear completion toasts after the next screen renders.
        assert page.locator('.network-toast', has_text='Pipeline de decisão concluído.').count() == 0

        export_button = page.locator('[data-testid="export-center"]')
        export_button.click()
        export_button.click()
        page.wait_for_timeout(800)
        assert len(downloads) == 1, f'downloads={len(downloads)}'
        page.reload(wait_until='networkidle')
        page.locator('#networkAppRoot').wait_for(state='visible')
        assert page.locator('[data-testid="page-optimizer-results"]').is_visible()
        page.close()
        browser.close()


def test_audit_configuration_identity_and_all_mobile_routes():
    routes = [
        'overview/summary',
        'overview/network',
        'overview/costs',
        'overview/tax',
        'scenarios/build',
        'scenarios/result',
        'scenarios/compare',
        'scenarios/risk',
        'scenarios/risk/advanced',
        'optimizer/configure',
        'optimizer/results',
        'optimizer/tradeoffs',
        'trust/overview',
        'trust/evidence',
        'trust/sources',
        'trust/validation',
        'trust/methodology',
    ]
    with run_server() as port, sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 390, 'height': 844})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(
            f'http://127.0.0.1:{port}/?company=empresa_mock#/network/optimizer/configure', wait_until='networkidle'
        )
        page.locator('input[name="profile_id"][value="cfo"]').check()
        open_details(page, 'input[name="seed"]')
        page.locator('input[name="seed"]').fill('73')
        page.locator('[data-testid="optimizer-run"]').click()
        page.locator('[data-testid="page-optimizer-results"]').wait_for(state='visible', timeout=30000)
        selected = page.locator('[data-testid="scenario-selector"]').input_value()
        assert selected, 'Active candidate must appear in the global selector.'
        route_aliases = {
            'scenarios/result': 'results/summary',
            'scenarios/compare': 'results/comparison',
            'scenarios/risk': 'results/risk',
            'scenarios/risk/advanced': 'results/risk/advanced',
        }
        for route in routes:
            canonical = route_aliases.get(route, route)
            expected_hash = f'#/network/{canonical}'
            page.evaluate('(route) => location.hash = "#/network/" + route', route)
            page.wait_for_function(
                '(expected) => document.querySelector("#networkPage")?.dataset.routeCurrent === expected',
                arg=expected_hash,
            )
            assert page.evaluate('location.hash') == expected_hash
            if route == 'optimizer/results':
                page.locator('[data-testid="page-optimizer-results"]').wait_for(state='visible')
            elif route == 'optimizer/tradeoffs':
                page.locator('[data-testid="page-optimizer-tradeoffs"]').wait_for(state='visible')
            page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
            assert page.locator('[data-testid="scenario-selector"]').input_value() == selected
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), route
            if route == 'optimizer/configure':
                assert page.locator('input[name="profile_id"]:checked').input_value() == 'cfo'
                assert page.locator('input[name="seed"]').input_value() == '73'
        page.evaluate("location.hash = '#/network/scenarios/compare'")
        page.wait_for_function("location.hash === '#/network/results/comparison'")
        page.locator('[data-testid="page-results-comparison"]').wait_for(state='visible')
        matrix = page.locator('.ni-workspace-matrix-wrap')
        if matrix.is_visible():
            comparison_content = matrix.inner_text()
        else:
            cards = page.locator('.ni-results-comparison .ni-comparison-cards')
            assert cards.is_visible()
            comparison_content = cards.inner_text()
        assert 'Custo total' in comparison_content
        assert 'Economia ante referência' in comparison_content
        page.evaluate("location.hash = '#/network/optimizer/results'")
        page.locator('[data-testid="page-optimizer-results"]').wait_for(state='visible')
        page.locator('.ni-section-tabs a[data-route="#/network/optimizer/tradeoffs"]').click()
        page.wait_for_function("location.hash === '#/network/optimizer/tradeoffs'")
        page.locator('[data-testid="page-optimizer-tradeoffs"]').wait_for(state='visible')
        assert page.locator('#niDecisionOptimizerFrontierChart').count() == 1
        page.locator('.ni-section-tabs a[data-route="#/network/optimizer/results"]').click()
        page.locator('[data-testid="page-optimizer-results"]').wait_for(state='visible')
        page.evaluate("location.hash = '#/network/results/summary'")
        page.locator('[data-testid="page-results-summary"]').wait_for(state='visible')
        with page.expect_download(timeout=10000) as download_info:
            page.locator('[data-testid="export-center"]').click()
        assert download_info.value.suggested_filename == 'empresa_mock_decision_package.json'
        assert not errors
        browser.close()


def test_company_load_retry_action():
    with run_server() as port, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()
        attempts = {'count': 0}

        def fail_once(route):
            if route.request.url.endswith('/data-demo/empresa_mock/scenarios.json') and attempts['count'] == 0:
                attempts['count'] += 1
                route.fulfill(status=503, body='temporary failure')
            else:
                route.continue_()

        page.route('**/data-demo/empresa_mock/scenarios.json', fail_once)
        page.goto(f'http://127.0.0.1:{port}/?company=empresa_mock#/network/overview/summary', wait_until='networkidle')
        page.locator('.ni-alert.error').wait_for(state='visible')
        retry = page.locator('[data-action="retry-company"]')
        assert retry.is_visible()
        retry.click()
        page.locator('[data-testid="page-overview-summary"]').wait_for(state='visible', timeout=30000)
        assert attempts['count'] == 1
        assert page.locator('.ni-alert.error').count() == 0
        browser.close()


def test_operational_dashboard_and_disclosed_configuration():
    errors = []
    with run_server() as port, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        for width in (1592, 960, 390):
            context = browser.new_context(viewport={'width': width, 'height': 900})
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            base = f'http://127.0.0.1:{port}/?company=empresa_mock'
            page.goto(base + '#/network/overview/summary', wait_until='networkidle')
            page.locator('[data-testid="overview-metrics"]').wait_for(state='visible')
            assert page.locator('#niEvidenceTopbar, #niCompanyBadge, .ni-runtime-badge').count() == 0
            for chart in ('niOverviewCostCompositionChart', 'niOverviewCostComparisonChart', 'niFlowCountByCdChart'):
                assert page.locator(f'#{chart}').is_visible()
                panel = page.locator(f'#{chart}').locator('..')
                panel.locator('.vg-chart-data > summary').click()
                assert panel.locator('.vg-chart-data tbody tr').count() > 0
            executive_text = page.locator('#networkPage').inner_text().casefold()
            assert all(
                word not in executive_text
                for word in ('confiabilidade', 'robustez', 'evidência', 'evidence', 'não recomendado')
            )
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')

            page.goto(base + '#/network/overview/tax', wait_until='networkidle')
            page.locator('#niOverviewTaxImpactChart').wait_for(state='visible')
            tax_data = page.locator('#niOverviewTaxImpactChart').locator('..').locator('.vg-chart-data')
            tax_data.locator('summary').click()
            assert tax_data.locator('tbody tr').count() == 2
            assert '46.000' in tax_data.inner_text()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')

            page.goto(base + '#/network/scenarios/build', wait_until='networkidle')
            assert page.locator('#networkPage .ni-section-tabs').count() == 0
            assert page.locator('#niScenarioForm details[open]').count() == 0
            assert page.locator('[data-testid="scenario-library"]').get_attribute('open') is None
            page.locator('#niScenarioSelect').select_option('mock_regional_balance')
            page.wait_for_function(
                "document.querySelector('[data-testid=\"scenario-preview\"] h2')?.textContent.includes('Balanceamento regional')"
            )
            open_details(page, 'input[name="active_cds"]')
            assert page.locator('input[name="active_cds"]:checked').count() == 2
            page.locator('[data-action="reset-scenario-draft"]').click()
            open_details(page, 'input[name="active_cds"]')
            assert page.locator('input[name="active_cds"]:checked').count() == 3
            assert page.locator('input[name="active_cds"]').first.is_visible()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')

            page.goto(base + '#/network/optimizer/configure', wait_until='networkidle')
            assert page.locator('#niOptimizerForm details[open]').count() == 0
            page.locator('input[name="profile_id"][value="cfo"]').check()
            page.locator('[data-testid="optimizer-run"]').click()
            page.locator('[data-testid="page-optimizer-results"]').wait_for(state='visible')
            assert page.locator('.network-nav [data-section="optimizer"]').get_attribute('aria-current') == 'page'
            page.get_by_role('link', name='Custo × pontuação', exact=True).click()
            assert page.locator('#niDecisionOptimizerFrontierChart').is_visible()
            assert (
                page.locator('#niDecisionOptimizerFrontierChart').get_attribute('aria-label')
                == 'Custo total × pontuação'
            )
            page.get_by_role('link', name='Resultados', exact=True).click()
            page.locator('[data-testid="page-results-summary"]').wait_for(state='visible')
            assert page.locator('#networkPage [data-testid="optimizer-ranking"]').count() == 0
            assert page.locator('#networkPage [data-route="#/network/results/tradeoffs"]').count() == 0
            page.wait_for_function(
                "() => { const impact = document.querySelector('.ni-results-impact'); return impact && getComputedStyle(impact).display === 'grid'; }"
            )
            impact = page.locator('.ni-results-impact')
            assert impact.evaluate('el => getComputedStyle(el).display') == 'grid'
            assert page.locator('#niDecisionComponentDeltaChart').is_visible()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
            context.close()
        assert not errors, errors
        browser.close()


if __name__ == '__main__':
    test_operational_dashboard_and_disclosed_configuration()
    test_network_ui_is_the_default_public_entrypoint()
    test_network_ui_mock_flow()
    test_network_ui_reference_shell_overview_and_scenario_contracts()
    test_network_ui_parity_extensions()
    test_network_ui_fallback_debug_drawer_and_manual_decision()
    test_network_ui_real_tenant_preserves_crypto_boundary()
    test_network_ui_mobile_has_no_horizontal_overflow()
    test_network_ui_reentrant_submissions_and_export_deduplication()
    test_audit_configuration_identity_and_all_mobile_routes()
    test_company_load_retry_action()
    print('NETWORK_INTELLIGENCE_E2E_OK')
