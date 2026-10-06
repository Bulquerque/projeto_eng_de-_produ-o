from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
required = [
    'fase-4-score-otimizador/index.html',
    'assets/js/phase4/main.js',
    'assets/js/phase4/objective-builder.js',
    'assets/js/phase4/objective-profile-library.js',
    'assets/js/phase4/objective-validator.js',
    'assets/js/phase4/scenario-metric-extractor.js',
    'assets/js/phase4/metric-normalizer.js',
    'assets/js/phase4/scenario-scoring.js',
    'assets/js/phase4/constraint-engine.js',
    'assets/js/phase4/candidate-scenario-generator.js',
    'assets/js/phase4/scenario-optimizer.js',
    'assets/js/phase4/ranking-explainer.js',
    'assets/js/phase4/tradeoff-frontier.js',
    'assets/js/phase4/phase4-dashboard.js',
    'assets/js/phase4/objective-preview-view.js',
    'data/empresa1/phase4/default_objectives.json.enc.json',
    'data/empresa2/phase4/default_objectives.json.enc.json',
]
missing = [p for p in required if not (ROOT / p).exists()]
assert not missing, f'Missing Phase 4 files: {missing}'
html = (ROOT / 'fase-4-score-otimizador/index.html').read_text(encoding='utf-8')
assert '../assets/styles.css' in html
assert '../assets/js/core/runtime-warning.js' in html
assert 'index.html#/network/optimizer/configure' in html
portal = (ROOT / 'index.html').read_text(encoding='utf-8')
assert '<script type="module" src="assets/js/app/main.js' in portal
route_renderers = (ROOT / 'assets/js/app/route-renderers.js').read_text(encoding='utf-8')
optimizer_routes = {
    "'/network/optimizer/configure'": 'renderOptimizerConfigure',
    "'/network/optimizer/results'": 'renderOptimizerResults',
    "'/network/optimizer/tradeoffs'": 'renderOptimizerTradeoffs',
    "'/network/results/summary'": 'renderResultsSummary',
    "'/network/results/tradeoffs'": 'renderResultsTradeoffs',
}
for route, renderer in optimizer_routes.items():
    assert route in route_renderers and renderer in route_renderers, (route, renderer)
router = (ROOT / 'assets/js/app/router.js').read_text(encoding='utf-8')
for route in ('#/network/optimizer/results', '#/network/optimizer/tradeoffs'):
    assert route in router.split('const ROUTE_ALIASES')[0], route
    assert route not in router.split('const ROUTE_ALIASES')[1], route
optimizer_pages = (ROOT / 'assets/js/app/pages/optimizer.js').read_text(encoding='utf-8')
assert 'export function renderOptimizerConfigure(' in optimizer_pages
results_pages = (ROOT / 'assets/js/app/pages/results.js').read_text(encoding='utf-8')
for renderer in ('renderResultsSummary', 'renderResultsTradeoffs'):
    assert f'export function {renderer}(' in results_pages, renderer
css = (ROOT / 'assets/styles.css').read_text(encoding='utf-8')
for cls in ['objective-builder', 'profile-card', 'optimizer-panel', 'search-log-grid', 'tradeoff-frontier']:
    assert cls in css, f'CSS class missing: {cls}'
for path in required:
    text = (ROOT / path).read_text(encoding='utf-8', errors='ignore')
    assert '/mnt/data' not in text and 'C:\\' not in text, f'absolute path found in {path}'
print('PHASE4_FILE_STRUCTURE_OK')
