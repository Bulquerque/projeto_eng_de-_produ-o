import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
script = r"""
import assert from 'node:assert/strict';

const ids = [
  'phase5CompanyLabel', 'phase5OverviewCards', 'finalSituationTable',
  'taxPeriodsPanel', 'stressPanel', 'sensitivityPanel', 'sensitivityMatrixPanel',
  'recommendationPanel', 'executiveReportPanel', 'workbookParityPanel',
  'auditTrailPanel', 'exportCenterPanel',
];
const elements = new Map(ids.map((id) => [id, { innerHTML: '', textContent: '' }]));
const companyButton = {
  dataset: { company: 'empresa2' },
  classList: { toggle(name, active) { this[name] = active; } },
  setAttribute(name, value) { this[name] = value; },
};
globalThis.document = {
  getElementById(id) { return elements.get(id); },
  querySelectorAll(selector) { return selector === '[data-company]' ? [companyButton] : []; },
};

const { renderPhase5Dashboard } = await import('./assets/js/phase5/phase5-dashboard-view.js');
const chartCalls = [];
const selected = {
  scenario_id: 'scenario-2',
  scenario_name: 'Plano <seguro>',
  scenario: { scenario_id: 'scenario-2', changes: { active_cds: ['CD1'] } },
  quality: { risk_level: 'baixo' },
  result: {
    total_with_tax: 800,
    costs: { transfer_cost: 20, tax_impact: 30 },
    tax_results: { calculation_mode: 'full', tax_period_contract: { selected_period: { year: 2026 } } },
    data_quality: { status: 'complete', decision_use: 'decision_support' },
    evidence: { evidence_score: 90, evidence_status: 'strong' },
  },
};
const state = {
  companyId: 'empresa2',
  bundle: { model: { scenario_id: 'baseline-2' } },
  selection: { selected_scenario: selected, selection_reason: 'Melhor score' },
  robustness: { robustness_score: 82, certified_robustness_score: null },
  recommendation: { recommendation_status: 'recommended', executive_summary: 'Resumo <seguro>', main_reasons: ['custo'], main_risks: [], next_actions: [] },
  release: { release_status: 'warning', ready_to_deliver: false },
  stress: { stress_results: [{ case_name: 'Stress <A>', total_with_tax: 900, saving_vs_baseline: 100, saving_pct: 10, scenario_still_better_than_baseline: true }] },
  sensitivity: { sensitivity_results: [{ variable: 'Frete <x>', value: 1.1, total_with_tax: 880, saving_pct: 12 }], most_sensitive_variable: 'Frete' },
  sensitivityMatrix: { x_variable: 'freight_multiplier', y_variable: 'wacc', x_values: [1], y_values: [0.1], matrix_results: [{ x_value: 1, y_value: 0.1, saving_pct: 6, total_with_tax: 850 }] },
  workbookParity: null,
  audit: { status: 'ok' },
  exportPackage: { files: [{ filename: 'report <safe>.csv' }] },
};
const comparison = () => ({ baseline_total: 1000, scenario_total: 800, saving_abs: 200, saving_pct: 20 });
renderPhase5Dashboard(state, comparison, {
  renderRobustnessChart(value) { chartCalls.push(['robustness', value]); },
  renderStressChart(value) { chartCalls.push(['stress', value]); },
  renderSensitivityChart(value) { chartCalls.push(['sensitivity', value]); },
});

assert.equal(elements.get('phase5CompanyLabel').textContent, 'Empresa 2');
assert.equal(companyButton['aria-pressed'], 'true');
assert.match(elements.get('phase5OverviewCards').innerHTML, /Robustez condicional/);
assert.match(elements.get('finalSituationTable').innerHTML, /Plano &lt;seguro&gt;/);
assert.match(elements.get('taxPeriodsPanel').innerHTML, /2026/);
assert.match(elements.get('stressPanel').innerHTML, /Stress &lt;A&gt;/);
assert.match(elements.get('sensitivityPanel').innerHTML, /Frete &lt;x&gt;/);
assert.match(elements.get('sensitivityMatrixPanel').innerHTML, /heatmap-very-good/);
assert.match(elements.get('recommendationPanel').innerHTML, /Resumo &lt;seguro&gt;/);
assert.match(elements.get('executiveReportPanel').innerHTML, /Plano &lt;seguro&gt;/);
assert.match(elements.get('workbookParityPanel').innerHTML, /Paridade indisponível/);
assert.match(elements.get('auditTrailPanel').innerHTML, /&quot;status&quot;: &quot;ok&quot;/);
assert.match(elements.get('exportCenterPanel').innerHTML, /report &lt;safe&gt;.csv/);
assert.deepEqual(chartCalls.map(([name]) => name), ['robustness', 'stress', 'sensitivity']);
console.log('PHASE5_DASHBOARD_VIEW_OK');
"""
result = subprocess.run(
    ['node', '--input-type=module', '-e', script],
    cwd=ROOT,
    text=True,
    capture_output=True,
    timeout=30,
)
assert result.returncode == 0, result.stderr + result.stdout
print(result.stdout.strip())
