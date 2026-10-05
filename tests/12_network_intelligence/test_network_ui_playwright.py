"""Product journeys, result provenance, responsive shell and crypto isolation."""

import contextlib
import http.server
import json
import os
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(os.environ.get('VISAGIO_NETWORK_QA_DIR', '/tmp/visagio-network-qa'))


def read_optional_password():
    value = os.environ.get('VISAGIO_DATA_PASSWORD')
    if value:
        return value
    env_file = ROOT / '.env.local'
    if env_file.exists():
        for line in env_file.read_text().splitlines():
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
    os.chdir(Path(os.environ.get('VISAGIO_NETWORK_SERVE_DIR', ROOT)))
    server = ReusableServer(('127.0.0.1', 0), QuietHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield server.server_address[1]
    finally:
        server.shutdown()
        server.server_close()
        os.chdir(previous)


def route(page, path):
    page.evaluate('(hash) => { location.hash = hash; }', f'#/network/{path}')
    page.wait_for_function(
        '(hash) => document.querySelector("#networkPage")?.dataset.routeCurrent === hash', arg=f'#/network/{path}'
    )


def ready(page):
    page.locator('#networkLoadingOverlay').wait_for(state='hidden', timeout=60000)
    page.locator('#niScenarioSelect:not([disabled])').wait_for(timeout=60000)


def open_details(page, selector):
    page.locator(selector).evaluate(
        "el => { for (let p = el.parentElement; p; p = p.parentElement) { if (p.tagName === 'DETAILS') p.open = true; } }"
    )


def simulate(page):
    page.locator('[data-testid="scenario-run"]').click()
    page.locator('[data-testid="page-results-summary"]').wait_for(timeout=60000)
    ready(page)
    assert page.locator('a[data-section="results"]').get_attribute('aria-current') == 'page'
    assert page.locator('#networkPage h1').count() == 1


def optimize(page):
    route(page, 'optimizer/configure')
    page.locator('[data-testid="optimizer-run"]').click()
    page.locator('#networkLoadingOverlay').wait_for(state='hidden', timeout=90000)
    assert page.url.endswith('/network/results/summary'), page.locator('.network-toast').all_text_contents()
    page.locator('[data-testid="page-results-summary"]').wait_for(timeout=90000)
    ready(page)
    assert page.url.endswith('/network/results/summary')


def assert_shell(page):
    assert page.locator('.network-nav > a').all_text_contents() == [
        '01Visão geral',
        '02Simulação',
        '03Otimização',
        '04Resultados',
    ]
    assert page.locator('#networkPage h1').count() == 1
    assert page.locator('#networkPage').get_attribute('aria-live') is None
    for removed in ('evidence-topbar', 'runtime-badge', 'company-badge', 'return-to-demo'):
        assert page.locator(f'[data-testid="{removed}"]').count() == 0
    assert page.locator('#sec-diagnostico-baseline').is_hidden()


def test_demo_journey(base, browser):
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    errors, failures, requests = [], [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('requestfailed', lambda r: failures.append(r.url))
    page.on('request', lambda r: requests.append(r.url))
    page.goto(
        f'{base}/?ui=network-intelligence&company=empresa_mock#/network/overview/summary', wait_until='networkidle'
    )
    ready(page)
    assert_shell(page)
    assert 'Recomendado' not in page.locator('#networkPage').inner_text()
    assert '10/10 fluxos' in page.locator('#networkPage').inner_text()
    assert page.locator('#niDemoBadge').count() == 0
    assert page.locator('#niLockButton').is_hidden()
    assert page.locator('#networkPage').get_by_text('Nível de serviço', exact=True).count() == 0
    assert page.locator('#niScenarioSelect').get_attribute('aria-label') == 'Selecionar cenário ativo'
    year_options = page.locator('#niScenarioSelect option').evaluate_all(
        'options => options.map(o => [o.value, o.textContent.trim(), o.disabled])'
    )
    assert year_options[0] == ['', 'Base atual (2025)', False]
    annual_options = [
        (value, label, disabled) for value, label, disabled in year_options if value.startswith('tax-year:')
    ]
    assert [value for value, _, _ in annual_options] == [f'tax-year:{year}' for year in range(2026, 2034)]
    assert all(not disabled for _, _, disabled in annual_options)
    assert any(
        value == 'mock_consolidation' and 'Consolidação demonstrativa' in label for value, label, _ in year_options
    )
    assert page.locator('.network-tool-link').evaluate('el => getComputedStyle(el).color') != 'rgb(128, 0, 128)'
    reference_cost = page.locator('[data-testid="baseline-total"]').inner_text()
    assert page.locator('#niSummaryCostChart').is_visible()
    assert page.locator('#niSummaryCostChart').get_attribute('aria-label')
    page.set_viewport_size({'width': 1009, 'height': 900})
    tax_summary = page.locator('.ni-tax-summary-list')
    assert tax_summary.count() == 1
    assert tax_summary.evaluate(
        "el => [...el.querySelectorAll('dd')].every(value => value.scrollWidth <= value.clientWidth + 1)"
    )
    route(page, 'overview/tax')
    assert page.locator('.ni-tax-overview-metrics > .ni-kpi').count() == 3
    assert '10 fluxos · sintética' in page.locator('.ni-tax-overview-metrics').inner_text()
    assert 'não representa apuração fiscal' in page.locator('#networkPage').inner_text()
    assert page.locator('#networkPage').get_by_text('Uso dos dados', exact=True).count() == 0
    assert page.locator('.ni-tax-overview-metrics').evaluate('el => el.scrollWidth <= el.clientWidth + 1')
    page.set_viewport_size({'width': 1440, 'height': 900})
    route(page, 'overview/costs')
    assert page.locator('#niCostChart').is_visible()
    assert page.locator('#niCostChart').get_attribute('aria-label')
    route(page, 'results/summary')
    assert page.locator('[data-testid="optimizer-ranking"] tbody tr').count() == 0
    assert page.locator('[data-action="open-export"]').count() == 0
    assert page.locator('#networkPage a[data-route="#/network/scenarios/build"]').count() == 0
    assert page.locator('#networkPage a[data-route="#/network/optimizer/configure"]').count() == 0
    route(page, 'results/comparison')
    assert page.locator('#niComparisonCostChart').count() == 0
    page.set_viewport_size({'width': 390, 'height': 844})
    assert page.locator('.ni-comparison-card').is_visible()
    assert page.locator('.ni-comparison-card h2').first.inner_text() == 'Referência'
    page.set_viewport_size({'width': 1440, 'height': 900})
    route(page, 'scenarios/build')
    # Selection loads a preset without silently calculating it; all original CDs remain available.
    page.locator('#niScenarioSelect').select_option('mock_consolidation')
    assert page.locator('input[name="scenario_name"]').input_value() == 'Consolidação demonstrativa'
    assert page.locator('input[name="active_cds"]').count() == 3
    assert page.locator('input[name="active_cds"]').first.bounding_box()['width'] <= 24
    assert page.locator('input[name="active_cds"]').first.locator('..').bounding_box()['height'] >= 44
    assert page.locator('input[name="active_cds"]:checked').count() == 1
    assert page.locator('[data-testid="scenario-preview"]').count() == 0
    operational_freight = page.locator('input[name="freight_multiplier"]').input_value()
    page.locator('#niScenarioSelect').select_option('tax-year:2031')
    route(page, 'scenarios/build')
    assert page.locator('input[name="scenario_name"]').input_value() == 'Consolidação demonstrativa · 2031'
    assert page.locator('input[name="freight_multiplier"]').input_value() == operational_freight
    assert page.locator('input[name="tax_year"]').input_value() == '2031'
    assert page.locator('[data-testid="active-tax-regime"]').inner_text() == 'Transição 2031'
    route(page, 'optimizer/configure')
    assert page.locator('[data-testid="optimizer-tax-context"]').inner_text() == '2031 · Transição 2031'
    assert page.locator('input[name="tax_year"]').input_value() == '2031'
    route(page, 'scenarios/build')
    page.locator('#niScenarioSelect').select_option('')
    assert page.locator('input[name="active_cds"]:checked').count() == 3
    page.locator('input[name="freight_multiplier"]').fill('1.18')
    route(page, 'overview/summary')
    assert page.locator('[data-testid="baseline-total"]').inner_text() == reference_cost
    route(page, 'scenarios/build')
    assert page.locator('input[name="freight_multiplier"]').input_value() == '1.18'
    assert page.locator('#niDraftBadge').is_visible()
    page.locator('input[name="freight_multiplier"]').fill('0')
    page.locator('[data-testid="scenario-run"]').click()
    page.locator('.network-toast.error', has_text='multiplicador de frete').wait_for()
    page.locator('input[name="freight_multiplier"]').fill('1.18')
    simulate(page)
    cost_a = page.locator('[data-testid="result-total"]').inner_text()
    route(page, 'scenarios/build')
    page.locator('input[name="freight_multiplier"]').fill('1.38')
    route(page, 'results/summary')
    assert page.locator('[data-testid="result-total"]').count() == 0
    route(page, 'scenarios/build')
    simulate(page)
    assert page.locator('[data-testid="result-total"]').inner_text() != cost_a
    # Run one optimization after a simulation and compare both saved executions together.
    route(page, 'optimizer/configure')
    open_details(page, 'input[name="max_candidates"]')
    page.locator('input[name="max_candidates"]').fill('100')
    page.locator('input[name="risk_iterations"]').fill('50')
    page.locator('[data-testid="optimizer-run"]').click()
    page.locator('[data-testid="optimizer-ranking"] tbody tr').first.wait_for(timeout=90000)
    route(page, 'results/comparison')
    comparison_text = page.locator('#networkPage').inner_text()
    assert 'Referência' in comparison_text
    assert 'Simulação ·' in comparison_text
    assert 'Otimização ·' in comparison_text
    assert page.locator('#niComparisonCostChart').is_visible()
    column_headers = page.locator('.ni-workspace-matrix thead th').all_text_contents()
    assert column_headers[1].startswith('Referência')
    assert column_headers[2].startswith('Simulação ·')
    assert column_headers[3].startswith('Otimização ·')
    assert page.locator('[data-action="select-compared-scenario"][data-scenario-id^="saved-"]').count() == 0
    route(page, 'results/summary')
    assert page.locator('[data-testid="decision-blocked"]').count() == 0
    route(page, 'scenarios/build')
    open_details(page, '[data-testid="scenario-save"]')
    page.locator('[data-testid="scenario-save"]').click()
    assert page.locator('#niScenarioSelect option[value^="tax-year:"]').count() == 8
    with page.expect_download() as download:
        page.locator('[data-testid="scenario-export"]').click()
    saved = json.loads(Path(download.value.path()).read_text())
    assert saved['company_id'] == 'empresa_mock'
    imported = {**saved, 'scenario_id': 'empresa_mock_import_test', 'scenario_name': 'Importação de teste'}
    page.locator('[data-testid="scenario-import"]').set_input_files(
        {'name': 'scenario.json', 'mimeType': 'application/json', 'buffer': json.dumps(imported).encode()}
    )
    page.locator('input[name="scenario_name"]').wait_for()
    assert page.locator('input[name="scenario_name"]').input_value() == 'Importação de teste'
    wrong = {**imported, 'company_id': 'empresa1'}
    open_details(page, '[data-testid="scenario-import"]')
    page.locator('[data-testid="scenario-import"]').set_input_files(
        {'name': 'wrong.json', 'mimeType': 'application/json', 'buffer': json.dumps(wrong).encode()}
    )
    page.locator('.network-toast.error', has_text='outra empresa').wait_for()
    page.locator('#niScenarioSelect').select_option('mock_regional_balance')
    assert page.locator('input[name="active_cds"]:checked').count() == 2
    page.locator('#niScenarioSelect').select_option('')
    assert page.locator('input[name="active_cds"]:checked').count() == 3
    assert page.locator('input[name="freight_multiplier"]').input_value() == '1'
    route(page, 'optimizer/configure')
    assert not page.locator('input[name="max_candidates"]').is_visible()
    assert page.locator('select[name="custom_preset_select"]').count() == 1
    assert page.locator('select[name="custom_preset_select"]').is_disabled()
    page.locator('input[name="profile_id"][value="fiscal"]').check()
    open_details(page, 'input[name="max_candidates"]')
    assert page.locator('input[name="max_candidates"]').input_value() == '5000'
    assert page.locator('input[name="risk_iterations"]').input_value() == '600'
    page.evaluate('localStorage.removeItem("visagio_optimization_presets_v1")')
    page.locator('[data-action="open-optimizer-preset-save"]').click()
    page.locator('input[name="custom_preset_name"]').fill('Fiscal de teste')
    page.locator('[data-action="save-optimizer-preset"]').click()
    saved_presets = page.locator('select[name="custom_preset_select"]')
    assert saved_presets.is_enabled()
    saved_preset_id = saved_presets.input_value()
    assert saved_preset_id
    saved_in_browser = page.evaluate(
        'id => JSON.parse(localStorage.getItem("visagio_optimization_presets_v1") || "[]").some(p => p.preset_id === id)',
        saved_preset_id,
    )
    saved_storage_value = page.evaluate('localStorage.getItem("visagio_optimization_presets_v1")')
    assert saved_in_browser, f'saved preset missing from local storage: {saved_storage_value}'
    page.locator('input[name="max_candidates"]').fill('1000')
    saved_presets.select_option('')
    saved_presets.select_option(saved_preset_id)
    assert page.locator('input[name="max_candidates"]').input_value() == '5000'
    assert page.locator('input[name="risk_iterations"]').input_value() == '600'
    assert page.locator('#optimizerPresetEditor').is_hidden()
    page.reload(wait_until='networkidle')
    ready(page)
    saved_presets = page.locator('select[name="custom_preset_select"]')
    assert saved_presets.locator(f'option[value="{saved_preset_id}"]').count() == 1
    saved_presets.select_option(saved_preset_id)
    open_details(page, 'input[name="max_candidates"]')
    assert page.locator('input[name="max_candidates"]').input_value() == '5000'
    open_details(page, 'input[name="max_candidates"]')
    page.locator('input[name="max_candidates"]').fill('0')
    page.locator('[data-testid="optimizer-run"]').click()
    page.locator('.network-toast.error', has_text='Máximo de candidatos').wait_for()
    page.locator('input[name="max_candidates"]').fill('100')
    page.locator('input[name="risk_iterations"]').fill('50')
    page.locator('input[name="max_active_cds"]').fill('3')
    page.locator('[data-testid="optimizer-run"]').click()
    page.locator('[data-testid="optimizer-ranking"]').wait_for(timeout=90000)
    ready(page)
    rows = page.locator('[data-testid="optimizer-ranking"] tbody tr')
    assert rows.count() >= 1
    assert 'Economia ante a referência' in page.locator('.ni-results-impact').inner_text()
    assert 'Tributos' in page.locator('.ni-results-reference').inner_text()
    for text in rows.all_text_contents():
        assert 'R$' in text, text
    # Actual candidate selection must survive the complete decision pipeline.
    selector = page.locator('[data-testid="manual-scenario-selector"]')
    open_details(page, '[data-testid="manual-scenario-selector"]')
    options = selector.locator('option').evaluate_all('options => options.map(o => ({id:o.value,name:o.textContent}))')
    selected = options[-1]
    selector.select_option(selected['id'])
    page.locator('[data-action="run-decision-manual"]').click()
    ready(page)
    assert page.locator('#niScenarioSelect option[value^="tax-year:"]').count() == 8
    assert selected['name'] in page.locator('#networkPage').inner_text()
    open_details(page, '[data-action="open-export"]')
    with page.expect_download() as download:
        page.locator('[data-action="open-export"]').first.click()
    decision = json.loads(Path(download.value.path()).read_text())
    assert decision['company_id'] == 'empresa_mock'
    assert decision['selected_scenario']['scenario_id'] == selected['id']
    route(page, 'results/risk')
    assert page.locator('#niRiskHistogramChart').count() == 1
    route(page, 'results/risk/advanced')
    assert page.locator('#niRiskHistogramChart').count() == 1
    assert page.locator('[data-testid="sensitivity-matrix"] tbody tr').count() == 3
    open_details(page, '#niRiskForm')
    page.locator('#niRiskForm input[name="iterations"]').fill('100')
    page.locator('#niRiskForm select[name="profile"]').select_option('broad')
    route(page, 'results/summary')
    route(page, 'results/risk/advanced')
    open_details(page, '#niRiskForm')
    assert page.locator('#niRiskForm input[name="iterations"]').input_value() == '100'
    assert page.locator('#niRiskForm select[name="profile"]').input_value() == 'broad'
    page.locator('[data-testid="risk-run"]').click()
    ready(page)
    page.locator('#niRiskHistogramChart').wait_for()
    for section in (
        'overview/network',
        'overview/costs',
        'overview/tax',
        'results/comparison',
        'results/tradeoffs',
        'trust/overview',
        'trust/evidence',
        'trust/sources',
        'trust/validation',
        'trust/methodology',
    ):
        route(page, section)
        assert page.locator('#networkPage h1').count() == 1, section
        assert page.locator('.ni-alert.error').count() == 0, section
        if section == 'results/comparison':
            chart = page.locator('#niComparisonCostChart')
            assert chart.count() == 1
            assert chart.evaluate(
                "canvas => { const ctx = canvas.getContext('2d'); return canvas.width > 0 && canvas.height > 0 && ctx.getImageData(2, 2, 1, 1).data[3] > 0; }"
            )
            assert page.locator('.ni-workspace-matrix thead th').first.inner_text() == 'Indicador'
            assert page.locator('.ni-workspace-matrix thead th').nth(1).inner_text() != 'ReferênciaReferência'
            page.set_viewport_size({'width': 390, 'height': 844})
            page.wait_for_timeout(120)
            assert page.locator('.ni-comparison-cards').is_visible()
            assert page.locator('.ni-workspace-matrix-wrap').is_hidden()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            assert page.locator('#niComparisonCostChart').evaluate('canvas => canvas.width < 400')
            page.set_viewport_size({'width': 1440, 'height': 900})
    route(page, 'scenarios/build')
    page.locator('input[name="demand_multiplier"]').fill('1.2')
    route(page, 'trust/validation')
    assert page.locator('[data-action="download-export"]').count() == 0
    assert page.locator('[data-testid="qa-status"]').count() == 0
    # Compatibility aliases retain the parent nav and normalize the visible hash.
    page.evaluate("location.hash = '#/network/optimizer/results'")
    page.wait_for_function("location.hash === '#/network/results/summary'")
    assert page.locator('a[data-section="results"]').get_attribute('aria-current') == 'page'
    page.reload(wait_until='networkidle')
    ready(page)
    assert page.locator('[data-testid="result-total"]').count() == 0
    assert page.locator('#niScenarioSelect').input_value() == ''
    assert not any('/data/empresa' in url for url in requests)
    assert not any(f'/assets/js/phase{n}/main.js' in url for n in range(1, 6) for url in requests)
    assert not errors, errors
    assert not failures, failures
    page.close()


def test_accessibility_responsive_and_failures(base, browser):
    page = browser.new_page()
    page.goto(
        f'{base}/?ui=network-intelligence&company=empresa_mock#/network/overview/network', wait_until='networkidle'
    )
    ready(page)
    for width in (1440, 1024, 768, 390, 360):
        page.set_viewport_size({'width': width, 'height': 900})
        assert page.evaluate('document.body.scrollWidth <= innerWidth + 1'), width
        if width <= 768:
            assert page.locator('.network-topbar').bounding_box()['height'] < 220
            for link in page.locator('.network-nav > a').all():
                box = link.bounding_box()
                assert box['x'] >= 0 and box['x'] + box['width'] <= width + 1
        OUT.mkdir(exist_ok=True, parents=True)
        page.screenshot(path=str(OUT / f'network-{width}.png'), full_page=True)
    assert page.locator('.ni-map-state').count() == 27
    for link in page.locator('.network-nav a').all():
        link.focus()
        assert link.evaluate('el => el === document.activeElement')
    page.locator('[data-action="open-help"]').click()
    assert page.evaluate('document.activeElement.id') == 'networkDrawerTitle'
    page.keyboard.press('Tab')
    assert page.evaluate('document.querySelector("#networkDrawer").contains(document.activeElement)')
    page.keyboard.press('Escape')
    assert page.locator('#networkDrawer').is_hidden()
    assert page.locator('[data-action="open-help"]').evaluate('el => el === document.activeElement')
    page.goto(f'{base}/?ui=network-intelligence&company=empresa_mock#/network/unknown', wait_until='networkidle')
    assert page.locator('[data-testid="page-route-fallback"]').is_visible()
    page.locator('[data-testid="page-route-fallback"] a').click()
    assert page.locator('[data-testid="page-overview-summary"]').is_visible()
    page.goto(f'{base}/?ui=network-intelligence&dev=1&company=empresa_mock#erros', wait_until='networkidle')
    assert page.locator('[data-testid="page-dev-console"]').is_visible()
    snapshot = page.locator('pre.ni-json').last.inner_text()
    assert 'core_data' not in snapshot and 'data/empresa1' not in snapshot
    page.route('**/data-demo/empresa_mock/scenarios.json', lambda r: r.fulfill(status=503, body='unavailable'))
    page.reload(wait_until='networkidle')
    page.locator('.ni-alert.error').wait_for()
    assert page.locator('#niScenarioSelect').is_disabled()
    page.close()


def test_reentrancy_and_company_race(base, browser):
    page = browser.new_page()
    source = (ROOT / 'assets/js/app/providers/mock-provider.js').read_text()
    instrumented = source.replace(
        "return assertProviderContract(provider, 'mock');",
        """for (const name of ['runScenario', 'buildDecisionPackage']) {
          const original = provider[name].bind(provider);
          provider[name] = async (...args) => {
            window.__qaCalls = window.__qaCalls || {};
            window.__qaCalls[name] = (window.__qaCalls[name] || 0) + 1;
            await new Promise(resolve => setTimeout(resolve, 180));
            return original(...args);
          };
        }
        return assertProviderContract(provider, 'mock');""",
    )
    page.route(
        '**/assets/js/app/providers/mock-provider.js',
        lambda r: r.fulfill(status=200, content_type='application/javascript', body=instrumented),
    )
    page.goto(
        f'{base}/?ui=network-intelligence&company=empresa_mock#/network/scenarios/build', wait_until='networkidle'
    )
    ready(page)
    page.locator('#niScenarioForm').evaluate(
        "form => { for (let i=0;i<2;i++) form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); }"
    )
    page.locator('[data-testid="result-total"]').wait_for(timeout=60000)
    assert page.evaluate('window.__qaCalls.runScenario') == 1
    route(page, 'optimizer/configure')
    open_details(page, 'input[name="max_candidates"]')
    page.locator('input[name="max_candidates"]').fill('100')
    page.locator('input[name="risk_iterations"]').fill('50')
    page.locator('#niOptimizerForm').evaluate(
        "form => { for (let i=0;i<2;i++) form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); }"
    )
    page.locator('[data-testid="optimizer-ranking"]').wait_for(timeout=90000)
    ready(page)
    assert page.evaluate('window.__qaCalls.buildDecisionPackage') == 1
    downloads = []
    page.on('download', lambda d: downloads.append(d))
    open_details(page, '[data-action="open-export"]')
    page.locator('[data-action="open-export"]').first.evaluate('button => { button.click(); button.click(); }')
    page.wait_for_timeout(800)
    assert len(downloads) == 1
    route(page, 'scenarios/build')
    page.locator('#niScenarioForm').evaluate(
        "form => form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))"
    )
    page.locator('#niCompanySelect').select_option('empresa1')
    page.locator('#cryptoPasswordInput').wait_for(timeout=20000)
    page.wait_for_timeout(300)
    assert page.locator('#niCompanySelect').input_value() == 'empresa1'
    assert page.locator('[data-testid="result-total"]').count() == 0
    assert page.locator('#niScenarioSelect').is_disabled()
    page.locator('#cryptoCancel').click()
    page.locator('.ni-alert.error').wait_for()
    page.close()


def test_real_tenants(base, browser):
    password = read_optional_password()
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    page.goto(f'{base}/?ui=network-intelligence&company=empresa1#/network/overview/summary', wait_until='networkidle')
    page.locator('#cryptoPasswordInput').wait_for(timeout=20000)
    assert page.locator('#networkLoadingOverlay').is_hidden()
    page.locator('#cryptoPasswordInput').fill('wrong-test-password')
    page.locator('#cryptoPasswordPrompt button[type="submit"]').click()
    page.locator('#cryptoPromptError:not([hidden])').wait_for(timeout=20000)
    if not password:
        print('NETWORK_REAL_INTERNAL_NOT_VERIFIED: access phrase unavailable')
        page.locator('#cryptoCancel').click()
        page.close()
        return
    for company in ('empresa1', 'empresa2'):
        if company == 'empresa2':
            page.locator('#niCompanySelect').select_option(company)
            page.locator('#cryptoPasswordInput').wait_for(timeout=20000)
        page.locator('#cryptoPasswordInput').fill(password)
        page.locator('#cryptoPasswordPrompt button[type="submit"]').click()
        ready(page)
        assert page.locator('#niCompanySelect').input_value() == company
        assert page.locator('#niScenarioSelect').input_value() == ''
        assert page.locator('#niDemoBadge').count() == 0
        assert page.locator('#niLockButton').is_visible()
        if page.locator('#niScenarioSelect option[value="tax-year:2031"]').is_enabled():
            page.locator('#niScenarioSelect').select_option('tax-year:2031')
            assert page.locator('input[name="scenario_name"]').input_value() == 'Reforma tributária 2031'
            assert page.locator('[data-testid="active-tax-regime"]').inner_text() == 'Transição 2031'
            simulate(page)
            page.locator('#niScenarioSelect').select_option('')
        route(page, 'scenarios/build')
        page.locator('input[name="freight_multiplier"]').fill('1.15')
        simulate(page)
        assert 'R$' in page.locator('[data-testid="result-total"]').inner_text()
        route(page, 'optimizer/configure')
        open_details(page, 'input[name="max_candidates"]')
        assert page.locator('[data-testid="optimizer-tax-scenario"]').count() == 0
        assert page.locator('[data-testid="optimizer-tax-context"]').inner_text() == 'Base atual · 2025'
        page.locator('input[name="max_candidates"]').fill('100')
        page.locator('input[name="risk_iterations"]').fill('50')
        optimize(page)
        assert page.locator('[data-testid="optimizer-ranking"] tbody tr').count() > 0
        route(page, 'trust/validation')
        open_details(page, 'pre.ni-json')
        text = page.locator('#networkPage').inner_text()
        assert 'data/empresa' not in text and 'synthetic_fixture' not in text
        assert 'Fonte protegida' in text
        assert page.evaluate(
            "!Object.keys(localStorage).concat(Object.keys(sessionStorage)).some(k => k.startsWith('visagio_crypto_'))"
        )
    page.locator('#niCompanySelect').select_option('empresa_mock')
    ready(page)
    route(page, 'results/summary')
    assert page.locator('[data-testid="result-total"]').count() == 0
    assert page.locator('[data-testid="optimizer-ranking"] tbody tr').count() == 0
    page.locator('#niCompanySelect').select_option('empresa2')
    page.locator('#cryptoPasswordInput').wait_for(timeout=20000)
    page.locator('#cryptoCancel').click()
    page.locator('.ni-alert.error').wait_for()
    page.close()


if __name__ == '__main__':
    with run_server() as port, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        base = f'http://127.0.0.1:{port}'
        test_demo_journey(base, browser)
        test_accessibility_responsive_and_failures(base, browser)
        test_reentrancy_and_company_race(base, browser)
        test_real_tenants(base, browser)
        browser.close()
    print('NETWORK_INTELLIGENCE_E2E_OK')
