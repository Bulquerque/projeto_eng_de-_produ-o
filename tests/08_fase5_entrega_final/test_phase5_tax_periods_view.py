import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
script = """
import assert from 'node:assert/strict';
import { renderTaxPeriodsHtml } from './assets/js/phase5/tax-periods-view.js';

const html = renderTaxPeriodsHtml({
  selected_period: { year: 2027, source_status: 'official', source_ref: '<fonte>' },
  current_reference_data_period: { period_start: '2026-01-01', period_end: null, source_file: 'matriz.csv' },
  observed_data_coverage: { status: 'partial' },
  available_periods: [{ year: 2027, phase: '<fase>', current_tax_weight: 0.8, reform_tax_weight: 0.2, source_confidence: 'high', data_status: 'loaded' }],
});
assert.match(html, /Selecionado:/);
assert.match(html, /&lt;fonte&gt;/);
assert.match(html, /&lt;fase&gt;/);
assert.match(html, /2026-01-01 a aberto · matriz.csv/);
assert.match(html, /cronograma oficial/);
assert.doesNotMatch(html, /<fonte>|<fase>/);
assert.match(renderTaxPeriodsHtml({}), /colspan="6">Cronograma oficial não carregado/);
"""
result = subprocess.run(
    ['node', '--input-type=module', '-e', script],
    cwd=ROOT,
    text=True,
    capture_output=True,
    timeout=30,
)
assert result.returncode == 0, result.stderr
print('PHASE5_TAX_PERIODS_VIEW_OK')
