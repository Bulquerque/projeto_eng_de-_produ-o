import contextlib
import http.server
import json
import os
import socketserver
import tempfile
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(os.environ.get('VISAGIO_E2E_OUTPUT_DIR', tempfile.mkdtemp(prefix='visagio-presentation-e2e-')))
DEMO = '/?company=empresa_mock'


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@contextlib.contextmanager
def run_server():
    class ReusableServer(socketserver.TCPServer):
        allow_reuse_address = True

    old_cwd = Path.cwd()
    os.chdir(ROOT)
    server = ReusableServer(('127.0.0.1', 0), QuietHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield server.server_address[1]
    finally:
        server.shutdown()
        server.server_close()
        os.chdir(old_cwd)


def open_page(context, base_url: str, route: str, request_urls, console_errors, page_errors):
    page = context.new_page()
    page.on('request', lambda request: request_urls.append(request.url))
    page.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' else None)
    page.on('pageerror', lambda error: page_errors.append(str(error)))
    response = page.goto(f'{base_url}{DEMO}{route}', wait_until='networkidle', timeout=30000)
    assert response and response.ok, route
    page.locator('#networkAppRoot').wait_for(state='visible', timeout=10000)
    return page


def save_screenshot(page, name: str):
    OUT.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(OUT / f'{name}.png'), full_page=True)


def assert_no_horizontal_overflow(page):
    overflow = page.evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth + 1')
    assert not overflow, {
        'client_width': page.evaluate('document.documentElement.clientWidth'),
        'scroll_width': page.evaluate('document.documentElement.scrollWidth'),
    }


def test_presentation_flow_playwright():
    report = []
    request_urls = []
    console_errors = []
    page_errors = []

    with run_server() as port, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        desktop = browser.new_context(viewport={'width': 1440, 'height': 1000}, device_scale_factor=1)
        base_url = f'http://127.0.0.1:{port}'

        page = open_page(
            desktop,
            base_url,
            '#/network/overview/summary',
            request_urls,
            console_errors,
            page_errors,
        )
        page.locator('[data-testid="page-overview-summary"]').wait_for(state='visible')
        assert 'Visão executiva' in page.locator('#networkPage h1').inner_text()
        assert page.locator('[data-testid="overview-metrics"]').is_visible()
        save_screenshot(page, '01_home_desktop')
        report.append({'step': 'home', 'status': 'ok'})

        page.goto(f'{base_url}{DEMO}#/network/overview/network', wait_until='networkidle')
        page.locator('[data-testid="page-overview-network"]').wait_for(state='visible')
        page.locator('[data-testid="network-flow-analytics"]').wait_for(state='visible')
        assert page.locator('#niVolumeByCdChart').count() == 1
        assert page.locator('#niDistanceHistogramChart').count() == 1
        assert page.locator('[data-testid="brazil-map"] .ni-map-state').count() == 27
        save_screenshot(page, '02_network_desktop')
        report.append({'step': 'network', 'status': 'ok'})

        page.goto(f'{base_url}{DEMO}#/network/scenarios/build', wait_until='networkidle')
        page.locator('[data-testid="page-scenarios-build"]').wait_for(state='visible')
        page.locator('[data-testid="scenario-library"] > summary').click()
        page.locator('[data-testid="scenario-load-mock_consolidation"]').click()
        page.locator('[data-testid="scenario-run"]').click()
        page.locator('[data-testid="page-results-summary"]').wait_for(state='visible', timeout=15000)
        page.wait_for_function("location.hash === '#/network/results/summary'")
        assert page.locator('#networkPage h1').inner_text() == 'Resultados do cenário'
        summary_content = page.locator('[data-testid="page-results-summary"]').inner_text()
        page.evaluate("window.location.hash = '#/network/scenarios/result'")
        page.wait_for_function("location.hash === '#/network/results/summary'")
        page.locator('[data-testid="page-results-summary"]').wait_for(state='visible')
        assert page.locator('[data-testid="page-results-summary"]').inner_text() == summary_content
        page.evaluate("window.location.hash = '#/network/scenarios/compare'")
        page.wait_for_function("location.hash === '#/network/results/comparison'")
        page.locator('[data-testid="page-results-comparison"]').wait_for(state='visible')
        comparison_chart = page.locator('#niComparisonCostChart')
        assert comparison_chart.is_visible()
        chart_data = page.locator('#niComparisonCostChart + .vg-chart-controls + .vg-chart-data')
        chart_data.locator('summary').click()
        assert chart_data.locator('tbody tr').count() >= 2
        save_screenshot(page, '03_scenario_compare_desktop')
        report.append({'step': 'scenario_compare', 'status': 'ok'})

        page.evaluate("window.location.hash = '#/network/scenarios/risk'")
        page.wait_for_function("location.hash === '#/network/results/risk'")
        page.locator('[data-testid="page-results-risk"]').wait_for(state='visible')
        page.locator('[data-testid="risk-controls"]').evaluate("form => { form.closest('details').open = true; }")
        page.locator('[data-testid="risk-run"]').click()
        page.locator('[data-testid="page-results-risk"]').wait_for(state='visible', timeout=15000)
        assert page.locator('#niRiskHistogramChart').count() == 1
        assert page.locator('#niRiskDriversChart').count() == 1
        save_screenshot(page, '04_scenario_risk_desktop')
        report.append({'step': 'scenario_risk', 'status': 'ok'})

        page.evaluate("window.location.hash = '#/network/optimizer/configure'")
        page.locator('[data-testid="page-optimizer-configure"]').wait_for(state='visible')
        page.locator('[data-testid="optimizer-run"]').click()
        page.locator('[data-testid="page-optimizer-results"]').wait_for(state='visible', timeout=30000)
        page.wait_for_function("location.hash === '#/network/optimizer/results'")
        page.evaluate("window.location.hash = '#/network/trust/validation'")
        page.locator('[data-testid="page-trust-validation"]').wait_for(state='visible', timeout=30000)
        assert page.locator('[data-testid="qa-status"]').is_visible()
        assert page.locator('[data-testid="release-status"]').is_visible()
        assert page.locator('#niCompanySelect').input_value() == 'empresa_mock'
        save_screenshot(page, '05_validation_desktop')
        report.append({'step': 'validation', 'status': 'ok'})

        page.evaluate("window.location.hash = '#/network/optimizer/results'")
        page.wait_for_function("location.hash === '#/network/optimizer/results'")
        page.locator('[data-testid="page-optimizer-results"]').wait_for(state='visible')
        assert page.locator('[data-testid="optimizer-ranking"]').is_visible()
        page.evaluate("window.location.hash = '#/network/optimizer/tradeoffs'")
        page.wait_for_function("location.hash === '#/network/optimizer/tradeoffs'")
        page.locator('[data-testid="page-optimizer-tradeoffs"]').wait_for(state='visible')
        assert page.locator('#niDecisionOptimizerFrontierChart').is_visible()
        assert 'Custo total' in page.locator('.ni-workspace-chart-card').inner_text()
        assert page.locator(
            '.ni-workspace-tradeoff-table h2', has_text='Alternativas mais bem classificadas'
        ).is_visible()
        save_screenshot(page, '06_optimizer_tradeoffs_desktop')
        report.append({'step': 'optimizer_tradeoffs', 'status': 'ok'})
        page.close()
        desktop.close()

        mobile = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
        page = open_page(
            mobile,
            base_url,
            '#/network/scenarios/build',
            request_urls,
            console_errors,
            page_errors,
        )
        page.locator('[data-testid="scenario-library"] > summary').click()
        page.locator('[data-testid="scenario-load-mock_consolidation"]').click()
        page.locator('[data-testid="scenario-run"]').click()
        page.locator('[data-testid="page-results-summary"]').wait_for(state='visible', timeout=15000)
        page.wait_for_function("location.hash === '#/network/results/summary'")
        assert_no_horizontal_overflow(page)
        save_screenshot(page, 'mobile_scenario')
        report.append({'step': 'mobile_scenario', 'status': 'ok'})
        mobile.close()
        browser.close()

    assert not console_errors, json.dumps(console_errors, ensure_ascii=False, indent=2)
    assert not page_errors, json.dumps(page_errors, ensure_ascii=False, indent=2)
    assert not any('/data/empresa' in url for url in request_urls), request_urls
    assert not any('/assets/js/phase' in url and '/main.js' in url for url in request_urls), request_urls
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'presentation_e2e_report.json').write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8'
    )
    print('PRESENTATION_E2E_OK')


if __name__ == '__main__':
    test_presentation_flow_playwright()
