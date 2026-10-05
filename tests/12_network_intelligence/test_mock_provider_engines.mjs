import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { parseCsv } from '../../assets/js/phase1/csv-parser.js';
import { renderResultsRisk, renderResultsSummary } from '../../assets/js/app/pages/results.js';
import { createMockProvider } from '../../assets/js/app/providers/mock-provider.js';

globalThis.fetch = async (input) => {
  const path = new URL(input).pathname;
  const relative = path.slice(path.indexOf('/data-demo/'));
  const body = await fs.readFile(`.${relative}`, 'utf8');
  return { ok: true, json: async () => JSON.parse(body) };
};

const provider = await createMockProvider();
const snapshot = await provider.init({ company_id: 'empresa_mock', runtime_mode: 'public' });
assert.equal(snapshot.company_id, 'empresa_mock');
assert.equal(snapshot.provider_kind, 'mock');
assert.equal(snapshot.meta.release_policy, 'demo_only');
assert.equal(snapshot.meta.capabilities.historical_uncertainty.supported, false);
assert.equal(snapshot.meta.capabilities.fiscal.decision_use, 'exploratory_only');
assert.equal(snapshot.meta.capabilities.fiscal.tax_reform_scenarios, true);
assert.equal(snapshot.meta.capabilities.fiscal.tax_reform_calculation, true);
assert.equal(
  snapshot.meta.capabilities.fiscal.baseline_policy,
  'synthetic_proxy_revenue_calculation_demo_only'
);
await assert.rejects(provider.init({ company_id: 'empresa1' }), /Provider incompatível/);

const loaded = await provider.loadScenarioLibrary();
assert.equal(loaded.company_id, 'empresa_mock');
assert.ok(!loaded.scenarios.some((scenario) => scenario.scenario_id === 'mock_tax_reform'));
assert.ok(
  loaded.unavailable_scenarios.some((scenario) => scenario.scenario_id === 'mock_tax_reform')
);
const baselineEnvelope = await provider.loadBaseline();
assert.equal(baselineEnvelope.provenance.company_id, 'empresa_mock');
assert.equal(
  baselineEnvelope.baseline.tax_results.tax_results.tax_source_label,
  'Parâmetros tributários sintéticos demonstrativos'
);
const baselineRun = await provider.runScenario({ scenarioId: 'mock_baseline' });
assert.equal(baselineRun.result.simulation_status, 'success');
assert.equal(baselineRun.result.decision_use, 'demo_only');
assert.equal(baselineRun.result.tax_results.tax_source_classification, 'synthetic_fixture');
assert.equal(provider.fixtures.baseline.costs.costs.total_logistics_cost, 290000);
assert.equal(provider.fixtures.baseline.costs.costs.tax_impact, 46000);
assert.equal(provider.fixtures.baseline.costs.costs.total_with_tax, 336000);
assert.equal(baselineRun.result.costs.tax_impact, 46000);
assert.equal(baselineRun.result.total_with_tax, 336000);
assert.equal(baselineRun.result.tax_results.tax_coverage.eligible_flow_count, 10);
assert.equal(baselineRun.result.tax_results.tax_coverage.complete_fiscal_coverage_ratio, 0);
assert.equal(baselineRun.result.tax_results.tax_coverage.coverage_limited, true);
assert.equal(baselineRun.result.tax_results.decision_use, 'exploratory_only');
assert.ok(
  provider.fixtures.baseline.warnings.some((warning) =>
    /categoria.*proxy|proxy.*sintética/i.test(warning)
  )
);
assert.equal(
  baselineRun.result.total_with_tax,
  provider.fixtures.baseline.costs.costs.total_with_tax,
  'baseline reference and unchanged baseline simulation must reconcile'
);
const annualDemoScenario = {
  scenario_id: 'empresa_mock_tax_reform_2030',
  scenario_name: 'Transição demonstrativa 2030',
  company_id: 'empresa_mock',
  scenario_type: 'tax_demo',
  base_scenario_id: 'mock_baseline',
  changes: {
    active_cds: ['CD Demo Norte', 'CD Demo Sul', 'CD Demo Centro'],
    closed_cds: [],
    freight_multiplier: 1,
    demand_multiplier: 1,
    inventory_days: 45,
    wacc: 0.15,
    tax_mode: 'reform_2030',
    tax_year: 2030,
    tax_regime: 'transition_2030',
  },
  metadata: { source: 'ScenarioBuilder' },
};
const annualDemoRun = await provider.runScenario({ scenario: annualDemoScenario });
assert.equal(annualDemoRun.scenario.changes.tax_year, 2030);
assert.equal(annualDemoRun.result.demo_only, true);
assert.equal(annualDemoRun.result.simulation_scope, 'exploratory_only');
assert.equal(annualDemoRun.result.tax_results.simulation_scope, 'exploratory_only');
assert.equal(annualDemoRun.result.tax_results.tax_coverage.eligible_flow_count, 10);
assert.equal(annualDemoRun.result.tax_results.decision_use, 'exploratory_only');
assert.ok(annualDemoRun.result.costs.tax_impact > 0);
await assert.rejects(
  provider.runScenario({
    scenario: {
      ...annualDemoScenario,
      scenario_id: 'empresa_mock_tax_reform_invalid',
      changes: { ...annualDemoScenario.changes, tax_mode: 'reform_2027_demo' },
    },
  }),
  /Cenário tributário demonstrativo inválido/
);
const untouchedBaselineFixture = JSON.parse(
  await fs.readFile('./data-demo/empresa_mock/baseline.json', 'utf8')
);
assert.equal(
  untouchedBaselineFixture.costs.costs.tax_impact,
  46000,
  'runtime normalization must not rewrite the source fixture'
);
const originalFixtureResult = provider.fixtures.scenarios.scenarios.find(
  (scenario) => scenario.scenario_id === 'mock_consolidation'
).result.total_with_tax;
const edited = await provider.runScenario({
  scenarioId: 'mock_consolidation',
  formValues: {
    scenario_name: 'Consolidação ajustada',
    active_cds: ['CD Demo Norte', 'CD Demo Centro'],
    freight_multiplier: 0.88,
    demand_multiplier: 1,
    inventory_days: 42,
    wacc: 0.15,
    tax_mode: 'current',
  },
});
assert.equal(edited.company_id, 'empresa_mock');
assert.equal(edited.provenance.release_policy, 'demo_only');
assert.notEqual(edited.scenario.scenario_id, 'mock_consolidation');
assert.equal(edited.scenario.scenario_type, 'manual');
assert.deepEqual(edited.scenario.changes.active_cds, ['CD Demo Norte', 'CD Demo Centro']);
assert.equal(edited.scenario.changes.freight_multiplier, 0.88);
assert.equal(edited.result.company_id, 'empresa_mock');
assert.equal(edited.result.simulation_status, 'success');
assert.notEqual(edited.result.total_with_tax, 312500, 'edited inputs must use the scenario engine');
assert.equal(edited.quality.company_id, 'empresa_mock');
assert.equal(
  provider.fixtures.scenarios.scenarios.find(
    (scenario) => scenario.scenario_id === 'mock_consolidation'
  ).result.total_with_tax,
  originalFixtureResult,
  'editing a library scenario must not overwrite its precomputed fixture'
);

await assert.rejects(
  provider.runScenario({ scenarioId: 'id-que-nao-existe' }),
  /Cenário demo não encontrado/
);
await assert.rejects(
  provider.runScenario({ scenario: { company_id: 'empresa1', scenario_id: 'foreign' } }),
  /pertencente a outra empresa/
);
await assert.rejects(
  provider.runScenario({ scenarioId: 'mock_tax_reform' }),
  /Cenário demo não encontrado/
);
const freightChanged = await provider.runScenario({
  scenarioId: 'mock_consolidation',
  formValues: {
    scenario_name: 'Referência com frete maior',
    active_cds: ['CD Demo Norte', 'CD Demo Sul', 'CD Demo Centro'],
    freight_multiplier: 1.2,
    demand_multiplier: 1,
    inventory_days: 45,
    wacc: 0.15,
    tax_mode: 'current',
  },
});
assert.notEqual(
  freightChanged.result.total_with_tax,
  baselineRun.result.total_with_tax,
  'freight input must affect the engine result even with unchanged CDs'
);

const defaultOptimization = await provider.runOptimization({ profileId: 'balanced' });
assert.equal(defaultOptimization.company_id, 'empresa_mock');
assert.ok(defaultOptimization.best_scenarios.length > 0);
for (const row of defaultOptimization.best_scenarios) {
  assert.equal(row.company_id, 'empresa_mock');
  assert.ok(row.scenario);
  assert.ok(row.result);
  assert.ok(row.quality);
  assert.equal(row.scenario.company_id, 'empresa_mock');
  assert.equal(row.result.company_id, 'empresa_mock');
  assert.equal(row.result.release_policy, 'demo_only');
  assert.ok(Array.isArray(row.active_cds));
  assert.equal(row.active_cd_count, row.active_cds.length);
}
const twoCdCandidates = defaultOptimization.scored_scenarios.filter(
  (row) => row.active_cds?.length === 2
);
assert.ok(twoCdCandidates.length > 0, 'fixture engine search should include a 2-CD candidate');
for (const row of twoCdCandidates) {
  assert.ok(row.result.costs.tax_impact > 0);
  assert.equal(row.result.tax_results.total_tax_impact, row.result.costs.tax_impact);
  assert.equal(
    row.result.total_with_tax,
    row.result.costs.total_logistics_cost + row.result.costs.tax_impact
  );
  assert.equal(
    row.result.total_with_tax,
    row.result.costs.total_logistics_cost + row.result.costs.tax_impact,
    'demo totals must reconcile logistics and synthetic tax components'
  );
}
const constrained = await provider.runOptimization({
  profileId: 'balanced',
  constraints: { min_active_cds: 3, max_active_cds: 3 },
});
assert.ok(constrained.scored_scenarios.length < defaultOptimization.scored_scenarios.length);
const supply = await provider.runOptimization({ profileId: 'supply' });
assert.notEqual(
  supply.search_log.best_scenario_id,
  defaultOptimization.search_log.best_scenario_id,
  'objective profile must reach the optimizer'
);

const decisionConfig = { max_candidates: 1000, seed: 19 };
const decisionConstraints = { min_active_cds: 1, max_active_cds: 999 };
const decisionOptimizer = await provider.runOptimization({
  profileId: 'balanced',
  config: decisionConfig,
  constraints: decisionConstraints,
});
const chosenId = decisionOptimizer.best_scenarios.at(-1).scenario_id;
const decision = await provider.buildDecisionPackage({
  selectionMode: 'manual',
  manualScenarioId: chosenId,
  optimizerConfig: decisionConfig,
  constraints: decisionConstraints,
  riskConfig: { iterations: 50, seed: 13, profile: 'conservative' },
});
assert.equal(decision.company_id, 'empresa_mock');
assert.equal(decision.provenance.release_policy, 'demo_only');
assert.equal(decision.selection.selected_scenario_id, chosenId);
assert.equal(decision.selected_scenario.result.company_id, 'empresa_mock');
assert.equal(decision.risk.monte_carlo.summary.iterations, 50);
assert.equal(decision.risk.monte_carlo.config.profile, 'conservative');
assert.equal(decision.risk.monte_carlo.release_policy, 'demo_only');
assert.equal(decision.export_package.release_policy, 'demo_only');
const decisionJson = JSON.parse(
  decision.export_package.files.find((file) => file.type === 'application/json').content
);
assert.equal(decisionJson.release_policy, 'demo_only');
assert.equal(decisionJson.decision_package.release_policy, 'demo_only');
assert.ok(
  decision.export_package.files
    .find((file) => file.type === 'text/html')
    .content.includes('Demonstração — dados sintéticos')
);
assert.equal(decision.optimizer.company_id, 'empresa_mock');
const csvFiles = decision.export_package.files.filter((file) => file.type === 'text/csv');
assert.ok(csvFiles.length > 0);
for (const file of csvFiles) {
  const rows = parseCsv(file.content);
  assert.ok(rows.length > 0);
  assert.ok(
    rows.every(
      (row) =>
        row.company_id === 'empresa_mock' &&
        row.provider_kind === 'mock' &&
        row.demo_only === 'true' &&
        row.release_policy === 'demo_only'
    ),
    file.filename
  );
}
const riskView = renderResultsRisk(
  {
    context: { company_id: 'empresa_mock', provider_kind: 'mock' },
    ui: { route: '/network/results/risk/advanced' },
    data: {
      selected_scenario: decision.selected_scenario.scenario,
      scenario_result: decision.selected_scenario.result,
      ...decision.risk,
    },
  },
  true
);
assert.ok(riskView.includes('data-testid="sensitivity-matrix"'));
assert.ok(!riskView.includes('Matriz de sensibilidade indisponível'));

const unknown = await provider.buildDecisionPackage({
  selectionMode: 'manual',
  manualScenarioId: 'scenario-unknown',
  riskConfig: { iterations: 50 },
});
assert.equal(unknown.company_id, 'empresa_mock');
assert.match(unknown.final_qa.blocking_issues.join(' '), /não encontrado/);
assert.equal(unknown.release.release_status, 'blocked');
const blockedView = renderResultsSummary({
  context: { company_id: 'empresa_mock' },
  ui: {},
  meta: { status: 'decision_blocked' },
  data: { ...unknown, selected_scenario: null },
});
assert.ok(blockedView.includes('data-testid="decision-blocked"'));
assert.ok(blockedView.includes('não encontrado'));
assert.ok(!blockedView.includes('data-action="open-export"'));

const risk = await provider.runRiskSuite({
  selectedScenario: edited.scenario,
  deterministicResult: edited.result,
  config: { iterations: 50, seed: 9, profile: 'broad', sensitivity_variable: 'wacc' },
});
assert.equal(risk.company_id, 'empresa_mock');
assert.equal(risk.provenance.release_policy, 'demo_only');
assert.equal(risk.monte_carlo.summary.iterations, 50);
assert.equal(risk.monte_carlo.config.profile, 'broad');
assert.equal(risk.sensitivity.most_sensitive_variable, 'wacc');
assert.ok(risk.stress.stress_results.every((result) => !/reforma/i.test(result.case_name)));
await assert.rejects(
  provider.runRiskSuite({
    selectedScenario: edited.scenario,
    deterministicResult: edited.result,
    config: { iterations: 50, scatter_driver: 'tax_multiplier' },
  }),
  /tax_multiplier indisponível/
);

console.log('NETWORK_MOCK_PROVIDER_ENGINES_OK');
