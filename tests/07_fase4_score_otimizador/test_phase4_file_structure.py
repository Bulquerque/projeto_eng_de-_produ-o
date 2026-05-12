from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
required=[
 'fase-4-score-otimizador/index.html',
 'assets/js/phase4/main.js','assets/js/phase4/objective-builder.js','assets/js/phase4/objective-profile-library.js','assets/js/phase4/objective-validator.js','assets/js/phase4/scenario-metric-extractor.js','assets/js/phase4/metric-normalizer.js','assets/js/phase4/scenario-scoring.js','assets/js/phase4/constraint-engine.js','assets/js/phase4/candidate-scenario-generator.js','assets/js/phase4/scenario-optimizer.js','assets/js/phase4/search-log-panel.js','assets/js/phase4/ranking-explainer.js','assets/js/phase4/tradeoff-frontier.js','assets/js/phase4/phase4-dashboard.js','assets/js/phase4/phase4-tests.js',
 'data/empresa1/phase4/default_objectives.json.enc.json','data/empresa2/phase4/default_objectives.json.enc.json']
missing=[p for p in required if not (ROOT/p).exists()]
assert not missing, f'Missing Phase 4 files: {missing}'
html=(ROOT/'fase-4-score-otimizador/index.html').read_text(encoding='utf-8')
assert '../assets/styles.css' in html
assert '../assets/js/phase4/main.js' in html
assert 'Objective Builder' in html and 'Otimizador' in html
css=(ROOT/'assets/styles.css').read_text(encoding='utf-8')
for cls in ['objective-builder','profile-card','optimizer-panel','search-log-grid','tradeoff-frontier']:
    assert cls in css, f'CSS class missing: {cls}'
for path in required:
    text=(ROOT/path).read_text(encoding='utf-8', errors='ignore')
    assert '/mnt/data' not in text and 'C:\\' not in text, f'absolute path found in {path}'
print('PHASE4_FILE_STRUCTURE_OK')
