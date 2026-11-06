import fs from 'node:fs';
import crypto from 'node:crypto';
import { runScenario } from '../assets/js/phase3/scenario-simulator.js';
import { runMonteCarloSimulation } from '../assets/js/phase3/monte-carlo-engine.js';
import { buildBaselineScenario } from '../assets/js/phase4/optimizer-utils.js';
import { runOptimization } from '../assets/js/phase4/scenario-optimizer.js';
import { buildObjective } from '../assets/js/phase4/objective-builder.js';
import { buildBundleReconciliation } from '../assets/js/core/reconciliation-engine.js';
import {
  MODEL_DEFAULTS,
  calculateInventoryCost,
  getCompanyModelDefaults,
  normalizeScenarioModelDefaults,
} from '../assets/js/core/model-configuration.js';
import { loadRuntimeBundle } from '../tests/runtime_bundle_support.mjs';
import {
  ACADEMIC_OPTIMIZER_CONFIG,
  ACADEMIC_EVIDENCE_SCHEMA_VERSION,
  buildAcademicScenarioEvidence,
  buildOptimizerCompletenessEvidence,
  buildOptimizerBestEvidence,
  buildScenarioQualityEvidence,
  buildAcademicScenarioPlan,
  buildScenarioNAvailabilityEvidence,
  isScenarioNScenario,
  mapAcademicSampleScenarios,
  projectAcademicScenarioPlan,
  projectAcademicReconciliation,
  projectAcademicScenarioResult,
  projectMonteCarloExecutionEvidence,
  compareInventoryCosts,
  getAcademicOptimizerProfiles,
  prepareAcademicReallocation,
} from './academic-evidence-config.mjs';

function readPassword() {
  if (process.env.VISAGIO_DATA_PASSWORD) return process.env.VISAGIO_DATA_PASSWORD;
  const env = fs.readFileSync('.env.local', 'utf8').split(/\r?\n/);
  for (const line of env)
    if (line.startsWith('VISAGIO_DATA_PASSWORD='))
      return line
        .split('=')
        .slice(1)
        .join('=')
        .trim()
        .replace(/^['"]|['"]$/g, '');
  throw new Error('VISAGIO_DATA_PASSWORD missing');
}
function decryptJson(relPath) {
  const manifest = JSON.parse(fs.readFileSync('data/encrypted_manifest.json', 'utf8'));
  const entry = manifest.entries.find((item) => item.original_path === relPath);
  if (!entry) throw new Error(`missing encrypted entry ${relPath}`);
  const envelope = JSON.parse(fs.readFileSync(entry.encrypted_path, 'utf8'));
  const key = crypto.pbkdf2Sync(
    readPassword(),
    Buffer.from(envelope.salt, 'base64'),
    Number(envelope.iterations),
    32,
    'sha256'
  );
  const payload = Buffer.from(envelope.ciphertext, 'base64');
  const tag = payload.subarray(payload.length - 16);
  const ciphertext = payload.subarray(0, payload.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAAD(Buffer.from(relPath, 'utf8'));
  decipher.setAuthTag(tag);
  return JSON.parse(
    Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  );
}
const pickResult = (
  r,
  reallocationAudit = {},
  baselineBundle = null,
  baselineResult = null,
  safeScenarioId = null
) =>
  projectAcademicScenarioResult({
    result: r,
    reallocationAudit,
    baselineResult,
    quality: baselineBundle ? buildScenarioQualityEvidence(r, baselineBundle) : null,
    scenarioId: safeScenarioId,
  });
function makeScenario(companyId, bundle, overrides = {}) {
  const base = buildBaselineScenario(companyId, bundle);
  return {
    ...base,
    scenario_id: `${companyId}_evidence_${overrides.label || 'scenario'}`,
    scenario_name: overrides.label || 'evidence scenario',
    changes: { ...base.changes, ...overrides },
  };
}
const output = {
  schema_version: ACADEMIC_EVIDENCE_SCHEMA_VERSION,
  generated_at: new Date().toISOString(),
  model_defaults: MODEL_DEFAULTS,
  companies: {},
  methodology: {
    package_purpose: 'Evidence package for updating the academic report and work plan review.',
    protected_data_policy:
      'Aggregated outputs only; encrypted source data and password are not exported.',
  },
};
for (const companyId of ['empresa1', 'empresa2']) {
  const bundle = loadRuntimeBundle({ companyId, decryptJson });
  const baselineAudit = prepareAcademicReallocation(
    buildBaselineScenario(companyId, bundle),
    companyId
  );
  const baseline = runScenario({
    companyId,
    scenario: baselineAudit.scenario,
    baselineBundle: bundle,
  });
  const sampleScenarios = decryptJson(`data/${companyId}/phase3/sample_scenarios.json`);
  const sampleList = Array.isArray(sampleScenarios)
    ? sampleScenarios
    : sampleScenarios.scenarios || sampleScenarios.sample_scenarios || [];
  const published_scenarios = mapAcademicSampleScenarios(
    sampleList,
    (sourceScenario, sampleIndex) => {
      const normalizedSourceScenario = normalizeScenarioModelDefaults(companyId, sourceScenario);
      const scenarioAudit = prepareAcademicReallocation(normalizedSourceScenario, companyId);
      return pickResult(
        runScenario({ companyId, scenario: scenarioAudit.scenario, baselineBundle: bundle }),
        scenarioAudit,
        bundle,
        baseline,
        `sample_${String(sampleIndex + 1).padStart(3, '0')}`
      );
    },
    companyId
  );
  const academicScenarioPlan = buildAcademicScenarioPlan(
    companyId,
    bundle,
    buildBaselineScenario(companyId, bundle)
  );
  const reproducibleAcademicScenarios = academicScenarioPlan.scenarios.filter(
    (scenario) => scenario.status === 'ready'
  );
  const academicScenarioResults = reproducibleAcademicScenarios.map((planned, planIndex) => {
    const safeScenarioId = `scenario_plan_${String(planIndex + 1).padStart(3, '0')}`;
    const scenario = {
      ...buildBaselineScenario(companyId, bundle),
      scenario_id: planned.scenario_id,
      scenario_name: planned.scenario_name,
      changes: { ...planned.changes },
    };
    const scenarioAudit = prepareAcademicReallocation(scenario, companyId);
    const deterministic = runScenario({
      companyId,
      scenario: scenarioAudit.scenario,
      baselineBundle: bundle,
    });
    const monteCarlo = runMonteCarloSimulation({
      companyId,
      selectedScenario: scenarioAudit.scenario,
      baselineBundle: bundle,
      deterministicResult: deterministic,
      iterations: 300,
      seed: 42,
      config: { profile: 'balanced', scatter_driver: 'freight_multiplier' },
    });
    return buildAcademicScenarioEvidence({
      plan: planned,
      deterministic: pickResult(deterministic, scenarioAudit, bundle, baseline, safeScenarioId),
      monteCarlo,
      scenarioId: safeScenarioId,
    });
  });
  const scenarioNSource = sampleList.find(isScenarioNScenario);
  const reconciliation = buildBundleReconciliation(bundle);
  const sameDrivers1 = makeScenario(companyId, bundle, {
    label: 'inventory_test_1_cd',
    active_cds: [bundle.model.active_cds[0]],
  });
  const sameDriversN = makeScenario(companyId, bundle, {
    label: 'inventory_test_all_cds',
    active_cds: bundle.model.active_cds,
  });
  const inventory1Audit = prepareAcademicReallocation(sameDrivers1, companyId);
  const inventoryNAudit = prepareAcademicReallocation(sameDriversN, companyId);
  const inventory1 = runScenario({
    companyId,
    scenario: inventory1Audit.scenario,
    baselineBundle: bundle,
  });
  const inventoryN = runScenario({
    companyId,
    scenario: inventoryNAudit.scenario,
    baselineBundle: bundle,
  });
  const inventoryComparison = compareInventoryCosts(inventory1, inventoryN);
  const mcScenario = makeScenario(companyId, bundle, { label: 'monte_carlo_evidence' });
  const mcScenarioAudit = prepareAcademicReallocation(mcScenario, companyId);
  const mcDet = runScenario({
    companyId,
    scenario: mcScenarioAudit.scenario,
    baselineBundle: bundle,
  });
  const mc = runMonteCarloSimulation({
    companyId,
    selectedScenario: mcScenarioAudit.scenario,
    baselineBundle: bundle,
    deterministicResult: mcDet,
    iterations: 300,
    seed: 42,
    config: { profile: 'balanced', scatter_driver: 'freight_multiplier' },
  });
  const optimization = {};
  for (const profile of getAcademicOptimizerProfiles()) {
    const objective = buildObjective({
      companyId,
      objectiveName: profile.profile_name,
      weights: profile.weights,
    });
    const opt = runOptimization({
      companyId,
      baselineBundle: bundle,
      objective,
      constraints: { ...ACADEMIC_OPTIMIZER_CONFIG.constraints },
      optimizerConfig: { ...ACADEMIC_OPTIMIZER_CONFIG.optimizer },
    });
    optimization[profile.profile_id] = {
      profile_id: profile.profile_id,
      profile_name: profile.profile_name,
      weights: { ...profile.weights },
      constraints: { ...ACADEMIC_OPTIMIZER_CONFIG.constraints },
      optimizer_config: { ...ACADEMIC_OPTIMIZER_CONFIG.optimizer },
      optimizer_status: opt.optimizer_status,
      decision_use: opt.decision_use,
      result_scope: opt.result_scope,
      search_completeness: buildOptimizerCompletenessEvidence(opt),
      best: opt.best_scenarios
        ?.slice(0, 3)
        .map((candidate, index) => buildOptimizerBestEvidence(candidate, baseline, index + 1)),
      ranked_candidates: (opt.scored_scenarios || []).map((candidate, index) =>
        buildOptimizerBestEvidence(candidate, baseline, index + 1)
      ),
    };
  }
  output.companies[companyId] = {
    source_counts: {
      flows: bundle.flows?.length || 0,
      active_cd_count: bundle.model?.active_cds?.length || 0,
    },
    baseline: pickResult(baseline, baselineAudit, bundle, baseline, 'baseline'),
    published_scenarios,
    academic_scenario_plan: projectAcademicScenarioPlan(academicScenarioPlan),
    academic_scenario_results: academicScenarioResults,
    scenario_n_availability:
      companyId === 'empresa2'
        ? buildScenarioNAvailabilityEvidence(scenarioNSource || {})
        : {
            scenario_id: 'scenario_n',
            status: 'not_applicable',
            execution_status: 'not_run_by_academic_evidence_generator',
            required_inputs: [],
            reason: 'O cenário N documentado é específico da E2.',
          },
    reconciliation: projectAcademicReconciliation(reconciliation),
    inventory_independence_test: {
      one_cd: pickResult(inventory1, inventory1Audit, bundle, baseline, 'inventory_one_cd'),
      all_cds: pickResult(inventoryN, inventoryNAudit, bundle, baseline, 'inventory_all_cds'),
      ...inventoryComparison,
      direct_formula_check: calculateInventoryCost({
        companyId,
        baseInventoryCost: baseline.costs?.inventory_cost,
        demandMultiplier: 1,
        inventoryDays: getCompanyModelDefaults(companyId).inventory_days,
        wacc: getCompanyModelDefaults(companyId).reference_wacc,
      }),
    },
    monte_carlo: {
      ...projectMonteCarloExecutionEvidence(mc),
      reallocation_rule_original: mcScenarioAudit.source_reallocation_rule,
      reallocation_rule_effective: mcScenarioAudit.effective_reallocation_rule,
      iterations: mc.iterations,
      seed: mc.seed,
      profile: mc.config?.profile,
      scatter_driver: mc.config?.scatter_driver,
      provenance_status: mc.config?.historical_provenance_status || 'not_applicable',
      data_quality_status: mc.data_quality_status,
    },
    optimization,
  };
}
fs.mkdirSync('entregaveis', { recursive: true, mode: 0o700 });
fs.chmodSync('entregaveis', 0o700);
fs.writeFileSync('entregaveis/evidence.json', JSON.stringify(output, null, 2), { mode: 0o600 });
fs.chmodSync('entregaveis/evidence.json', 0o600);
console.log(
  JSON.stringify(
    {
      companies: Object.fromEntries(
        Object.entries(output.companies).map(([k, v]) => [
          k,
          {
            baseline_status: v.baseline.simulation_status,
            reconciliation_status: v.reconciliation.overall.status,
            inventory_equal: v.inventory_independence_test.equal_inventory_cost,
            mc_iterations: v.monte_carlo.iterations,
            optimizer_best: Object.fromEntries(
              Object.entries(v.optimization).map(([p, x]) => [p, x.best?.[0]?.scenario_id || null])
            ),
          },
        ])
      ),
    },
    null,
    2
  )
);
