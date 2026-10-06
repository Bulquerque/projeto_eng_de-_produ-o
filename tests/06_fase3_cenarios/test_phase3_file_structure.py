from pathlib import Path

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
    'assets/js/phase3/monte-carlo-engine.js',
    'assets/js/phase3/scenario-arena-dashboard.js',
    'assets/js/phase3/scenario-arena/monte-carlo-view.js',
    'assets/js/phase3/scenario-arena/comparison-view.js',
    'assets/js/phase3/scenario-arena/library-comparison.js',
    'assets/js/phase3/scenario-arena/library-view.js',
]
missing = [p for p in required if not (ROOT / p).exists()]
assert not missing, f'Missing Phase 3 files: {missing}'
html = (ROOT / 'fase-3-cenarios/index.html').read_text(encoding='utf-8')
assert '../assets/styles.css' in html
assert '../assets/js/core/runtime-warning.js' in html
assert 'index.html#/network/scenarios/build' in html
portal = (ROOT / 'index.html').read_text(encoding='utf-8')
assert '<script type="module" src="assets/js/app/main.js' in portal
route_renderers = (ROOT / 'assets/js/app/route-renderers.js').read_text(encoding='utf-8')
scenario_routes = {
    "'/network/scenarios/build'": 'renderScenarioBuild',
    "'/network/results/summary'": 'renderResultsSummary',
    "'/network/results/comparison'": 'renderResultsComparison',
    "'/network/results/risk'": 'renderResultsRisk',
}
for route, renderer in scenario_routes.items():
    assert route in route_renderers and renderer in route_renderers, (route, renderer)
router = (ROOT / 'assets/js/app/router.js').read_text(encoding='utf-8')
for alias in (
    "'#/network/scenarios/result': '#/network/results/summary'",
    "'#/network/scenarios/compare': '#/network/results/comparison'",
    "'#/network/scenarios/risk': '#/network/results/risk'",
):
    assert alias in router, alias
scenario_pages = (ROOT / 'assets/js/app/pages/scenarios.js').read_text(encoding='utf-8')
assert 'export function renderScenarioBuild(' in scenario_pages
results_pages = (ROOT / 'assets/js/app/pages/results.js').read_text(encoding='utf-8')
for renderer in ('renderResultsSummary', 'renderResultsComparison', 'renderResultsRisk'):
    assert f'export function {renderer}(' in results_pages, renderer
assert '/mnt/data' not in html and 'C:\\' not in html
css = (ROOT / 'assets/styles.css').read_text(encoding='utf-8')
for cls in ['scenario-form', 'scenario-arena', 'scenario-card', 'scenario-library', 'delta-positive', 'delta-negative']:
    assert cls in css, f'Missing CSS class: {cls}'
print('PHASE3_FILE_STRUCTURE_OK')
