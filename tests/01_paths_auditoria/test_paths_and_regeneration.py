import json
from pathlib import Path

def find_project_root() -> Path:
    here = Path(__file__).resolve()
    for candidate in [here.parent, *here.parents]:
        if (candidate / "index.html").exists() and (candidate / "data").exists():
            return candidate
    raise RuntimeError("Project root not found. Run tests from inside the extracted package.")

ROOT = find_project_root()
pr=json.loads((ROOT/'data/validation/path_resolution_report.json').read_text(encoding='utf-8'))
rr=json.loads((ROOT/'data/validation/regeneration_compare_report.json').read_text(encoding='utf-8'))
assert pr['result']=='OK', pr.get('missing_paths')
assert pr['missing_paths']==[]
assert rr['result']=='OK', rr
assert rr['workbooks_regenerated']==5
assert rr['sheets_regenerated']==53
print('REGENERATION_AND_PATH_CHECK_OK')
