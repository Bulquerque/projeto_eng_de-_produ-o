from pathlib import Path
import re
ROOT = Path(__file__).resolve().parents[2]
required = [
    'fase-3-cenarios/index.html',
    'data/validation/phase3_implementation_report.json',
    'data/empresa1/phase3/sample_scenarios.json.enc.json',
    'data/empresa2/phase3/sample_scenarios.json.enc.json',
    'assets/js/phase3/main.js',
    'assets/js/phase3/scenario-library.js',
    'assets/js/phase3/scenario-builder.js',
    'assets/js/phase3/scenario-validator.js',
    'assets/js/phase3/scenario-flow-rebuilder.js',
    'assets/js/phase3/scenario-simulator.js',
    'assets/js/phase3/scenario-comparator.js',
    'assets/js/phase3/scenario-quality-check.js',
    'assets/js/phase3/scenario-change-explainer.js',
    'assets/js/phase3/scenario-persistence.js',
    'assets/js/phase3/scenario-import-export.js',
    'assets/js/phase3/scenario-arena-dashboard.js',
    'assets/js/phase3/phase3-tests.js',
]
missing=[p for p in required if not (ROOT/p).exists()]
assert not missing, f'Missing Phase 3 files: {missing}'
html=(ROOT/'fase-3-cenarios/index.html').read_text(encoding='utf-8')
assert '../assets/styles.css' in html
assert '../assets/js/phase3/main.js' in html
assert '/mnt/data' not in html and 'C:\\' not in html
css=(ROOT/'assets/styles.css').read_text(encoding='utf-8')
for cls in ['scenario-form','scenario-arena','scenario-card','scenario-library','delta-positive','delta-negative']:
    assert cls in css, f'Missing CSS class: {cls}'
print('PHASE3_FILE_STRUCTURE_OK')
