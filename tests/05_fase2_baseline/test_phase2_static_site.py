import subprocess
from pathlib import Path


def find_project_root() -> Path:
    here = Path(__file__).resolve()
    for candidate in [here.parent, *here.parents]:
        if (candidate / 'index.html').exists() and (candidate / 'data').exists():
            return candidate
    raise RuntimeError('Project root not found')

ROOT = find_project_root()

def read(rel): return (ROOT/rel).read_text(encoding='utf-8')

def test_phase2_html_references_assets():
    html=read('fase-2-baseline/index.html')
    for token in ['../assets/styles.css','type="module"','../assets/js/phase2/main.js','phase2ProofCards','baselineSummaryCards','calibrationPanel']:
        assert token in html, token

def test_phase2_css_components_exist():
    css=read('assets/styles.css')
    for token in ['phase2-hero','breakdown-row','fit-score-layout','benchmark-pending','alert-box']:
        assert token in css, token

def test_phase2_js_modules_exist_and_parse():
    files=['assets/js/shared/common.js','assets/js/shared/data-loader.js','assets/js/phase2/main.js','assets/js/phase2/baseline-dashboard.js','assets/js/phase2/phase2-tests.js','assets/js/phase2/cost-engine.js','assets/js/phase2/base-fit-score.js']
    for f in files:
        assert (ROOT/f).exists(), f
        subprocess.run(['node','--check',str(ROOT/f)],check=True,capture_output=True,text=True)

def test_no_absolute_runtime_paths_in_phase2():
    joined='\n'.join((ROOT/f).read_text(encoding='utf-8') for f in ['fase-2-baseline/index.html','assets/js/phase2/main.js','assets/js/phase2/baseline-dashboard.js','assets/js/shared/data-loader.js'])
    forbidden=['/mnt/data','C:\\','A:/','file://']
    assert not any(x in joined for x in forbidden)

if __name__ == '__main__':
    test_phase2_html_references_assets(); test_phase2_css_components_exist(); test_phase2_js_modules_exist_and_parse(); test_no_absolute_runtime_paths_in_phase2(); print('PHASE2_STATIC_SITE_OK')
