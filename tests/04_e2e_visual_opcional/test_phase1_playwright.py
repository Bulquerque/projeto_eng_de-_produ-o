import http.server
import socketserver
import threading
import time

from pathlib import Path

def find_project_root() -> Path:
    here = Path(__file__).resolve()
    for candidate in [here.parent, *here.parents]:
        if (candidate / "index.html").exists() and (candidate / "data").exists():
            return candidate
    raise RuntimeError("Project root not found. Run tests from inside the extracted package.")

ROOT = find_project_root()


def run_server(port: int):
    handler = http.server.SimpleHTTPRequestHandler
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", port), handler) as httpd:
        httpd.serve_forever()


def main():
    try:
        from playwright.sync_api import sync_playwright, expect
    except Exception as exc:
        print(f"PHASE1_PLAYWRIGHT_SKIPPED: playwright not available: {exc}")
        return

    port = 8765
    thread = threading.Thread(target=run_server, args=(port,), daemon=True)
    old_cwd = Path.cwd()
    import os
    os.chdir(ROOT)
    thread.start()
    time.sleep(0.8)
    try:
        with sync_playwright() as p:
            
            import shutil
            executable = shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
            launch_kwargs = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage', '--disable-web-security', '--allow-insecure-localhost', '--unsafely-treat-insecure-origin-as-secure=http://127.0.0.1:8765']}
            if executable:
                launch_kwargs['executable_path'] = executable
            browser = p.chromium.launch(**launch_kwargs)
            page = browser.new_page(viewport={"width": 1440, "height": 1200})
            
            try:
                page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle", timeout=10000)
            except Exception as exc:
                msg = str(exc)
                if 'ERR_BLOCKED_BY_ADMINISTRATOR' in msg or 'Executable doesn' in msg:
                    print(f"PHASE1_PLAYWRIGHT_SKIPPED: {msg.splitlines()[0]}", flush=True)
                    try:
                        browser.close()
                    finally:
                        import os as _os
                        _os._exit(0)
                raise
            expect(page.locator("#heroStatus")).to_contain_text("Fase 1 carregada")
            expect(page.locator("#companyTitle")).to_contain_text("Empresa 1")
            expect(page.locator("body")).to_contain_text("demand_records")
            expect(page.locator("body")).to_contain_text("distance_matrix")
            page.locator('[data-company="empresa2"]').click()
            expect(page.locator("#companyTitle")).to_contain_text("Empresa 2")
            expect(page.locator("body")).to_contain_text("dados_tributario")
            expect(page.locator("body")).to_contain_text("scenario_blocks")
            expect(page.locator("#phase1AutoChecks")).to_contain_text("passou")
            page.locator("#runLivePathCheck").click()
            page.wait_for_timeout(1200)
            expect(page.locator("body")).to_contain_text("path vivo OK")
            browser.close()
        print("PHASE1_PLAYWRIGHT_OK")
    finally:
        os.chdir(old_cwd)


if __name__ == "__main__":
    main()
