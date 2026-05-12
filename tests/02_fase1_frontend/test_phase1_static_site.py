import json
import re

from pathlib import Path

def find_project_root() -> Path:
    here = Path(__file__).resolve()
    for candidate in [here.parent, *here.parents]:
        if (candidate / "index.html").exists() and (candidate / "data").exists():
            return candidate
    raise RuntimeError("Project root not found. Run tests from inside the extracted package.")

ROOT = find_project_root()
def find_project_root() -> Path:
    here = Path(__file__).resolve()
    for candidate in [here.parent, *here.parents]:
        if (candidate / "index.html").exists() and (candidate / "data").exists():
            return candidate
    raise RuntimeError("Project root not found. Run tests from inside the extracted package.")

ROOT = find_project_root()



def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_phase1_frontend_files_exist():
    required = [
        "index.html",
        "fase-1-validacao/index.html",
        "assets/styles.css",
        "assets/app.js",
        "data/catalog.json",
        "data/validation/path_resolution_report.json",
        "data/validation/workbook_sheet_inventory.csv",
    ]
    missing = [p for p in required if not (ROOT / p).exists()]
    assert not missing, missing


def test_phase1_index_contains_required_sections():
    html = read("index.html")
    for required_id in [
        "visao-geral",
        "dados",
        "qualidade",
        "abas",
        "fase-1-validacao",
        "proximas-fases",
        "debugConsole",
    ]:
        assert f'id="{required_id}"' in html, required_id
    assert "assets/styles.css" in html
    assert "assets/app.js" in html


def test_phase1_css_has_visagio_palette_and_components():
    css = read("assets/styles.css")
    for color in ["#00363D", "#F7F3F5", "#0F515C", "#0C7878", "#A9FDAC", "#00A189"]:
        assert color in css, color
    for klass in ["company-panel", "dataset-card", "check-item", "debug-console", "status-chip"]:
        assert klass in css, klass


def test_phase1_js_declares_modules_and_uses_relative_paths_only():
    js = read("assets/app.js")
    required_functions = [
        "fetchJson",
        "parseCsv",
        "renderCompanyPanel",
        "renderDataQualityPanel",
        "renderPathAuditPanel",
        "renderSheetInventory",
        "runPhase1Checks",
        "checkCorePathsLive",
    ]
    for fn in required_functions:
        assert f"function {fn}" in js or f"async function {fn}" in js, fn
    forbidden = ["/mnt/data", "C:\\\\", "A:/", "file://"]
    assert not any(x in js for x in forbidden)


def test_phase1_company_catalog_separation():
    catalog = json.loads((ROOT / "data/catalog.json").read_text(encoding="utf-8"))
    e1 = {f["id"] for f in catalog["companies"]["empresa1"]["core_files"]}
    e2 = {f["id"] for f in catalog["companies"]["empresa2"]["core_files"]}
    assert {"demand_records", "distance_matrix", "premissas"}.issubset(e1)
    assert {"faturamento_uf", "dados_tributario", "estoque", "scenario_blocks", "scenario_totals"}.issubset(e2)
    assert "dados_tributario" not in e1
    assert "demand_records" not in e2


def test_phase1_required_catalog_paths_exist():
    catalog = json.loads((ROOT / "data/catalog.json").read_text(encoding="utf-8"))
    missing = []
    def exists_or_encrypted(path):
        return (ROOT / path).exists() or (ROOT / f"{path}.enc.json").exists()
    for company in catalog["companies"].values():
        if company.get("baseline") and not exists_or_encrypted(company["baseline"]):
            missing.append(company["baseline"])
        for f in company.get("core_files", []):
            for key in ["csv", "json"]:
                p = f.get(key)
                if p and not exists_or_encrypted(p):
                    missing.append(p)
    assert not missing, missing


def test_phase1_path_report_clean():
    report = json.loads((ROOT / "data/validation/path_resolution_report.json").read_text(encoding="utf-8"))
    proof = json.loads((ROOT / "data/validation/data_presence_proof.json").read_text(encoding="utf-8"))
    assert report["result"] == "OK"
    assert report["missing_paths"] == []
    assert proof["empresa2_minimum_required_data"]["core_tables"]["scenario_blocks"] == 3
    assert proof["empresa2_minimum_required_data"]["core_tables"]["scenario_totals"] == 3


if __name__ == "__main__":
    test_phase1_frontend_files_exist()
    test_phase1_index_contains_required_sections()
    test_phase1_css_has_visagio_palette_and_components()
    test_phase1_js_declares_modules_and_uses_relative_paths_only()
    test_phase1_company_catalog_separation()
    test_phase1_required_catalog_paths_exist()
    test_phase1_path_report_clean()
    print("PHASE1_STATIC_SITE_TESTS_OK")
