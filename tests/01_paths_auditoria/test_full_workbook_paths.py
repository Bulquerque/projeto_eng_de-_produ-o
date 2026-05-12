import json
from pathlib import Path

def find_project_root() -> Path:
    here = Path(__file__).resolve()
    for candidate in [here.parent, *here.parents]:
        if (candidate / "index.html").exists() and (candidate / "data").exists():
            return candidate
    raise RuntimeError("Project root not found. Run tests from inside the extracted package.")

ROOT = find_project_root()
report=json.loads((ROOT/'data/validation/full_workbook_path_audit.json').read_text(encoding='utf-8'))
assert report['result']=='OK', report.get('errors')
s=report['summary']
assert s['workbook_files_checked']==5
assert s['total_sheets_checked']==53
assert s['source_exported_sheets']==53
assert s['sheets_without_source_export']==0
assert s['missing_declared_paths']==0
assert s['missing_required_core_files']==0
assert s['external_formula_count']==0
assert s['external_relationship_count']==0
assert s['absolute_path_hits_in_text_files']==0
print('FULL_WORKBOOK_PATH_AUDIT_OK')
