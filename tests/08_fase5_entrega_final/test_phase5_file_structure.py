from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
required = [
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
    'assets/js/phase5/phase5-dashboard-view.js',
    'assets/js/phase5/tax-periods-view.js',
    'assets/js/phase5/final-situation-view.js',
    'assets/js/core/analysis-quality.js',
    'ESTUDO_PROPRIO_TRIBUTACAO.md',
    'data/empresa1/phase5/default_stress_cases.json.enc.json',
    'data/empresa2/phase5/default_stress_cases.json.enc.json',
]
missing = [p for p in required if not (ROOT / p).exists()]
assert not missing, missing
html = (ROOT / 'fase-5-entrega-final/index.html').read_text(encoding='utf-8')
assert '../assets/styles.css' in html
assert '../assets/js/core/runtime-warning.js' in html
assert 'index.html#/network/trust/validation' in html
portal = (ROOT / 'index.html').read_text(encoding='utf-8')
assert '<script type="module" src="assets/js/app/main.js' in portal
route_renderers = (ROOT / 'assets/js/app/route-renderers.js').read_text(encoding='utf-8')
trust_routes = {
    "'/network/trust/overview'": 'renderTrustOverview',
    "'/network/trust/evidence'": 'renderTrustEvidence',
    "'/network/trust/validation'": 'renderTrustValidation',
    "'/network/trust/methodology'": 'renderTrustMethodology',
}
for route, renderer in trust_routes.items():
    assert route in route_renderers and renderer in route_renderers, (route, renderer)
trust_pages = (ROOT / 'assets/js/app/pages/trust.js').read_text(encoding='utf-8')
for renderer in trust_routes.values():
    assert f'export function {renderer}(' in trust_pages, renderer
assert '/mnt/data' not in html and 'C:\\' not in html
print('PHASE5_FILE_STRUCTURE_OK')
