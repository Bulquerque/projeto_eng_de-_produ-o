import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_TESTS = [
    'tests/00_basicos/check_package.py',
    'tests/00_basicos/check_code_standards.py',
    'tests/01_paths_auditoria/test_full_workbook_paths.py',
    'tests/01_paths_auditoria/test_paths_and_regeneration.py',
    'tests/01_paths_auditoria/test_final_deep_audit.py',
    'tests/02_fase1_frontend/test_phase1_static_site.py',
    'tests/02_fase1_frontend/test_phase1_http_server.py',
    'tests/03_contratos_modulos/test_module_contracts_documentation.py',
    'tests/05_fase2_baseline/test_phase2_static_site.py',
    'tests/05_fase2_baseline/test_phase2_http_server.py',
    'tests/06_fase3_cenarios/test_phase3_file_structure.py',
    'tests/06_fase3_cenarios/test_phase3_js_syntax.py',
    'tests/06_fase3_cenarios/test_phase3_http_server.py',
    'tests/07_fase4_score_otimizador/test_phase4_file_structure.py',
    'tests/07_fase4_score_otimizador/test_phase4_js_syntax.py',
    'tests/07_fase4_score_otimizador/test_phase4_scoring_logic.py',
    'tests/07_fase4_score_otimizador/test_phase4_http_server.py',
    'tests/08_fase5_entrega_final/test_phase5_file_structure.py',
    'tests/08_fase5_entrega_final/test_phase5_js_syntax.py',
    'tests/08_fase5_entrega_final/test_phase5_http_server.py',
    'tests/09_quality_checks/test_crypto_session_contract.py',
    'tests/09_quality_checks/test_debug_system.py',
    'tests/09_quality_checks/test_phase2_refactor_modules.py',
    'tests/09_quality_checks/test_phase_folders_and_module_docs.py',
    'tests/09_quality_checks/test_release_contract.py',
]


for relative_path in PUBLIC_TESTS:
    print(f'\n>>> {relative_path}', flush=True)
    result = subprocess.run(
        [sys.executable, str(ROOT / relative_path)],
        cwd=ROOT,
        env=os.environ.copy(),
        text=True,
        check=False,
        timeout=300,
    )
    if result.returncode:
        raise SystemExit(result.returncode)

print('\nPUBLIC_SUITE_OK')
