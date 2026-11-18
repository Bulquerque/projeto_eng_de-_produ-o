import contextlib
import http.server
import os
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]


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


def main():
    page_errors = []
    requested_urls = []

    with run_server() as port, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('pageerror', lambda error: page_errors.append(str(error)))
        page.on('request', lambda request: requested_urls.append(request.url))
        page.goto(
            f'http://127.0.0.1:{port}/?company=empresa_mock#/network/overview/summary',
            wait_until='networkidle',
        )

        page.locator('#networkAppRoot').wait_for(state='visible')
        page.locator('[data-testid="page-overview-summary"]').wait_for(state='visible')
        assert page.locator('[data-testid="company-selector"]').input_value() == 'empresa_mock'
        assert page.locator('#heroStatus').count() == 0
        assert page.locator('#phase1AutoChecks').count() == 0
        assert page.locator('#runtimeWarning').count() == 0
        assert page.locator('#networkPage').get_attribute('data-route-current') == '#/network/overview/summary'
        assert not any('/assets/js/phase' in url and '/main.js' in url for url in requested_urls)

        page.locator('[data-testid="company-selector"]').select_option('empresa1')
        page.locator('#cryptoPasswordPrompt').wait_for(state='visible', timeout=10000)
        assert page.locator('#cryptoReturnToDemo').count() == 0
        page.locator('#cryptoCancel').click()
        assert not page_errors, f'page_errors={page_errors}'
        browser.close()

    print('NETWORK_ENTRYPOINT_PLAYWRIGHT_OK')


if __name__ == '__main__':
    main()
