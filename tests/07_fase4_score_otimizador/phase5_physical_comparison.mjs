import assert from 'node:assert/strict';
import { buildScenarioFromForm } from '../../assets/js/phase3/scenario-builder.js';
import { runScenario } from '../../assets/js/phase3/scenario-simulator.js';
import {
  applyStressCaseToScenario,
  runStressTests,
} from '../../assets/js/phase5/stress-test-engine.js';
import { runSensitivity, runSensitivityMatrix } from '../../assets/js/phase5/sensitivity-engine.js';
import { runDecisionPipeline } from '../../assets/js/app/services/decision-service.js';
import { renderResultsSummary, comparisonCandidates } from '../../assets/js/app/pages/results.js';
import { buildBaselineScenario } from '../../assets/js/phase4/optimizer-utils.js';
import { buildExecutiveReportHtml } from '../../assets/js/phase5/executive-report-builder.js';

const companyId = 'empresa1';
const bundle = {
  model: { scenario_id: 'baseline', active_cds: ['CD A', 'CD B'] },
  flows: [
    {
      flow_id: 'flow',
      flow_type: 'cd_to_destination',
      cd: 'CD A',
      centroid: 'Cidade X',
      destination_uf: 'SP',
      annual_weight_kg: 100,
      annual_revenue: 1000,
    },
  ],
  core_data: {
    distance_matrix: ['CD A', 'CD B'].map((cd) => ({
      DESTINO: 'Cidade X',
      UF_DESTINO: 'SP',
      ORIGEM: cd,
      UF_ORIGEM: 'SP',
      'Distancia(KM)': 20,
      'Frete (R$/Kg)': 1,
    })),
  },
  costs: {
    costs: {
      transfer_cost: 1000,
      distribution_cost: 2000,
      storage_cost: 3000,
      inventory_cost: 4000,
      tax_impact: 5000,
      total_logistics_cost: 10000,
      total_with_tax: 15000,
    },
  },
};
const scenario = buildScenarioFromForm({
  companyId,
  baselineBundle: bundle,
  scenarioId: 'candidate',
  formValues: { active_cds: ['CD A', 'CD B'], inventory_days: 30, tax_mode: 'disabled' },
});
const reference = runScenario({
  companyId,
  scenario,
  baselineBundle: bundle,
  baselineMode: 'physical_unanchored',
});
assert.notEqual(reference.total_with_tax, bundle.costs.costs.total_with_tax);
const which = process.argv[2];
if (!which || which === 'tax_context') {
  for (const [context, expected] of [
    [{ tax_mode: 'reform_2033' }, 'reform_full_2033'],
    [{ tax_year: 2030 }, 'transition_2030'],
    [{ tax_mode: 'disabled' }, 'disabled'],
    [{}, 'current'],
  ]) {
    const baseline = buildBaselineScenario(companyId, bundle, context);
    assert.equal(baseline.changes.tax_regime, expected);
  }
}
if (!which || which === 'stress') {
  const stress = runStressTests({
    companyId,
    selectedScenario: scenario,
    baselineBundle: bundle,
    stressCases: [{ case_id: 'neutral', name: 'neutral', changes: {} }],
  });
  assert.equal(stress.stress_results[0].total_with_tax, reference.total_with_tax);
  assert.equal(stress.stress_results[0].saving_pct, 0);
  assert.equal(stress.stress_results[0].decision_use, 'exploratory_only');
  const current = buildScenarioFromForm({
    companyId,
    baselineBundle: bundle,
    scenarioId: 'current',
    formValues: { active_cds: ['CD A', 'CD B'], inventory_days: 30, tax_mode: 'current' },
  });
  const expected = runScenario({
    companyId,
    scenario: current,
    baselineBundle: bundle,
    baselineMode: 'physical_unanchored',
  });
  const currentStress = runStressTests({
    companyId,
    selectedScenario: current,
    baselineBundle: bundle,
    stressCases: [{ case_id: 'neutral', name: 'neutral', changes: {} }],
  });
  assert.equal(currentStress.stress_results[0].total_with_tax, expected.total_with_tax);
  assert.equal(currentStress.stress_results[0].saving_pct, 0);
  const missing = runStressTests({
    companyId,
    selectedScenario: current,
    baselineBundle: { ...bundle, model: { ...bundle.model, active_cds: [] } },
    stressCases: [{ case_id: 'neutral', name: 'neutral', changes: {} }],
  });
  assert.equal(missing.stress_results[0].status, 'blocked');
  assert.equal(missing.stress_results[0].saving_pct, null);
  const changedFiscal = applyStressCaseToScenario({
    companyId,
    scenario: {
      ...scenario,
      changes: {
        ...scenario.changes,
        tax_mode: 'reform_2030',
        tax_regime: 'transition_2030',
        tax_year: 2030,
      },
    },
    baselineBundle: bundle,
    stressCase: {
      case_id: 'reform_2033',
      changes: { tax_mode: 'reform_2033', tax_regime: 'reform_full_2033' },
    },
  });
  assert.equal(changedFiscal.changes.tax_regime, 'reform_full_2033');
  assert.equal(changedFiscal.changes.tax_year, undefined);
  const taxStress = runStressTests({
    companyId,
    selectedScenario: current,
    baselineBundle: bundle,
    stressCases: [
      {
        case_id: 'reform_2033',
        name: '2033',
        changes: { tax_mode: 'reform_2033', tax_regime: 'reform_full_2033' },
      },
    ],
  }).stress_results[0];
  assert.equal(taxStress.baseline_tax_regime, 'reform_full_2033');
  assert.equal(taxStress.saving_pct, 0);
  const yearStress = applyStressCaseToScenario({
    companyId,
    scenario: current,
    baselineBundle: bundle,
    stressCase: { case_id: 'year_2030', changes: { tax_year: 2030 } },
  });
  assert.equal(yearStress.changes.tax_regime, 'transition_2030');
}
if (!which || which === 'sensitivity') {
  const s = runSensitivity({
    companyId,
    selectedScenario: scenario,
    baselineBundle: bundle,
    sensitivityConfig: { variable: 'freight_multiplier', values: [1] },
  });
  const m = runSensitivityMatrix({
    companyId,
    selectedScenario: scenario,
    baselineBundle: bundle,
    matrixConfig: {
      xVariable: 'freight_multiplier',
      yVariable: 'demand_multiplier',
      xValues: [1],
      yValues: [1],
    },
  });
  assert.equal(s.sensitivity_results[0].total_with_tax, reference.total_with_tax);
  assert.equal(s.sensitivity_results[0].saving_pct, 0);
  assert.equal(m.matrix_results[0].total_with_tax, reference.total_with_tax);
  assert.equal(m.matrix_results[0].saving_pct, 0);
}
if (!which || which === 'decision') {
  const selected = {
    company_id: companyId,
    scenario_id: 'candidate',
    scenario,
    result: reference,
    quality: {},
    final_score: 1,
  };
  const optimizer = {
    company_id: companyId,
    optimizer_status: 'success',
    scored_scenarios: [selected],
    best_scenarios: [selected],
    baseline_reference: {
      scenario: { ...scenario, scenario_id: 'baseline' },
      result: { ...reference, scenario_id: 'baseline' },
    },
    search_log: {},
  };
  const provider = {
    getDomainContext: () => ({ company_id: companyId, baselineBundle: bundle }),
    runRiskSuite: async () => ({
      stress: { stress_results: [] },
      robustness: {},
      sensitivity: {},
      sensitivity_matrix: {},
    }),
  };
  const decision = await runDecisionPipeline({
    provider,
    selectionMode: 'manual',
    manualScenarioId: 'candidate',
    existingOptimizerResult: optimizer,
  });
  assert.equal(
    decision.comparison.comparison.find((r) => r.scenario_id === 'candidate').saving_pct,
    0
  );
}
if (!which || which === 'ui') {
  const baselineReference = { ...reference, scenario_id: 'baseline' };
  const state = {
    context: { company_id: companyId },
    data: {
      baseline: bundle,
      selected_scenario: scenario,
      scenario_result: reference,
      optimizer: { baseline_reference: { result: baselineReference } },
    },
    ui: {},
  };
  const html = renderResultsSummary(state);
  assert.match(html, /0,0%/);
  assert.equal(
    comparisonCandidates(state).find((r) => r.scenario_id === 'baseline').total_with_tax,
    reference.total_with_tax
  );
}
if (!which || which === 'report') {
  const html = buildExecutiveReportHtml({
    companyId,
    selectedScenario: { scenario_id: 'candidate', result: reference },
    comparison: {
      comparison: [
        { scenario_id: 'baseline', saving_abs: 0, saving_pct: 0 },
        { scenario_id: 'candidate', saving_abs: 1234, saving_pct: 12.3 },
      ],
    },
  });
  assert.match(html, /Saving vs Cenário Base<\/td><td>R\$[^<]*1\.234/);
  assert.match(html, /Eficiência \(%\)<\/td><td>12,3%/);
}
if (!which || which === 'different_year') {
  const selected = {
    ...scenario,
    changes: {
      ...scenario.changes,
      tax_mode: 'reform_2033',
      tax_regime: 'reform_full_2033',
      tax_year: 2033,
    },
  };
  const old = { ...selected, scenario_id: 'old', changes: { ...selected.changes, tax_year: 2034 } };
  const state = {
    context: { company_id: companyId },
    data: {
      baseline: bundle,
      selected_scenario: selected,
      scenario_result: { ...reference, scenario: selected },
      optimizer: { baseline_reference: { result: { ...reference, scenario_id: 'baseline' } } },
      analysis_runs: {
        simulation: {
          company_id: companyId,
          run_id: 'old',
          scenario: old,
          result: { ...reference, scenario: old },
        },
      },
    },
    ui: {},
  };
  assert.ok(!comparisonCandidates(state).some((row) => row.scenario_id === 'saved-simulation:old'));
}
console.log('PHASE5_PHYSICAL_COMPARISON_OK');
