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


def test_network_ui_mock_flow_and_compatibility():
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
        page.goto(
            f'{base}/?ui=network-intelligence&company=empresa_mock#/network/overview/summary', wait_until='networkidle'
        )
        page.locator('#networkAppRoot').wait_for(state='visible')
        page.locator('[data-testid="page-overview-summary"]').wait_for(state='visible')
        assert page.locator('[data-testid="company-selector"]').input_value() == 'empresa_mock'
        assert page.locator('#sec-diagnostico-baseline').is_hidden()
        assert not any(f'/assets/js/phase{phase}/main.js' in url for phase in range(1, 6) for url in request_urls)
        assert not any('/data/empresa' in url for url in request_urls)

        page.locator('a[data-route="#/network/scenarios/build"]').first.click()
        page.locator('[data-testid="page-scenarios-build"]').wait_for(state='visible')
        assert page.locator('[data-testid="scenario-library"]').is_visible()
        assert page.locator('[data-testid="scenario-load-mock_consolidation"]').is_visible()
        page.locator('[data-testid="scenario-load-mock_consolidation"]').click()
        assert page.locator('input[name="scenario_name"]').input_value() == 'Consolidação demonstrativa'
        page.locator('[data-testid="scenario-run"]').click()
        page.locator('[data-testid="page-scenarios-result"]').wait_for(state='visible', timeout=10000)
        assert 'R$' in page.locator('#networkPage').inner_text()
        assert '100/100' in page.locator('#networkPage').inner_text()
        page.evaluate("window.location.hash = '#/network/scenarios/build'")
        page.locator('[data-testid="scenario-save"]').click()
        assert page.locator('[data-testid^="saved-scenario-load-"]').count() == 1
        page.locator('[data-testid="scenario-export"]').wait_for(state='visible')
        page.locator('[data-testid="scenario-clear-saved"]').click()
        assert page.locator('[data-testid^="saved-scenario-load-"]').count() == 0
        page.locator('[data-testid="scenario-import"]').set_input_files(
            {
                'name': 'imported.json',
                'mimeType': 'application/json',
                'buffer': b'{"scenario_id":"empresa_mock_imported_e2e","scenario_name":"Importado E2E","company_id":"empresa_mock","base_scenario_id":"mock_baseline","changes":{"active_cds":["CD Demo Norte"],"freight_multiplier":1,"demand_multiplier":1,"inventory_days":45,"wacc":0.15,"tax_mode":"current"}}',
            }
        )
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
        page.locator('[data-testid="scenario-clear-saved"]').click()
        assert page.locator('[data-testid^="saved-scenario-load-"]').count() == 0

        page.locator('[data-testid="company-selector"]').select_option('empresa1')
        assert 'company=empresa1' in page.url
        page.locator('#cryptoPasswordInput').fill('senha-incorreta-para-teste')
        page.locator('#cryptoPasswordPrompt button[type="submit"]').click()
        page.locator('#cryptoPasswordPrompt').wait_for(state='visible', timeout=10000)
        assert 'Senha inválida ou dados corrompidos' in page.locator('#cryptoPasswordPrompt').inner_text()
        page.locator('#cryptoCancel').click()
        page.goto(
            f'{base}/?ui=network-intelligence&company=empresa_mock#/network/overview/summary', wait_until='networkidle'
        )

        page.locator('a[data-route="#/network/optimizer/configure"]').first.click()
        page.locator('[data-testid="page-optimizer-configure"]').wait_for(state='visible')
        page.locator('[data-testid="optimizer-run"]').click()
        page.locator('[data-testid="page-trust-validation"]').wait_for(state='visible', timeout=20000)
        assert page.locator('[data-testid="qa-status"]').is_visible()
        assert page.locator('[data-testid="release-status"]').is_visible()
        assert 'demo_only' in page.locator('#networkPage').inner_text()
        with page.expect_download(timeout=10000) as download_info:
            page.locator('[data-testid="export-center"]').click()
        assert download_info.value.suggested_filename == 'empresa_mock_decision_package.json'

        page.goto(
            f'{base}/?ui=network-intelligence&company=empresa_mock#/diagnostico-baseline', wait_until='networkidle'
        )
        page.locator('[data-testid="page-overview-summary"]').wait_for(state='visible')
        assert page.locator('#networkPage').get_attribute('data-route-current') == '#/network/overview/summary'

        page.goto(
            f'{base}/?ui=network-intelligence&dev=1&company=empresa_mock#/network/dev/console',
            wait_until='networkidle',
        )
        page.locator('[data-testid="page-dev-console"]').wait_for(state='visible')
        assert 'Snapshot seguro' in page.locator('#networkPage').inner_text()
        page.goto(
            f'{base}/?ui=network-intelligence&dev=1&company=empresa_mock#erros',
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


def test_network_ui_real_tenant_preserves_crypto_boundary():
    with run_server() as port, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()
        base = f'http://127.0.0.1:{port}'
        page.goto(
            f'{base}/?ui=network-intelligence&company=empresa1#/network/overview/summary', wait_until='networkidle'
        )
        page.locator('#networkAppRoot').wait_for(state='visible')
        page.locator('#cryptoPasswordPrompt').wait_for(state='visible', timeout=10000)
        assert page.locator('#cryptoPasswordPrompt').inner_text().find('empresa1') >= 0
        assert page.locator('[data-testid="company-badge"]').inner_text() == 'empresa1'
        password = read_optional_password()
        if password:
            page.locator('#cryptoPasswordInput').fill(password)
            page.locator('#cryptoPasswordPrompt button[type="submit"]').click()
            page.locator('#cryptoPasswordPrompt').wait_for(state='detached', timeout=20000)
            page.locator('[data-testid="page-overview-summary"]').wait_for(state='visible', timeout=20000)
            page.evaluate("window.location.hash = '#/network/optimizer/configure'")
            page.locator('[data-testid="page-optimizer-configure"]').wait_for(state='visible', timeout=20000)
            page.locator('[data-testid="optimizer-run"]').click()
            page.locator('[data-testid="page-trust-validation"]').wait_for(state='visible', timeout=20000)
            page.locator('[data-testid="qa-status"]').wait_for(state='visible', timeout=20000)
            page.locator('pre.ni-json', has_text='Fonte protegida').wait_for(state='visible', timeout=20000)
            audit_text = page.locator('#networkPage').inner_text()
            assert 'data/empresa1' not in audit_text
            assert 'Fonte protegida (detalhes no pacote de exportação)' in audit_text
            lock_button = page.locator('#cryptoLockButton, .crypto-lock-button').first
            if lock_button.count():
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
            page.goto(
                f'{base}/?ui=network-intelligence&dev=1&company=empresa1#/network/dev/console',
                wait_until='networkidle',
            )
            page.locator('[data-testid="page-dev-console"]').wait_for(state='visible', timeout=20000)
            snapshot_text = page.locator('pre.ni-json').last.inner_text()
            lowered = snapshot_text.lower()
            assert 'baseline' not in lowered
            assert 'core_data' not in lowered
            assert 'flows' not in lowered
            assert 'data/empresa1' not in lowered
            assert password not in snapshot_text
        page.close()
        browser.close()


def test_network_ui_reentrant_submissions_and_export_deduplication():
    downloads = []
    with run_server() as port, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('download', lambda download: downloads.append(download))
        base = f'http://127.0.0.1:{port}'
        page.goto(
            f'{base}/?ui=network-intelligence&dev=1&company=empresa_mock#/network/scenarios/build',
            wait_until='networkidle',
        )
        page.locator('[data-testid="page-scenarios-build"]').wait_for(state='visible')
        page.locator('[data-testid="scenario-load-mock_consolidation"]').click()
        page.locator('[data-testid="scenario-form"]').evaluate(
            """form => {
                for (let index = 0; index < 2; index += 1) {
                    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                }
            }"""
        )
        page.locator('[data-testid="page-scenarios-result"]').wait_for(state='visible', timeout=10000)
        assert page.locator('.network-toast', has_text='Cenário simulado pelo provider ativo.').count() == 1

        page.goto(
            f'{base}/?ui=network-intelligence&dev=1&company=empresa_mock#/network/optimizer/configure',
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
        page.locator('[data-testid="page-trust-validation"]').wait_for(state='visible', timeout=20000)
        assert page.locator('.network-toast', has_text='Pipeline de decisão concluído.').count() == 1

        export_button = page.locator('[data-testid="export-center"]')
        export_button.click()
        export_button.click()
        page.wait_for_timeout(800)
        assert len(downloads) == 1, f'downloads={len(downloads)}'
        page.reload(wait_until='networkidle')
        page.locator('#networkAppRoot').wait_for(state='visible')
        assert page.locator('[data-testid="page-trust-validation"]').is_visible()
        page.close()
        browser.close()


if __name__ == '__main__':
    test_network_ui_mock_flow_and_compatibility()
    test_network_ui_real_tenant_preserves_crypto_boundary()
    test_network_ui_reentrant_submissions_and_export_deduplication()
    print('NETWORK_INTELLIGENCE_E2E_OK')
