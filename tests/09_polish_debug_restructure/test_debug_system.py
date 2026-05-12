import subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def test_debug_assets_exist_and_parse():
    for rel in ['debug/index.html','assets/js/shared/debug-tools.js','assets/js/debug/main.js','data/debug/module_runtime_registry.json','data/debug/debug_playbook.json']:
        assert (ROOT/rel).exists(), rel
    for rel in ['assets/js/shared/debug-tools.js','assets/js/debug/main.js']:
        subprocess.run(['node','--check',str(ROOT/rel)],check=True,capture_output=True,text=True)
def test_debug_page_links_present():
    html=(ROOT/'debug/index.html').read_text(encoding='utf-8')
    for token in ['Debug Center','debugSummaryCards','debugModuleTable','debugPathTable','debugEventPanel','../assets/js/debug/main.js']:
        assert token in html, token
if __name__=='__main__': test_debug_assets_exist_and_parse(); test_debug_page_links_present(); print('DEBUG_SYSTEM_OK')
