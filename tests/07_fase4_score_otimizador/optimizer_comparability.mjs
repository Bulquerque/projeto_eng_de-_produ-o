import assert from 'node:assert/strict';
import { buildObjective } from '../../assets/js/phase4/objective-builder.js';
import { generateCandidateScenarios } from '../../assets/js/phase4/candidate-scenario-generator.js';
import { runOptimization } from '../../assets/js/phase4/scenario-optimizer.js';
import { DEFAULT_OBJECTIVE_PROFILES } from '../../assets/js/phase4/objective-profile-library.js';

const bundle = {
  model: { scenario_id: 'synthetic_baseline', active_cds: ['CD A', 'CD B'] },
  flows: [
    {
      flow_id: 'flow-1',
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
const objective = buildObjective({
  companyId: 'empresa1',
  objectiveName: 'synthetic',
  weights: {
    total_cost: 40,
    service_quality: 20,
    operational_risk: 15,
    tax_impact: 15,
    inventory_efficiency: 10,
  },
});
const config = {
  companyId: 'empresa1',
  baselineBundle: bundle,
  objective,
  constraints: { min_active_cds: 1, max_active_cds: 2, max_risk_level: 'high' },
  optimizerConfig: { max_candidates: 10, seed: 42 },
};
const selected = process.argv[2];
if (!selected || selected === 'days') {
  const result = runOptimization(config);
  assert.ok(result.scenario_records.length, JSON.stringify(result.search_log?.invalid_reasons));
  assert.ok(
    result.scenario_records.every((r) => r.scenario.changes.inventory_days === 30),
    'E1 candidates must share baseline inventory assumption'
  );
}
if (!selected || selected === 'disabled') {
  const generated = generateCandidateScenarios({
    companyId: 'empresa1',
    baselineBundle: bundle,
    generationConfig: {
      max_candidates: 3,
      freight_multipliers: [1],
      inventory_days_options: [30],
      base_tax_mode: 'disabled',
      base_tax_regime: 'disabled',
      allow_tax_disabled: true,
      demand_multipliers: [1],
    },
  });
  assert.equal(generated.generation_summary.candidate_space_size, 3);
  assert.equal(generated.generation_summary.search_space_complete, true);
  const mixed = generateCandidateScenarios({
    companyId: 'empresa1',
    baselineBundle: bundle,
    generationConfig: {
      max_candidates: 10,
      freight_multipliers: [1],
      inventory_days_options: [30],
      tax_year: 2030,
      allow_tax_disabled: true,
      demand_multipliers: [1],
    },
  });
  assert.equal(mixed.generation_summary.candidate_space_size, 6);
  assert.equal(mixed.candidate_scenarios.length, 6);
  assert.ok(
    mixed.candidate_scenarios
      .filter((s) => s.changes.tax_mode === 'disabled')
      .every((s) => s.changes.tax_regime === 'disabled' && s.changes.tax_year == null)
  );
  const result = runOptimization({
    ...config,
    optimizerConfig: { ...config.optimizerConfig, max_candidates: 3, research_tax_disabled: true },
  });
  assert.ok(result.scenario_records.length, JSON.stringify(result.search_log?.invalid_reasons));
  assert.equal(result.search_log.candidate_space_size, 3);
  assert.equal(result.decision_use, 'exploratory_only');
  assert.equal(result.baseline_reference.result.tax_results.tax_mode, 'disabled');
  assert.ok(result.scenario_records.every((r) => r.result.tax_results.tax_mode === 'disabled'));
}
if (!selected || selected === 'reform') {
  const result = runOptimization({ ...config, taxYear: 2030 });
  assert.ok(result.scenario_records.length, JSON.stringify(result.search_log?.invalid_reasons));
  const allCds = result.scenario_records.find((r) => r.scenario.changes.active_cds.length === 2);
  assert.equal(result.baseline_reference.result.baseline_mode, 'physical_unanchored');
  assert.equal(
    result.baseline_reference.scenario.changes.tax_regime,
    allCds.scenario.changes.tax_regime
  );
  assert.equal(result.baseline_reference.result.total_with_tax, allCds.result.total_with_tax);
}
if (!selected || selected === 'proxy') {
  const result = runOptimization(config);
  assert.ok(result.scenario_records.length, JSON.stringify(result.search_log?.invalid_reasons));
  assert.ok(
    result.data_quality_summary.candidates_with_physical_proxy_limit > 0,
    'E1 transfer proxy must be counted independently from fiscal coverage'
  );
  assert.equal(result.decision_use, 'exploratory_only', 'E1 transfer proxy limits decision use');
}
if (!selected || selected === 'profiles') {
  const runs = DEFAULT_OBJECTIVE_PROFILES.map((profile) =>
    runOptimization({
      ...config,
      objective: buildObjective({
        companyId: 'empresa1',
        objectiveName: profile.profile_name,
        weights: profile.weights,
      }),
    })
  );
  const catalog = JSON.stringify(runs[0].scenario_records.map((r) => r.result.scenario_id).sort());
  const scales = JSON.stringify(runs[0].normalized.minmax);
  assert.equal(runs.length, 6);
  for (const run of runs) {
    assert.equal(
      JSON.stringify(run.scenario_records.map((r) => r.result.scenario_id).sort()),
      catalog
    );
    assert.equal(JSON.stringify(run.normalized.minmax), scales);
  }
}
console.log('OPTIMIZER_COMPARABILITY_OK');
