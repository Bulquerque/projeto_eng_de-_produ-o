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
required=['index.html','assets/styles.css','assets/app.js','data/catalog.json','data/encrypted_manifest.json','data/validation/full_workbook_path_audit.json','data/validation/workbook_sheet_inventory.csv','data/empresa1/core/demand_records.csv.enc.json','data/empresa1/core/distance_matrix.csv.enc.json','data/empresa1/core/premissas.csv.enc.json','data/empresa2/core/faturamento_uf.csv.enc.json','data/empresa2/core/distribuicao_fabrica_cd.csv.enc.json','data/empresa2/core/scenario_blocks.json.enc.json']
missing=[p for p in required if not (ROOT/p).exists()]
assert not missing, missing
report=json.loads((ROOT/'data/validation/full_workbook_path_audit.json').read_text(encoding='utf-8'))
assert report['result']=='OK', report.get('errors')
print('PACKAGE_CHECK_OK')
