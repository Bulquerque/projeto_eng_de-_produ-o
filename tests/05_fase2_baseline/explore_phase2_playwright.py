from __future__ import annotations

import contextlib
import http.server
import json
import os
import shutil
import socketserver
import threading
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


def find_project_root() -> Path:
    here = Path(__file__).resolve()
    for candidate in [here.parent, *here.parents]:
        if (candidate / "index.html").exists() and (candidate / "data").exists():
            return candidate
    raise RuntimeError("Project root not found")


ROOT = find_project_root()
REPORT_PATH = ROOT / "data" / "validation" / "phase2_playwright_exploration.json"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args) -> None:  # pragma: no cover - noisy by design
        pass


@contextlib.contextmanager
def run_server(root: Path):
    old_cwd = Path.cwd()
    server = None
    try:
        os.chdir(root)
        socketserver.TCPServer.allow_reuse_address = True
        server = socketserver.TCPServer(("127.0.0.1", 0), QuietHandler)
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        time.sleep(0.2)
        yield port
    finally:
        if server is not None:
            server.shutdown()
            server.server_close()
        os.chdir(old_cwd)


def launch_browser():
    executable = (
        shutil.which("chromium")
        or shutil.which("chromium-browser")
        or shutil.which("google-chrome")
    )
    launch_kwargs = {
        "headless": True,
        "args": ["--no-sandbox", "--disable-dev-shm-usage"],
    }
    if executable:
        launch_kwargs["executable_path"] = executable
    return launch_kwargs


def read_password() -> str:
    value = os.environ.get("VISAGIO_DATA_PASSWORD")
    if value:
        return value.strip()
    env_path = ROOT / ".env.local"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("VISAGIO_DATA_PASSWORD="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("VISAGIO_DATA_PASSWORD missing")


def unlock_if_prompted(page) -> None:
    prompt = page.locator("#cryptoPasswordInput")
    if prompt.count() == 0:
        return
    try:
        prompt.wait_for(state="visible", timeout=5000)
        prompt.fill(read_password())
        prompt.press("Enter")
        page.locator("#phase2Workspace").wait_for(state="visible", timeout=30000)
    except Exception:
        pass


def text_list(locator):
    return [text.strip() for text in locator.all_text_contents() if text.strip()]


def button_snapshot(page):
    return page.locator("button[data-company]").evaluate_all(
        """(els) => els.map((el) => ({
            text: el.textContent.trim(),
            aria_selected: el.getAttribute('aria-selected'),
            class_name: el.className,
        }))"""
    )


def build_state_snapshot(page, company_id: str):
    return {
        "company_id": company_id,
        "current_company": page.locator("#currentCompanyLabel").text_content().strip(),
        "current_scenario": page.locator("#currentScenarioLabel").text_content().strip(),
        "current_status": page.locator("#currentStatus").text_content().strip(),
        "proof_cards": text_list(page.locator("#phase2ProofCards .metric-card")),
        "baseline_summary": text_list(page.locator("#baselineSummaryCards .metric-card")),
        "cost_cards": text_list(page.locator("#costCards .metric-card")),
        "flow_summary": text_list(page.locator("#flowSummaryCards .metric-card")),
        "tax_panel": page.locator("#taxPanel").text_content().strip(),
        "calibration_panel": page.locator("#calibrationPanel").text_content().strip(),
        "auto_checks": text_list(page.locator("#phase2AutoChecks .check-item")),
        "check_summary": page.locator("#phase2CheckSummary").text_content().strip(),
        "manual_progress": page.locator("#phase2ManualProgress").text_content().strip(),
    }


def main() -> int:
    report = {
        "result": "unknown",
        "phase": 2,
        "generated_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "page_url": "/fase-2-baseline/",
        "controls": {},
        "states": {},
        "keyboard_checks": {},
        "console_messages": [],
        "findings": [],
    }

    with run_server(ROOT) as port, sync_playwright() as playwright:
        browser = playwright.chromium.launch(**launch_browser())
        page = browser.new_page(viewport={"width": 1440, "height": 1400})
        console_messages = []
        page.on(
            "console",
            lambda message: console_messages.append(
                {
                    "type": message.type,
                    "text": message.text,
                }
            ),
        )
        page.goto(f"http://127.0.0.1:{port}/fase-2-baseline/", wait_until="networkidle", timeout=20000)
        unlock_if_prompted(page)

        report["controls"] = {
            "buttons": button_snapshot(page),
            "links": page.locator("a").evaluate_all(
                """(els) => els.map((el) => ({
                    text: el.textContent.trim(),
                    href: el.getAttribute('href'),
                }))"""
            ),
        }

        report["states"]["empresa1_initial"] = build_state_snapshot(page, "empresa1")

        page.locator('button[data-company="empresa2"]').first.click()
        page.wait_for_timeout(300)
        unlock_if_prompted(page)
        report["states"]["empresa2_after_click"] = build_state_snapshot(page, "empresa2")
        report["states"]["company_buttons_after_click"] = button_snapshot(page)

        page.locator("#rerunPhase2Checks").click()
        page.wait_for_timeout(150)
        report["states"]["empresa2_after_rerun"] = {
            "check_summary": page.locator("#phase2CheckSummary").text_content().strip(),
            "auto_checks": text_list(page.locator("#phase2AutoChecks .check-item")),
        }

        boxes = page.locator('#phase2ManualChecklist input[type="checkbox"]')
        boxes.nth(0).check()
        boxes.nth(1).check()
        page.wait_for_timeout(100)
        report["states"]["manual_after_two_checks"] = {
            "progress": page.locator("#phase2ManualProgress").text_content().strip(),
            "first_item": page.locator("#phase2ManualChecklist .check-item").first.text_content().strip(),
        }
        page.locator("#clearPhase2ManualChecklist").click()
        page.wait_for_timeout(100)
        report["states"]["manual_after_clear"] = {
            "progress": page.locator("#phase2ManualProgress").text_content().strip(),
            "first_item": page.locator("#phase2ManualChecklist .check-item").first.text_content().strip(),
        }

        page.locator('button[data-company="empresa2"]').first.focus()
        page.keyboard.press("Enter")
        page.wait_for_timeout(150)
        report["keyboard_checks"]["company_tab_enter"] = {
            "current_company": page.locator("#currentCompanyLabel").text_content().strip(),
            "current_scenario": page.locator("#currentScenarioLabel").text_content().strip(),
        }
        page.locator("#clearPhase2ManualChecklist").focus()
        page.keyboard.press("Space")
        page.wait_for_timeout(100)
        report["keyboard_checks"]["clear_button_space"] = {
            "progress": page.locator("#phase2ManualProgress").text_content().strip(),
        }

        report["console_messages"] = console_messages

        report["result"] = "ok"
        browser.close()

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"PHASE2_PLAYWRIGHT_EXPLORATION_OK {REPORT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
