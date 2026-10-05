import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
code = r"""
const elements = new Map();
globalThis.document = {
  getElementById(id) {
    return elements.get(id);
  },
  createElement() {
    return { id: '', innerHTML: '', remove() { this.removed = true; } };
  },
};
for (const id of [
  'phase3CompanyLabel',
  'baselineCards',
  'baselineFinanceTable',
  'cdSelector',
  'scenarioLibrary',
]) {
  elements.set(id, { innerHTML: '', textContent: '', before(value) { this.inserted = value; } });
}
const {
  renderBaseline,
  renderCdChecks,
  renderLibraryWarnings,
  renderScenarioLibrary,
} = await import('./assets/js/phase3/scenario-arena/library-view.js');

const library = {
  baselineBundle: {
    model: {
      scenario_id: 'base <um>',
      baseline_status: 'ready',
      active_cds: ['CD <A>'],
      origins: ['O1'],
      destinations: ['D1'],
    },
    costs: { costs: { total_with_tax: 1200, tax_impact: 100 } },
    flows: [{}],
    base_fit: { base_fit_score: 90, status: 'ok' },
  },
  warnings: [{ message: 'alerta <seguro>' }],
  scenarios: [{
    scenario_id: 'cenario <id>',
    scenario_name: 'Nome <seguro>',
    scenario_type: 'manual',
    metadata: { source: 'local' },
    monte_carlo: { summary: { probability_saving_positive: 0.75 } },
  }],
};

renderBaseline({ companyId: 'empresa1', library });
renderCdChecks(library);
renderLibraryWarnings(library);
renderScenarioLibrary(library);

if (elements.get('phase3CompanyLabel').textContent !== 'Empresa 1') throw new Error('company label contract');
if (!elements.get('baselineCards').innerHTML.includes('base &lt;um&gt;')) throw new Error('baseline escaping contract');
if (!elements.get('baselineFinanceTable').innerHTML.includes('Total com tributo')) throw new Error('baseline finance table contract');
if (!elements.get('cdSelector').innerHTML.includes('value="CD &lt;A&gt;"')) throw new Error('CD selector escaping contract');
if (!elements.get('baselineCards').inserted.innerHTML.includes('alerta &lt;seguro&gt;')) throw new Error('warning rendering contract');
if (!elements.get('scenarioLibrary').innerHTML.includes('Nome &lt;seguro&gt;')) throw new Error('scenario name escaping contract');
if (!elements.get('scenarioLibrary').innerHTML.includes('MC 75%')) throw new Error('Monte Carlo summary contract');
console.log('PHASE3_LIBRARY_VIEW_OK');
"""
result = subprocess.run(
    ['node', '--input-type=module', '-e', code],
    cwd=ROOT,
    text=True,
    capture_output=True,
)
assert result.returncode == 0, result.stderr + result.stdout
print(result.stdout.strip())
