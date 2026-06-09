import contextlib
import http.server
import json
import os
import socketserver
import subprocess
import threading
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE_DIR = ROOT / 'data' / 'validation' / 'prova_bala_evidence'
LOGIC_REPORT_PATH = EVIDENCE_DIR / 'logic_report.json'
UI_REPORT_PATH = EVIDENCE_DIR / 'ui_report.json'
FINAL_REPORT_PATH = EVIDENCE_DIR / 'prova_bala_report.json'


def read_password() -> str:
    value = os.environ.get('VISAGIO_DATA_PASSWORD')
    env_path = ROOT / '.env.local'
    if not value and env_path.exists():
        for line in env_path.read_text(encoding='utf-8').splitlines():
            if line.startswith('VISAGIO_DATA_PASSWORD='):
                value = line.split('=', 1)[1].strip().strip('"').strip("'")
                break
    if not value:
        raise RuntimeError('VISAGIO_DATA_PASSWORD missing for prova de bala')
    return value


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


def unlock_if_prompted(page, password: str) -> int:
    prompt = page.locator('#cryptoPasswordInput')
    try:
        prompt.wait_for(state='visible', timeout=6000)
    except PlaywrightTimeoutError:
        return 0
    prompt.fill(password)
    prompt.press('Enter')
    page.wait_for_timeout(1000)
    return 1


def assert_no_runtime_errors(page, console_events, page_errors, request_failures):
    console_errors = [event for event in console_events if event['type'] == 'error']
    assert not console_errors, json.dumps(console_errors, ensure_ascii=False, indent=2)
    assert not page_errors, json.dumps(page_errors, ensure_ascii=False, indent=2)
    assert not request_failures, json.dumps(request_failures, ensure_ascii=False, indent=2)
    fatal_errors = [
        text
        for text in page.locator('.alert-box.error:visible').all_inner_texts()
        if 'Quality Score' not in text and 'NÃO RECOMENDADO' not in text
    ]
    assert not fatal_errors, json.dumps(fatal_errors, ensure_ascii=False, indent=2)


def assert_no_horizontal_overflow(page):
    overflow = page.evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth + 1')
    assert not overflow, {
        'client_width': page.evaluate('document.documentElement.clientWidth'),
        'scroll_width': page.evaluate('document.documentElement.scrollWidth'),
    }


def open_page(context, base_url: str, path: str):
    page = context.new_page()
    console_events = []
    page_errors = []
    request_failures = []
    page.on('console', lambda msg: console_events.append({'type': msg.type, 'text': msg.text}))
    page.on('pageerror', lambda err: page_errors.append(str(err)))
    page.on('requestfailed', lambda req: request_failures.append({'url': req.url, 'failure': req.failure}))
    response = page.goto(f'{base_url}{path}', wait_until='networkidle', timeout=40000)
    assert response and response.ok, path
    return page, console_events, page_errors, request_failures


def save_screenshot(page, name: str):
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(EVIDENCE_DIR / f'{name}.png'), full_page=True)


def run_logic_audit() -> dict:
    result = subprocess.run(
        ['node', str(ROOT / 'tests' / '11_prova_bala' / 'prova_bala_logic_audit.mjs')],
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=300,
    )
    if result.returncode != 0:
        raise AssertionError(result.stderr + result.stdout)
    report = json.loads(result.stdout)
    assert LOGIC_REPORT_PATH.exists(), LOGIC_REPORT_PATH
    return report


def run_ui_audit(password: str) -> dict:
    ui_report = {
        'generated_at': None,
        'screenshots': [],
        'checks': [],
    }
    with run_server() as port, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        base_url = f'http://127.0.0.1:{port}'

        desktop = browser.new_context(viewport={'width': 1440, 'height': 1000}, device_scale_factor=1)

        page, console_events, page_errors, request_failures = open_page(desktop, base_url, '/index.html#/bogus-route')
        page.locator('#sec-diagnostico-baseline').wait_for(state='visible', timeout=10000)
        save_screenshot(page, 'ui_invalid_route_fallback_desktop')
        assert page.locator('#sec-diagnostico-baseline').is_visible()
        assert page.locator('#sec-simulacao-otimizacao').is_hidden()
        assert_no_runtime_errors(page, console_events, page_errors, request_failures)
        assert_no_horizontal_overflow(page)
        ui_report['checks'].append({'case': 'invalid_route_fallback', 'status': 'ok'})
        ui_report['screenshots'].append('ui_invalid_route_fallback_desktop.png')
        page.close()

        page, console_events, page_errors, request_failures = open_page(desktop, base_url, '/fase-2-baseline/')
        unlock_if_prompted(page, password)
        page.locator('#phase2Workspace').wait_for(state='visible', timeout=30000)
        page.evaluate(
            """() => {
                localStorage.setItem('visagio_shared_debug_feed', '{broken');
                localStorage.setItem('visagio_phase2_manual_checks_empresa1', 'broken');
            }"""
        )
        page.reload(wait_until='networkidle', timeout=40000)
        unlock_if_prompted(page, password)
        page.locator('#phase2Workspace').wait_for(state='visible', timeout=30000)
        page.locator('#phase2AutoChecks .check-item').first.wait_for(state='visible', timeout=30000)
        assert page.locator('#phase2AutoChecks .check-fail').count() == 0
        save_screenshot(page, 'ui_corrupted_storage_baseline_desktop')
        assert_no_runtime_errors(page, console_events, page_errors, request_failures)
        assert_no_horizontal_overflow(page)
        ui_report['checks'].append({'case': 'corrupted_storage_baseline', 'status': 'ok'})
        ui_report['screenshots'].append('ui_corrupted_storage_baseline_desktop.png')
        page.close()

        desktop.close()

        mobile = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
        page, console_events, page_errors, request_failures = open_page(mobile, base_url, '/fase-5-entrega-final/')
        unlock_if_prompted(page, password)
        page.locator('#executiveReportPanel').wait_for(state='visible', timeout=30000)
        page.locator('#exportCenterPanel .export-button').first.wait_for(state='visible', timeout=30000)
        assert page.locator('#exportCenterPanel .export-button').count() >= 4
        assert 'audit_id' in page.locator('#auditTrailPanel').inner_text()
        save_screenshot(page, 'ui_final_delivery_mobile')
        assert_no_runtime_errors(page, console_events, page_errors, request_failures)
        assert_no_horizontal_overflow(page)
        ui_report['checks'].append({'case': 'final_delivery_mobile', 'status': 'ok'})
        ui_report['screenshots'].append('ui_final_delivery_mobile.png')
        page.close()
        mobile.close()
        browser.close()

    ui_report['generated_at'] = datetime.now(timezone.utc).isoformat()
    UI_REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    UI_REPORT_PATH.write_text(json.dumps(ui_report, ensure_ascii=False, indent=2), encoding='utf-8')
    return ui_report


def main():
    password = read_password()
    logic_report = run_logic_audit()
    ui_report = run_ui_audit(password)
    final_report = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'status': 'ok',
        'logic_report_path': str(LOGIC_REPORT_PATH.relative_to(ROOT)),
        'ui_report_path': str(UI_REPORT_PATH.relative_to(ROOT)),
        'logic': logic_report,
        'ui': ui_report,
    }
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    FINAL_REPORT_PATH.write_text(json.dumps(final_report, ensure_ascii=False, indent=2), encoding='utf-8')
    print('PROVA_BALA_OK')


if __name__ == '__main__':
    main()
