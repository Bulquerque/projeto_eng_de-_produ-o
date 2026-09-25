import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
script = r"""
import assert from 'node:assert/strict';
import { renderFinalSituationTableHtml } from './assets/js/phase5/final-situation-view.js';

const empty = renderFinalSituationTableHtml({
  companyLabel: 'Empresa <1>', baselineId: 'base-1', selected: null,
  comparison: { baseline_total: 1250 }, robustness: null, recommendationLabel: 'revisar',
});
assert.match(empty, /Empresa &lt;1&gt;/);
assert.match(empty, /nenhum cenário elegível/);
assert.match(empty, /Status do cálculo tributário/);
assert.match(empty, /R\$|1\.250/);
assert.doesNotMatch(empty, /Empresa <1>/);

const selected = renderFinalSituationTableHtml({
  companyLabel: 'Empresa 1', baselineId: 'base-1',
  selected: {
    scenario_id: 'sc-1', scenario_name: '<Plano>',
    scenario: { scenario_id: 'sc-1', changes: { active_cds: ['CD1'], freight_multiplier: 1.1 } },
    quality: { risk_level: '<alto>' },
    result: {
      total_with_tax: 900,
      costs: { transfer_cost: 20, tax_impact: 30 },
      tax_results: { calculation_mode: 'full', tax_coverage: { input_coverage_ratio: 0.8 } },
      data_quality: { status: 'complete', decision_use: 'decision_support' },
      evidence: { evidence_score: 75, evidence_status: '<parcial>' },
    },
  },
  comparison: { baseline_total: 1000, scenario_total: 900, saving_abs: 100, saving_pct: 10 },
  robustness: { robustness_score: 80, certified_robustness_score: 80 },
  recommendationLabel: 'recomendado',
});
assert.match(selected, /&lt;Plano&gt;/);
assert.match(selected, /Certificação da robustez/);
assert.match(selected, /disponível no escopo modelado/);
assert.match(selected, /&lt;parcial&gt;/);
assert.match(selected, /&lt;alto&gt;/);
assert.match(selected, /10,0%/);
assert.doesNotMatch(selected, /<Plano>|<parcial>|<alto>/);
"""
result = subprocess.run(
    ['node', '--input-type=module', '-e', script],
    cwd=ROOT,
    text=True,
    capture_output=True,
    timeout=30,
)
assert result.returncode == 0, result.stderr
print('PHASE5_FINAL_SITUATION_VIEW_OK')
