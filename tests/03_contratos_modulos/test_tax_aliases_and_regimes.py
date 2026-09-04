import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

code = r"""
import fs from 'node:fs';
import {runTaxCalculation} from './assets/js/shared/tax/tax-orchestrator.js';
import {resolveTaxRegime} from './assets/js/shared/tax-reform-config.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const aliasFiles = [
  'fiscal-category-rules.js',
  'fiscal-flow-builder.js',
  'tax-orchestrator.js',
  'tax-reform-parameters.js',
  'tax-regime-catalog.js',
];

for (const file of aliasFiles) {
  const canonical = await import(`./assets/js/shared/tax/${file}`);
  const alias = await import(`./assets/js/core/tax/${file}`);
  const canonicalKeys = Object.keys(canonical).sort();
  const aliasKeys = Object.keys(alias).sort();
  assert(JSON.stringify(aliasKeys) === JSON.stringify(canonicalKeys), `${file}: alias contract differs`);
  for (const key of canonicalKeys) {
    assert(alias[key] === canonical[key], `${file}: ${key} is not a direct reexport`);
  }
}

for (const file of ['legacy-tax-engine.js', 'reform-tax-engine.js', 'tax-quality-gate.js']) {
  assert(!fs.existsSync(`./assets/js/core/tax/${file}`), `${file}: código morto remanescente`);
}

assert(resolveTaxRegime({taxMode:'current'}) === 'legacy_current', 'current alias failed');
assert(resolveTaxRegime({taxMode:'disabled'}) === 'disabled', 'disabled alias failed');
assert(resolveTaxRegime({taxMode:'reform_2029'}) === 'transition_2029', 'transition alias failed');
assert(resolveTaxRegime({year:2033}) === 'reform_full_2033', '2033 resolution failed');

const baselineBundle = {
  model:{company_id:'empresa1'},
  costs:{costs:{total_logistics_cost:1000, total_tax_impact:180}},
  tax_results:{tax_results:{total_tax_impact:180}},
  flow_summary:{total_annual_revenue:1000},
  core_data:{},
};
const completeFlow = {
  flow_id:'f1', origin_uf:'SP', destination_uf:'RJ', annual_revenue:1000,
  ncm:'0000.00.00', cfop:'6102', cst:'00', fiscal_category:'default_goods',
};

const current = runTaxCalculation({baselineBundle, rebuiltFlows:[completeFlow], taxMode:'current'});
assert(current.total_tax_impact > 0, 'current regime must calculate a positive synthetic impact');
assert(current.metadata.validation_scope === 'parameterized_simulation_not_fiscal_validation', 'Empresa 1 scope must not claim fiscal validation');

const disabled = runTaxCalculation({baselineBundle, rebuiltFlows:[completeFlow], taxMode:'disabled'});
assert(disabled.total_tax_impact === 0 && disabled.tax_mode === 'disabled', 'disabled regime failed');

const transition = runTaxCalculation({baselineBundle, rebuiltFlows:[completeFlow], taxMode:'reform_2029'});
assert(transition.tax_regime === 'transition_2029', 'transition regime failed');
assert(Number.isFinite(transition.total_tax_impact), 'transition result must be finite');

const full2033 = runTaxCalculation({baselineBundle, rebuiltFlows:[completeFlow], taxMode:'reform_2033'});
assert(full2033.tax_regime === 'reform_full_2033', '2033 regime failed');
assert(Number.isFinite(full2033.total_tax_impact), '2033 result must be finite');

const missingRoute = runTaxCalculation({
  baselineBundle,
  rebuiltFlows:[{...completeFlow, destination_uf:''}],
  taxMode:'current',
});
assert(missingRoute.calculation_mode === 'top_down_fallback', 'missing route must force top-down fallback');
assert(missingRoute.errors.some(row => row.code === 'MISSING_DESTINATION_UF'), 'missing route error was hidden');

const proxyQuality = runTaxCalculation({
  baselineBundle,
  rebuiltFlows:[{...completeFlow, ncm:null, cfop:null, cst:null}],
  taxMode:'current',
});
assert(proxyQuality.precision_mode === 'realistic_proxy', 'proxy fiscal quality not reported');
assert(proxyQuality.warnings.some(row => row.code === 'PROXY_FLOWS'), 'proxy warning missing');

console.log('TAX_ALIASES_AND_REGIMES_OK');
"""

result = subprocess.run(
    ['node', '--input-type=module', '-e', code],
    cwd=ROOT,
    text=True,
    capture_output=True,
    timeout=120,
)
assert result.returncode == 0, result.stderr + result.stdout
print(result.stdout.strip())
