from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
TESTS = [
    "tests/00_basicos/check_package.py",
    "tests/01_paths_auditoria/test_full_workbook_paths.py",
    "tests/01_paths_auditoria/test_paths_and_regeneration.py",
    "tests/01_paths_auditoria/test_final_deep_audit.py",
    "tests/02_fase1_frontend/test_phase1_static_site.py",
    "tests/02_fase1_frontend/test_phase1_http_server.py",
    "tests/03_contratos_modulos/test_module_contracts_documentation.py",
    "tests/05_fase2_baseline/test_phase2_data_contracts.py",
    "tests/05_fase2_baseline/test_phase2_static_site.py",
    "tests/05_fase2_baseline/test_phase2_http_server.py",
    "tests/06_fase3_cenarios/test_phase3_file_structure.py",
    "tests/06_fase3_cenarios/test_phase3_contracts.py",
    "tests/06_fase3_cenarios/test_phase3_js_syntax.py",
    "tests/06_fase3_cenarios/test_phase3_logic.py",
    "tests/06_fase3_cenarios/test_phase3_http_server.py",
    "tests/07_fase4_score_otimizador/test_phase4_file_structure.py",
    "tests/07_fase4_score_otimizador/test_phase4_js_syntax.py",
    "tests/07_fase4_score_otimizador/test_phase4_scoring_logic.py",
    "tests/07_fase4_score_otimizador/test_phase4_optimizer_logic.py",
    "tests/07_fase4_score_otimizador/test_phase4_http_server.py",
    "tests/08_fase5_entrega_final/test_phase5_file_structure.py",
    "tests/08_fase5_entrega_final/test_phase5_js_syntax.py",
    "tests/08_fase5_entrega_final/test_phase5_stress_logic.py",
    "tests/08_fase5_entrega_final/test_phase5_recommendation_logic.py",
    "tests/08_fase5_entrega_final/test_phase5_audit_export.py",
    "tests/08_fase5_entrega_final/test_phase5_final_qa.py",
    "tests/08_fase5_entrega_final/test_phase5_http_server.py",
    "tests/09_polish_debug_restructure/test_phase2_refactor_modules.py",
    "tests/09_polish_debug_restructure/test_debug_system.py",
    "tests/09_polish_debug_restructure/test_phase_folders_and_module_docs.py",
    "tests/09_polish_debug_restructure/test_polish_file_preservation.py",
    "tests/10_presentation_e2e/test_presentation_flow_playwright.py",
]

for rel in TESTS:
    print(f"\n>>> {rel}", flush=True)
    res = subprocess.run([sys.executable, str(ROOT / rel)], cwd=ROOT, text=True, capture_output=True, timeout=300)
    if res.stdout:
        print(res.stdout, end="")
    if res.stderr:
        print(res.stderr, end="", file=sys.stderr)
    if res.returncode != 0:
        raise SystemExit(res.returncode)

print("\nALL_PHASE5_PACKAGE_TESTS_OK")
