import subprocess
import sys
from importlib import import_module
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
NODE_DECRYPT_HELPER = import_module('tests.crypto_helpers').NODE_DECRYPT_HELPER


ROOT = Path(__file__).resolve().parents[2]

CODE = (
    NODE_DECRYPT_HELPER
    + r"""
import { loadRuntimeBundle } from './tests/runtime_bundle_support.mjs';
import { buildScenarioFromForm } from './assets/js/phase3/scenario-builder.js';
import { runScenario } from './assets/js/phase3/scenario-simulator.js';
import { runMonteCarloSimulation } from './assets/js/phase3/monte-carlo-engine.js';
import { generateCandidateScenarios } from './assets/js/phase4/candidate-scenario-generator.js';
import { scenarioChangesKey } from './assets/js/phase4/optimizer-utils.js';
import { runTaxCalculation } from './assets/js/core/tax/tax-orchestrator.js';
import { getTaxReformConfig } from './assets/js/core/tax-reform-config.js';

for (const companyId of ['empresa1', 'empresa2']) {
  const bundle = loadRuntimeBundle({ companyId, decryptJson });
  const activeCds = bundle.model.active_cds || [];
  const scenario = buildScenarioFromForm({
    companyId,
    baselineBundle: bundle,
    formValues: {
      scenario_name: 'quality-contract',
      active_cds: activeCds,
      freight_multiplier: 1,
      demand_multiplier: 1,
      inventory_days: 45,
      wacc: 0.15,
      tax_mode: 'current',
    },
  });
  const result = runScenario({ companyId, scenario, baselineBundle: bundle });
  if (result.simulation_status !== 'success') throw new Error(`${companyId}: scenario failed`);
  if (!result.evidence || !Number.isFinite(result.evidence.evidence_score))
    throw new Error(`${companyId}: evidence report missing`);
  if (!Array.isArray(result.evidence.components)) throw new Error(`${companyId}: evidence components missing`);
  if (!result.tax_results.tax_coverage) throw new Error(`${companyId}: tax coverage missing`);
  if (result.evidence.blockers.length && result.evidence.evidence_score >= 70)
    throw new Error(`${companyId}: material evidence blockers received high score`);
  if (companyId === 'empresa2' && !(result.tax_results.tax_input_match_summary?.observed_flow_count > 0))
    throw new Error(`${companyId}: observed tax rows were not associated to flows`);
  if (companyId === 'empresa1' && !(result.tax_results.tax_input_match_summary?.observed_flow_count > 0))
    throw new Error(`${companyId}: shared observed tax rows were not associated to flows`);

  const first = runMonteCarloSimulation({
    companyId,
    selectedScenario: scenario,
    baselineBundle: bundle,
    deterministicResult: result,
    iterations: 60,
    seed: 7,
  });
  const second = runMonteCarloSimulation({
    companyId,
    selectedScenario: scenario,
    baselineBundle: bundle,
    deterministicResult: result,
    iterations: 60,
    seed: 7,
  });
  if (companyId === 'empresa2') {
    if (first.monte_carlo_status !== 'blocked_by_data_quality' || first.summary !== null)
      throw new Error(`${companyId}: Monte Carlo should block on incomplete fiscal coverage`);
    continue;
  }
  if (first.config.uncertainty_source !== 'parametric_assumptions')
    throw new Error(`${companyId}: default MC is not explicitly parametric`);
  if (first.summary.probability_interpretation !== 'condicional_as_premissas_parametricas')
    throw new Error(`${companyId}: probability interpretation missing`);
  if (JSON.stringify(first.summary) !== JSON.stringify(second.summary))
    throw new Error(`${companyId}: MC is not reproducible`);

  const historical = runMonteCarloSimulation({
    companyId,
    selectedScenario: scenario,
    baselineBundle: bundle,
    deterministicResult: result,
    iterations: 60,
    seed: 7,
    config: {
      history: {
        provenance: {
          source: 'synthetic_test_fixture',
          period_start: '2024-01-01',
          period_end: '2024-12-31',
          company_id: companyId,
          unit: 'mixed_declared_test_units',
        },
        freight_multiplier: [0.9, 1.0, 1.1],
        demand_multiplier: [0.95, 1.0, 1.05],
        inventory_days: [40, 45, 50],
        wacc: [0.12, 0.15, 0.18],
        tax_multiplier: [0.95, 1.0, 1.05],
        observations: [
          { freight_multiplier: 0.9, demand_multiplier: 0.95, inventory_days: 40, wacc: 0.12, tax_multiplier: 0.95 },
          { freight_multiplier: 1.1, demand_multiplier: 1.05, inventory_days: 50, wacc: 0.18, tax_multiplier: 1.05 },
        ],
      },
    },
  });
  if (historical.config.uncertainty_source !== 'empirical_historical')
    throw new Error(`${companyId}: historical MC was not activated`);
  if (!historical.config.historical_distribution)
    throw new Error(`${companyId}: historical distribution flag missing`);
  if (historical.config.historical_sampling !== 'joint_empirical_bootstrap')
    throw new Error(`${companyId}: joint historical sampling missing`);
  const reloaded = runMonteCarloSimulation({
    companyId,
    selectedScenario: scenario,
    baselineBundle: bundle,
    deterministicResult: result,
    iterations: 60,
    seed: 7,
    config: { historical_data: historical.config.historical_data },
  });
  if (reloaded.config.uncertainty_source !== 'empirical_historical')
    throw new Error(`${companyId}: persisted historical_data was not reloaded`);

  const jointOnly = runMonteCarloSimulation({
    companyId,
    selectedScenario: scenario,
    baselineBundle: bundle,
    deterministicResult: result,
    iterations: 60,
    seed: 7,
    config: {
      history: {
        provenance: {
          source: 'synthetic_test_fixture',
          period_start: '2024-01-01',
          period_end: '2024-12-31',
          company_id: companyId,
          unit: 'mixed_declared_test_units',
        },
        observations: [
          { freight_multiplier: 0.9, demand_multiplier: 0.95, inventory_days: 40, wacc: 0.12, tax_multiplier: 0.95 },
          { freight_multiplier: 1.1, demand_multiplier: 1.05, inventory_days: 50, wacc: 0.18, tax_multiplier: 1.05 },
        ],
      },
    },
  });
  if (jointOnly.config.uncertainty_source !== 'empirical_historical')
    throw new Error(`${companyId}: joint observations were not converted to empirical drivers`);
  if (jointOnly.config.historical_sampling !== 'joint_empirical_bootstrap')
    throw new Error(`${companyId}: joint-only historical sampling missing`);

  if (scenarioChangesKey({ b: 2, a: 1 }) !== scenarioChangesKey({ a: 1, b: 2 }))
    throw new Error(`${companyId}: scenario key depends on object property order`);

  const truncated = generateCandidateScenarios({
    companyId,
    baselineBundle: bundle,
    generationConfig: { max_candidates: 1, seed: 3 },
  });
  if (!truncated.generation_summary.limited_by_max_candidates)
    throw new Error(`${companyId}: candidate limit not surfaced`);
  if (truncated.generation_summary.search_space_complete)
    throw new Error(`${companyId}: truncated search marked complete`);
  if (truncated.generation_summary.space_coverage_ratio > 1)
    throw new Error(`${companyId}: candidate coverage exceeded 100%`);
}

const customConfig = getTaxReformConfig();
customConfig.regimes = {
  ...customConfig.regimes,
  custom_test: {
    label: 'Teste configurável',
    ui_mode: 'custom_test',
    year: 2030,
    current_weight: 0,
    cbs_rate: 0.5,
    ibs_rate: 0,
    selective_rate: 0,
    category_rules: {
      default_goods: {
        cbs_rate_multiplier: 1,
        ibs_rate_multiplier: 1,
        selective_rate_multiplier: 0,
        credit_rate: 0,
      },
    },
  },
};
const syntheticBundle = {
  model: { company_id: 'empresa2', scenario_id: 'baseline_atual' },
  core_data: { tax_data: [] },
  complements: {
    tax_reform_timeline: [{ ano: 2030, fase: 'transição', peso_icms_iss_regime_atual: 0.8, peso_ibs_regime_novo: 0.2 }],
    tax_scenario_bridge: [],
    field_sources: {
      'tax_inputs_reform.ibs_cbs_is_transition': {
        source_confidence: 'external_official',
        source_file: 'timeline.csv',
      },
    },
  },
};
const customTax = runTaxCalculation({
  baselineBundle: syntheticBundle,
  rebuiltFlows: [{ flow_id: 'f1', origin_uf: 'SP', destination_uf: 'RJ', gross_revenue: 100, fiscal_category: 'default_goods' }],
  baseTaxBlock: { total_tax_impact: 10 },
  taxRegime: 'custom_test',
  config: customConfig,
});
if (!(customTax.cbs_total > 0)) throw new Error('custom tax regime did not govern reform rate');
if (customTax.metadata?.tax_period_contract?.reform_rate_provenance?.status !== 'source_rate_not_defined_model_parameter')
  throw new Error('reform rate provenance is not explicit');
if (customTax.metadata?.tax_period_contract?.available_periods?.length !== 1)
  throw new Error('tax period contract did not expose all loaded periods');

const transitionTax = runTaxCalculation({
  baselineBundle: syntheticBundle,
  rebuiltFlows: [{ flow_id: 'f1', origin_uf: 'SP', destination_uf: 'RJ', gross_revenue: 100, fiscal_category: 'default_goods' }],
  baseTaxBlock: { total_tax_impact: 10 },
  taxRegime: 'transition_2030',
  config: getTaxReformConfig(),
});
const components = transitionTax.tax_breakdown_by_component;
const componentTotal = components.current_tax + components.cbs_total + components.ibs_total + components.selective_tax_total - components.credits_total;
if (Math.abs(componentTotal - transitionTax.total_tax_impact) > 1e-9)
  throw new Error('transition tax components do not reconcile with total');
console.log('EVIDENCE_UNCERTAINTY_CONTRACTS_OK');
"""
)

result = subprocess.run(
    ['node', '--input-type=module', '-e', CODE],
    cwd=ROOT,
    text=True,
    capture_output=True,
    timeout=180,
)
assert result.returncode == 0, result.stderr + result.stdout
print(result.stdout.strip())
