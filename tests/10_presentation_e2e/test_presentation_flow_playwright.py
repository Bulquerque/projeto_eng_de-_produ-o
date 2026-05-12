import contextlib
import http.server
import json
import os
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "validation" / "presentation_e2e"


def read_password() -> str:
    value = os.environ.get("VISAGIO_DATA_PASSWORD")
    env_path = ROOT / ".env.local"
    if not value and env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("VISAGIO_DATA_PASSWORD="):
                value = line.split("=", 1)[1].strip().strip('"').strip("'")
                break
    if not value:
        raise RuntimeError("VISAGIO_DATA_PASSWORD missing for presentation E2E")
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
    server = ReusableServer(("127.0.0.1", 0), QuietHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield server.server_address[1]
    finally:
        server.shutdown()
        server.server_close()
        os.chdir(old_cwd)


def unlock_if_prompted(page, password: str) -> int:
    prompt = page.locator("#cryptoPasswordInput")
    try:
        prompt.wait_for(state="visible", timeout=5000)
    except PlaywrightTimeoutError:
        return 0
    prompt.fill(password)
    prompt.press("Enter")
    page.wait_for_timeout(1200)
    return 1


def assert_no_runtime_errors(page, console_events, page_errors, request_failures):
    console_errors = [event for event in console_events if event["type"] in {"error"}]
    assert not console_errors, json.dumps(console_errors, ensure_ascii=False, indent=2)
    assert not page_errors, json.dumps(page_errors, ensure_ascii=False, indent=2)
    assert not request_failures, json.dumps(request_failures, ensure_ascii=False, indent=2)
    fatal_errors = [
        text for text in page.locator(".alert-box.error:visible").all_inner_texts()
        if "Quality Score" not in text and "NÃO RECOMENDADO" not in text
    ]
    assert not fatal_errors, json.dumps(fatal_errors, ensure_ascii=False, indent=2)


def assert_no_horizontal_overflow(page):
    overflow = page.evaluate(
        "document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"
    )
    assert not overflow, {
        "client_width": page.evaluate("document.documentElement.clientWidth"),
        "scroll_width": page.evaluate("document.documentElement.scrollWidth"),
    }


def open_page(context, base_url: str, path: str):
    page = context.new_page()
    console_events = []
    page_errors = []
    request_failures = []
    page.on("console", lambda msg: console_events.append({"type": msg.type, "text": msg.text}))
    page.on("pageerror", lambda err: page_errors.append(str(err)))
    page.on("requestfailed", lambda req: request_failures.append({"url": req.url, "failure": req.failure}))
    response = page.goto(f"{base_url}{path}", wait_until="networkidle", timeout=20000)
    assert response and response.ok, path
    return page, console_events, page_errors, request_failures


def save_screenshot(page, name: str):
    OUT.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=True)


def test_presentation_flow_playwright():
    password = read_password()
    report = []

    with run_server() as port, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        base_url = f"http://127.0.0.1:{port}"

        desktop = browser.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)

        page, console_events, page_errors, request_failures = open_page(desktop, base_url, "/index.html")
        page.locator("h1").filter(has_text="Simulador Estático").wait_for(timeout=10000)
        save_screenshot(page, "01_home_desktop")
        assert_no_runtime_errors(page, console_events, page_errors, request_failures)
        report.append({"step": "home", "status": "ok"})
        page.close()

        page, console_events, page_errors, request_failures = open_page(desktop, base_url, "/fase-2-baseline/")
        prompts = unlock_if_prompted(page, password)
        page.locator("#phase2AutoChecks .check-item").first.wait_for(state="visible", timeout=20000)
        assert page.locator("#phase2AutoChecks .check-fail").count() == 0
        save_screenshot(page, "02_baseline_desktop")
        assert_no_runtime_errors(page, console_events, page_errors, request_failures)
        report.append({"step": "baseline", "status": "ok", "prompts": prompts})
        page.close()

        page, console_events, page_errors, request_failures = open_page(desktop, base_url, "/fase-3-cenarios/")
        prompts = unlock_if_prompted(page, password)
        page.locator('[data-load-scenario="empresa1_sample_estoque_menos_10_dias"]').click()
        page.locator("#simulateScenario").click()
        page.locator("#comparisonTable table tbody tr").nth(1).wait_for(state="visible", timeout=20000)
        assert "Cenário válido" in page.locator("#scenarioValidationPanel").inner_text()
        assert "Quality Score" in page.locator("#qualityPanel").inner_text()
        save_screenshot(page, "03_scenario_desktop")
        assert_no_runtime_errors(page, console_events, page_errors, request_failures)
        report.append({"step": "scenario", "status": "ok", "prompts": prompts})
        page.close()

        page, console_events, page_errors, request_failures = open_page(desktop, base_url, "/fase-4-score-otimizador/")
        prompts = unlock_if_prompted(page, password)
        page.locator("#runOptimizer").click()
        page.locator("#rankingPanel table tbody tr").first.wait_for(state="visible", timeout=30000)
        assert page.locator("#rankingPanel table tbody tr").count() > 0
        save_screenshot(page, "04_optimizer_desktop")
        assert_no_runtime_errors(page, console_events, page_errors, request_failures)
        report.append({"step": "optimizer", "status": "ok", "prompts": prompts})
        page.close()

        page, console_events, page_errors, request_failures = open_page(desktop, base_url, "/fase-5-entrega-final/")
        prompts = unlock_if_prompted(page, password)
        page.locator("#executiveReportPanel").filter(has_text="Relatório executivo").wait_for(timeout=30000)
        assert page.locator("#exportCenterPanel .export-button").count() >= 4
        assert "audit_id" in page.locator("#auditTrailPanel").inner_text()
        save_screenshot(page, "05_final_delivery_desktop")
        assert_no_runtime_errors(page, console_events, page_errors, request_failures)
        report.append({"step": "final_delivery", "status": "ok", "prompts": prompts})
        page.close()

        desktop.close()

        mobile = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        for name, path in [
            ("home", "/index.html"),
            ("baseline", "/fase-2-baseline/"),
            ("scenario", "/fase-3-cenarios/"),
            ("optimizer", "/fase-4-score-otimizador/"),
            ("final_delivery", "/fase-5-entrega-final/"),
        ]:
            page, console_events, page_errors, request_failures = open_page(mobile, base_url, path)
            unlock_if_prompted(page, password)
            if name == "scenario":
                page.locator('[data-load-scenario="empresa1_sample_estoque_menos_10_dias"]').click()
                page.locator("#simulateScenario").click()
                page.locator("#comparisonTable table tbody tr").nth(1).wait_for(state="visible", timeout=20000)
            elif name == "optimizer":
                page.locator("#runOptimizer").click()
                page.locator("#rankingPanel table tbody tr").first.wait_for(state="visible", timeout=30000)
            elif name == "final_delivery":
                page.locator("#executiveReportPanel").filter(has_text="Relatório executivo").wait_for(timeout=30000)
            assert_no_horizontal_overflow(page)
            assert_no_runtime_errors(page, console_events, page_errors, request_failures)
            save_screenshot(page, f"mobile_{name}")
            report.append({"step": f"mobile_{name}", "status": "ok"})
            page.close()
        mobile.close()
        browser.close()

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "presentation_e2e_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print("PRESENTATION_E2E_OK")


if __name__ == "__main__":
    test_presentation_flow_playwright()
