import json

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
summary = json.loads((ROOT/'data/validation/final_v6_audit_summary.json').read_text(encoding='utf-8'))
assert summary['result'] == 'OK', summary
assert summary['workbook_audit']['workbook_files_checked'] == 5
assert summary['workbook_audit']['total_sheets_checked'] == 53
assert summary['workbook_audit']['source_exported_sheets'] == 53
assert summary['workbook_audit']['missing_declared_paths'] == 0
assert summary['workbook_audit']['missing_required_core_files'] == 0
assert summary['workbook_audit']['external_formula_count'] == 0
assert summary['workbook_audit']['external_relationship_count'] == 0
assert summary['path_audit']['missing_paths'] == []
assert summary['path_audit']['runtime_absolute_path_hits_after_cleanup'] == []
assert summary['path_audit']['stale_version_hits_after_cleanup'] == []
assert summary['required_core_missing'] == []
print('FINAL_DEEP_AUDIT_OK')
