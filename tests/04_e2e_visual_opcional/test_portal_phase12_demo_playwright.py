"""Browser coverage for the public Network Intelligence shell and navigation."""

from __future__ import annotations

import contextlib
import http.server
import os
import shutil
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args) -> None:  # pragma: no cover - suppress server noise
        pass


@contextlib.contextmanager
def serve_project():
    old_cwd = Path.cwd()
    server = None
    try:
        os.chdir(ROOT)
        socketserver.TCPServer.allow_reuse_address = True
        server = socketserver.TCPServer(('127.0.0.1', 0), QuietHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        yield server.server_address[1]
    finally:
        if server is not None:
            server.shutdown()
            server.server_close()
        os.chdir(old_cwd)


def launch_options():
    options = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
    executable = shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
    if executable:
        options['executable_path'] = executable
    return options


def test_public_navigation_uses_the_network_workspace():
    routes = [
        ('#/network/overview/summary', 'overview', 'page-overview-summary'),
        ('#/network/scenarios/build', 'scenarios', 'page-scenarios-build'),
        ('#/network/optimizer/configure', 'optimizer', 'page-optimizer-configure'),
        ('#/network/trust/overview', 'trust', 'page-trust-overview'),
    ]
    errors = []

    with serve_project() as port, sync_playwright() as playwright:
        browser = playwright.chromium.launch(**launch_options())
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('pageerror', lambda error: errors.append(str(error)))
        base_url = f'http://127.0.0.1:{port}/?company=empresa_mock'

        page.goto(base_url + '#/network/overview/summary', wait_until='networkidle', timeout=20000)
        shell = page.locator('#networkAppRoot')
        shell.wait_for(state='visible', timeout=10000)
        assert page.locator('#niCompanySelect').input_value() == 'empresa_mock'
        assert 'MOCK' in page.locator('#niCompanyBadge').inner_text()
        assert page.locator('#networkPage').get_attribute('data-route-current') == '#/network/overview/summary'

        for route, section, test_id in routes:
            page.goto(base_url + route, wait_until='networkidle', timeout=10000)
            page.locator(f'[data-testid="{test_id}"]').wait_for(state='visible', timeout=5000)
            active = page.locator('#networkAppRoot .network-nav a[data-section][aria-current="page"]')
            assert active.count() == 1, route
            assert active.get_attribute('data-section') == section, route
            assert page.locator('#networkPage').get_attribute('data-route-current') == route, route

        skip_link = page.locator('[data-action="skip-to-content"]')
        skip_link.focus()
        assert page.evaluate('document.activeElement.dataset.action') == 'skip-to-content'
        skip_link.press('Enter')
        assert page.evaluate('document.activeElement.id') == 'networkPage'

        page.get_by_role('link', name='Cenários').click()
        assert page.locator('#networkPage h1').first.inner_text().strip() == 'Construir cenário'
        assert page.locator('#niCompanySelect').input_value() == 'empresa_mock'
        assert not errors, errors
        browser.close()


if __name__ == '__main__':
    test_public_navigation_uses_the_network_workspace()
    print('PORTAL_PHASE12_DEMO_PLAYWRIGHT_OK')
