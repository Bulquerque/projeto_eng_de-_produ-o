import subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
MODULES=['baseline-data-adapter.js','baseline-builder.js','flow-builder.js','distance-resolver.js','tax-engine-basic.js','reference-result-extractor.js','calibration-panel.js','cost-engine.js','base-fit-score.js','baseline-dashboard.js','phase2-tests.js','main.js']
def test_phase2_refactor_modules_exist_and_parse():
    for name in MODULES:
        rel=ROOT/'assets/js/phase2'/name; assert rel.exists(), name; subprocess.run(['node','--check',str(rel)],check=True,capture_output=True,text=True)
def test_phase2_dashboard_uses_refactored_modules():
    text=(ROOT/'assets/js/phase2/baseline-dashboard.js').read_text(encoding='utf-8')
    for token in ['./flow-builder.js','./tax-engine-basic.js','./reference-result-extractor.js','./calibration-panel.js']: assert token in text, token
    main=(ROOT/'assets/js/phase2/main.js').read_text(encoding='utf-8')
    for token in ['./baseline-data-adapter.js','./baseline-builder.js','../shared/debug-tools.js']: assert token in main, token
if __name__=='__main__': test_phase2_refactor_modules_exist_and_parse(); test_phase2_dashboard_uses_refactored_modules(); print('PHASE2_REFACTOR_MODULES_OK')
