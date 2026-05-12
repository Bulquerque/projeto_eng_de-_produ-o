from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
required=[
 'fase-5-entrega-final/index.html',
 'assets/js/phase5/main.js',
 'assets/js/phase5/final-scenario-selector.js',
 'assets/js/phase5/stress-case-library.js',
 'assets/js/phase5/stress-test-engine.js',
 'assets/js/phase5/sensitivity-engine.js',
 'assets/js/phase5/robustness-scorer.js',
 'assets/js/phase5/recommendation-engine.js',
 'assets/js/phase5/audit-trail-engine.js',
 'assets/js/phase5/executive-report-builder.js',
 'assets/js/phase5/export-center.js',
 'assets/js/phase5/final-qa-checker.js',
 'assets/js/phase5/release-validator.js',
 'assets/js/phase5/phase5-dashboard.js',
 'assets/js/phase5/phase5-tests.js',
 'data/empresa1/phase5/default_stress_cases.json.enc.json',
 'data/empresa2/phase5/default_stress_cases.json.enc.json'
]
missing=[p for p in required if not (ROOT/p).exists()]
assert not missing, missing
html=(ROOT/'fase-5-entrega-final/index.html').read_text(encoding='utf-8')
assert '../assets/styles.css' in html
assert '../assets/js/phase5/main.js' in html
assert '/mnt/data' not in html and 'C:\\' not in html
print('PHASE5_FILE_STRUCTURE_OK')
