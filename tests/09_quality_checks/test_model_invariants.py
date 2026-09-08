import subprocess
import sys
from importlib import import_module
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tests'))
NODE_DECRYPT_HELPER = import_module('crypto_helpers').NODE_DECRYPT_HELPER


ROOT = Path(__file__).resolve().parents[2]
CODE = (
    NODE_DECRYPT_HELPER
    + r"""
import { buildScenarioFromForm } from './assets/js/phase3/scenario-builder.js';
import { runScenario } from './assets/js/phase3/scenario-simulator.js';
import { loadRuntimeBundle } from './tests/runtime_bundle_support.mjs';
import {
  MODEL_DEFAULTS,
  calculateInventoryCost,
  calculateSaving,
} from './assets/js/core/model-configuration.js';

const sameDrivers = {
  demandMultiplier: 1,
  inventoryDays: MODEL_DEFAULTS.inventory_days,
  wacc: MODEL_DEFAULTS.reference_wacc,
};
const referenceInventory = calculateInventoryCost({
  baseInventoryCost: 100,
  ...sameDrivers,
});
if (calculateInventoryCost({ baseInventoryCost: 100, ...sameDrivers }) !== referenceInventory)
  throw new Error('inventory calculation is not deterministic');
if (
  calculateInventoryCost({ baseInventoryCost: 100, ...sameDrivers, demandMultiplier: 1.1 }) <=
  referenceInventory
)
  throw new Error('inventory demand sensitivity is not monotonic');
if (
  calculateInventoryCost({ baseInventoryCost: 100, ...sameDrivers, inventoryDays: 60 }) <=
  referenceInventory
)
  throw new Error('inventory days sensitivity is not monotonic');
if (
  calculateInventoryCost({ baseInventoryCost: 100, ...sameDrivers, wacc: 0.2 }) <=
  referenceInventory
)
  throw new Error('inventory WACC sensitivity is not monotonic');

for (const companyId of ['empresa1', 'empresa2']) {
  const bundle = loadRuntimeBundle({
    companyId,
    decryptJson,
  });
  const cds = bundle.model.active_cds || [];
  const reduced = cds.slice(0, Math.max(1, cds.length - 1));
  const make = (active_cds) => buildScenarioFromForm({
    companyId,
    baselineBundle: bundle,
    formValues: {
      scenario_name: `invariant ${active_cds.length}`,
      active_cds,
      freight_multiplier: 1,
      demand_multiplier: 1,
      inventory_days: MODEL_DEFAULTS.inventory_days,
      wacc: MODEL_DEFAULTS.reference_wacc,
      tax_mode: 'current',
    },
  });
  const reducedResult = runScenario({ companyId, scenario: make(reduced), baselineBundle: bundle });
  const fullResult = runScenario({ companyId, scenario: make(cds), baselineBundle: bundle });
  if (reducedResult.simulation_status !== 'success' || fullResult.simulation_status !== 'success')
    throw new Error(`${companyId}: inventory comparison scenario did not run`);
  if (
    Math.abs(reducedResult.costs.inventory_cost - fullResult.costs.inventory_cost) > 0.01
  )
    throw new Error(`${companyId}: Choice B inventory cost depends on active CD count`);

  if (!fullResult.costs.diagnostics?.fallback_rates) {
    throw new Error(`${companyId}: fallback rates are not exposed in the physical diagnostics`);
  }
  if (companyId === 'empresa1') {
    if (
      fullResult.costs.diagnostics.source_classification !==
      'observed_distribution_plus_cross_company_calibrated_transfer_proxy'
    )
      throw new Error('empresa1: transfer proxy provenance is not classified');
    if (!String(fullResult.costs.diagnostics.transfer_proxy_provenance?.source_company).length)
      throw new Error('empresa1: transfer proxy source company is missing');
    if (!String(fullResult.tax_results.tax_source_label).includes('Proxy tributário'))
      throw new Error('empresa1: tax proxy is not visible in the scenario result');
  }
  if (companyId === 'empresa2') {
    const flowMethods = fullResult.costs.diagnostics?.flow_method_counts || {};
    if (!(flowMethods.factory_to_cd_not_distribution > 0))
      throw new Error('empresa2: factory→CD volume was not kept out of CIF pricing');
    if (!(fullResult.costs.diagnostics?.fallback_counts?.missing_weight > 0))
      throw new Error('empresa2: missing distribution weight is not surfaced');
  }

  for (const result of [reducedResult, fullResult]) {
    const costs = result.costs;
    const total = costs.transfer_cost + costs.distribution_cost + costs.storage_cost +
      costs.inventory_cost + costs.tax_impact;
    if (Math.abs(total - result.total_with_tax) > 0.01)
      throw new Error(`${companyId}: component total does not reconcile`);
  }
}

const saving = calculateSaving({ baselineTotal: 100, scenarioTotal: 75 });
if (saving.saving_abs !== 25 || saving.saving_pct !== 25) throw new Error('saving invariant failed');
console.log('MODEL_INVARIANTS_OK');
"""
)

result = subprocess.run(
    ['node', '--input-type=module', '-e', CODE],
    cwd=ROOT,
    text=True,
    capture_output=True,
)
assert result.returncode == 0, result.stderr + result.stdout
print(result.stdout.strip())
