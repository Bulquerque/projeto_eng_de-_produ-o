import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

code = r"""
import {calculatePhysicalCosts} from './assets/js/phase3/physical-cost-engine.js';
import {MODEL_ASSUMPTIONS} from './assets/js/shared/model-assumptions.js';
import {runScenario} from './assets/js/phase3/scenario-simulator.js';
import {runMonteCarloSimulation} from './assets/js/phase3/monte-carlo-engine.js';
import {calculateRobustness} from './assets/js/phase5/robustness-scorer.js';
import {classifyReconciliationPct} from './assets/js/shared/reconciliation-engine.js';
import {normalizeMetrics} from './assets/js/phase4/metric-normalizer.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const baselineBundle = {
  model: {
    company_id: 'empresa1',
    scenario_id: 'baseline_empresa1',
    active_cds: ['SP/CD1', 'RJ/CD2'],
  },
  flows: [
    {flow_id:'f1', cd:'SP/CD1', cd_uf:'SP', destination:'DESTINO1', destination_uf:'SP', annual_weight_kg:1000, annual_revenue:50000},
    {flow_id:'f2', cd:'RJ/CD2', cd_uf:'RJ', destination:'DESTINO2', destination_uf:'RJ', annual_weight_kg:800, annual_revenue:40000},
  ],
  costs: {costs: {transfer_cost:400, distribution_cost:1800, storage_cost:1000, inventory_cost:600, tax_impact:300, total_logistics_cost:3800, total_with_tax:4100}},
  tax_results: {tax_results:{total_tax_impact:300}},
  core_data: {distance_matrix:[
    {ORIGEM:'SP/CD1', DESTINO:'DESTINO1', UF_ORIGEM:'SP', UF_DESTINO:'SP', 'Frete (R$/Kg)':1.1, 'Distancia(KM)':100},
    {ORIGEM:'RJ/CD2', DESTINO:'DESTINO2', UF_ORIGEM:'RJ', UF_DESTINO:'RJ', 'Frete (R$/Kg)':1.2, 'Distancia(KM)':120},
  ]},
};

function scenario(activeCds, id='test') {
  return {
    scenario_id:id,
    scenario_name:id,
    company_id:'empresa1',
    base_scenario_id:'baseline_empresa1',
    changes:{
      active_cds:activeCds,
      closed_cds:baselineBundle.model.active_cds.filter(cd => !activeCds.includes(cd)),
      freight_multiplier:1,
      demand_multiplier:1,
      inventory_days:45,
      wacc:0.15,
      tax_mode:'current',
      tax_regime:'legacy_current',
      reallocation_rule:'first_available_cd',
    },
  };
}

const rebuilt = {flows:baselineBundle.flows};
const full = calculatePhysicalCosts({companyId:'empresa1', scenario:scenario(['SP/CD1','RJ/CD2'],'full'), baselineBundle, rebuilt});
const central = calculatePhysicalCosts({companyId:'empresa1', scenario:scenario(['SP/CD1'],'central'), baselineBundle, rebuilt});
assert(full.inventory_cost === central.inventory_cost, 'inventory must not imply unimplemented CD pooling');
assert(full.inventory_calculation_mode === 'days_wacc_only', 'inventory mode must be explicit');
assert(full.inventory_pooling_effect_included === false, 'pooling flag must be false');
assert(full.warnings.some(x => x.includes('não inclui pooling')), 'inventory limitation warning missing');
assert(full.warnings.some(x => x.includes('Empresa 2')), 'cross-company transfer proxy warning missing');
assert(full.fallback_usage.cross_company_transfer_proxy_flows === 2, 'proxy coverage count mismatch');

const e2 = calculatePhysicalCosts({
  companyId:'empresa2',
  scenario:{changes:{active_cds:['ES'], freight_multiplier:1, demand_multiplier:1, inventory_days:45, wacc:0.15}},
  baselineBundle:{model:{active_cds:['ES']}, costs:{costs:{storage_cost:100, inventory_cost:50}}, core_data:{}},
  rebuilt:{flows:[{flow_id:'e2f', cd:'ES', destination:'XX', annual_weight_kg:10, annual_revenue:1000, reallocation_status:'reallocated'}]},
});
assert(e2.transfer_cost === 25, '2.5% revenue transfer fallback mismatch');
assert(e2.fallback_usage.storage_proxy_used === true, 'storage fallback must be reported');
assert(e2.fallback_usage.revenue_pct_fallback_cost_brl === 50, 'distribution and transfer fallback costs must be disclosed');
assert(e2.fallback_usage.revenue_pct_fallback_revenue_share_pct === 100, 'fallback revenue coverage mismatch');

const e2PartialStorage = calculatePhysicalCosts({
  companyId:'empresa2',
  scenario:{changes:{active_cds:['ES','SP'], freight_multiplier:1, demand_multiplier:1, inventory_days:45, wacc:0.15}},
  baselineBundle:{
    model:{active_cds:['ES','SP']},
    costs:{costs:{storage_cost:1200, inventory_cost:50}},
    core_data:{aux_custo_armazenagem:[{Filial:'ES', Custo:10}]},
  },
  rebuilt:{flows:[]},
});
assert(e2PartialStorage.storage_cost === 1200, 'partial storage table must not be treated as complete');
assert(e2PartialStorage.warnings.some(x => x.includes('1 CD(s)')), 'missing storage CD warning must report coverage');

const selected = scenario(['SP/CD1','RJ/CD2'],'mc');
const deterministic = runScenario({companyId:'empresa1', scenario:selected, baselineBundle});
assert(deterministic.simulation_status === 'success', 'synthetic deterministic scenario failed');
const mcA = runMonteCarloSimulation({companyId:'empresa1', selectedScenario:selected, baselineBundle, deterministicResult:deterministic, iterations:80, seed:123});
const mcB = runMonteCarloSimulation({companyId:'empresa1', selectedScenario:selected, baselineBundle, deterministicResult:deterministic, iterations:80, seed:123});
const mcC = runMonteCarloSimulation({companyId:'empresa1', selectedScenario:selected, baselineBundle, deterministicResult:deterministic, iterations:80, seed:124});
assert(mcA.samples.length === 80, 'Monte Carlo iteration count mismatch');
assert(JSON.stringify(mcA.summary) === JSON.stringify(mcB.summary), 'same seed must reproduce summary');
assert(JSON.stringify(mcA.summary) !== JSON.stringify(mcC.summary), 'different seeds must change summary');
for (const driver of ['freight_multiplier','demand_multiplier','inventory_days','wacc','tax_multiplier']) {
  const values = new Set(mcA.samples.map(row => row.inputs[driver]));
  assert(values.size > 1, `${driver} was not sampled`);
}
assert(mcA.summary.p10_saving_pct <= mcA.summary.median_saving_pct, 'p10 must not exceed median');
assert(mcA.summary.median_saving_pct <= mcA.summary.p90_saving_pct, 'median must not exceed p90');
assert(mcA.summary.probability_saving_positive >= 0 && mcA.summary.probability_saving_positive <= 1, 'invalid saving probability');
assert(MODEL_ASSUMPTIONS.monte_carlo.default_iterations === 300, 'canonical Monte Carlo defaults missing');
assert(mcA.methodology.calibration_status === 'manual_spreads_not_historically_calibrated', 'Monte Carlo calibration limitation missing');
assert(mcA.warnings.some(x => x.includes('exploratória')), 'Monte Carlo exploratory warning missing');

const spreadByDriver = {
  freight_multiplier:0.1,
  demand_multiplier:0.1,
  inventory_days:12,
  wacc:0.04,
  tax_multiplier:0.1,
};
for (const [driver, spread] of Object.entries(spreadByDriver)) {
  const isolatedSpread = Object.fromEntries(Object.keys(spreadByDriver).map(key => [key, key === driver ? spread : 0]));
  const isolated = runMonteCarloSimulation({
    companyId:'empresa1',
    selectedScenario:selected,
    baselineBundle,
    deterministicResult:deterministic,
    iterations:60,
    seed:321,
    config:{spread:isolatedSpread, shared_shock:0, idiosyncratic_shock:1},
  });
  assert(new Set(isolated.samples.map(row => row.total_with_tax.toFixed(8))).size > 1, `${driver} is sampled but does not affect the result`);
}

for (const sample of mcA.samples) {
  assert(sample.inputs.freight_multiplier >= 0.6 && sample.inputs.freight_multiplier <= 1.8, 'freight bound violated');
  assert(sample.inputs.demand_multiplier >= 0.6 && sample.inputs.demand_multiplier <= 1.6, 'demand bound violated');
  assert(sample.inputs.inventory_days >= 0 && sample.inputs.inventory_days <= 120, 'inventory bound violated');
  assert(sample.inputs.wacc >= 0 && sample.inputs.wacc <= 0.5, 'WACC bound violated');
  assert(sample.inputs.tax_multiplier >= 0.7 && sample.inputs.tax_multiplier <= 1.35, 'tax bound violated');
}
const invalidMc = runMonteCarloSimulation({companyId:'empresa1', selectedScenario:selected});
assert(invalidMc.monte_carlo_status === 'error' && invalidMc.samples.length === 0, 'invalid Monte Carlo input must fail explicitly');

const robustness = calculateRobustness({companyId:'empresa1', scenarioId:'x', stressResults:[]});
assert(robustness.calculation_mode === 'parameterized_proxy', 'robustness proxy mode missing');
assert(robustness.warnings.length === 2, 'silent robustness defaults remain');

assert(classifyReconciliationPct(3) === 'aligned', '3% must be aligned');
assert(classifyReconciliationPct(-10) === 'tolerable', '10% must be tolerable');
assert(classifyReconciliationPct(10.01) === 'divergent', 'above 10% must be divergent');
assert(classifyReconciliationPct(null) === 'pending', 'missing comparison must be pending');

const normalized = normalizeMetrics({
  companyId:'empresa1',
  scenarioMetrics:[
    {scenario_id:'a', total_cost:100, service_quality:80, operational_risk:20, tax_impact:10, inventory_efficiency:70},
    {scenario_id:'b', total_cost:90, service_quality:70, operational_risk:10, tax_impact:20, inventory_efficiency:80},
  ],
});
assert(normalized.candidate_set_dependent === true, 'candidate-set dependence must be explicit');
assert(normalized.warnings.some(x => x.includes('conjunto de cenários')), 'min-max dependence warning missing');

assert(Object.keys(MODEL_ASSUMPTIONS.fallback_catalog).length >= 6, 'fallback catalog incomplete');

console.log('PHASE3_ASSUMPTIONS_LOGIC_OK');
"""

result = subprocess.run(
    ['node', '--input-type=module', '-e', code],
    cwd=ROOT,
    text=True,
    capture_output=True,
)
assert result.returncode == 0, result.stderr + result.stdout
print(result.stdout.strip())
