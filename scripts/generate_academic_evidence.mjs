import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { resolveEmpresa2EsCd } from './audit/e2_scenario_lookup.mjs';
import { runMonteCarloBattery } from './audit/monte_carlo_battery.mjs';
import { applyTaxRuntimeConfig } from './audit/tax_runtime_config.mjs';
import { runTax2033Sensitivity } from './audit/tax_2033_sensitivity.mjs';
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
// Hash protected inputs only inside the private execution. The shareable
// handoff decides separately which fingerprints are safe to disclose.
function hashFiles(paths) {
  const digest = crypto.createHash('sha256');
  for (const path of [...paths].sort()) {
    digest.update(path).update('\0').update(fs.readFileSync(path)).update('\0');
  }
  return digest.digest('hex');
}
function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink input not allowed: ${item}`);
    return entry.isDirectory() ? filesUnder(item) : entry.isFile() ? [item] : [];
  });
}
function executionMetadata() {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const dirty = Boolean(
    execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()
  );
  const encryptedManifest = JSON.parse(fs.readFileSync('data/encrypted_manifest.json', 'utf8'));
  const inputPaths = [
    'data/encrypted_manifest.json',
    ...encryptedManifest.entries.map((entry) => entry.encrypted_path),
    ...filesUnder('data/complements'),
    ...filesUnder('data/tax'),
  ];
  const dataHash = hashFiles(inputPaths);
  const taxConfigHash = hashFiles([
    'data/tax/tax_reform_config.json',
    'assets/js/core/tax-reform-config.js',
  ]);
  const scenarioConfigHash = hashFiles([
    'scripts/academic-evidence-config.mjs',
    'assets/js/core/model-configuration.js',
  ]);
  const now = new Date().toISOString();
  const runKey = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        commit,
        dataHash,
        taxConfigHash,
        scenarioConfigHash,
        fullMc: process.env.VISAGIO_AUDIT_FULL_MC === '1',
        include5000: process.env.VISAGIO_AUDIT_MC_5000 === '1',
        schema: ACADEMIC_EVIDENCE_SCHEMA_VERSION,
      })
    )
    .digest('hex');
  return {
    run_id: `${now.slice(0, 10).replaceAll('-', '')}-${runKey.slice(0, 16)}`,
    run_key: runKey,
    commit_final: commit,
    dirty_worktree: dirty,
    eligibility: dirty ? 'BLOCKED_DIRTY_WORKTREE' : 'PENDING_SCIENTIFIC_GATES',
    shareable_aggregate_eligible: false,
    scientific_status: 'BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS',
    privacy_review: 'PRIVATE_OUTPUT_REQUIRES_ALLOWLISTED_PROJECTION',
    data_hash: dataHash,
    tax_config_hash: taxConfigHash,
    scenario_config_hash: scenarioConfigHash,
    model_version: ACADEMIC_EVIDENCE_SCHEMA_VERSION,
    execution_config: {
      full_monte_carlo_battery: process.env.VISAGIO_AUDIT_FULL_MC === '1',
      include_5000_iterations: process.env.VISAGIO_AUDIT_MC_5000 === '1',
      monte_carlo_seeds: [42, 43, 44],
      monte_carlo_profiles: ['conservative', 'balanced', 'broad'],
      monte_carlo_iterations:
        process.env.VISAGIO_AUDIT_MC_5000 === '1' ? [300, 1000, 5000] : [300, 1000],
    },
    generated_at: now,
  };
}
const metadata = executionMetadata();
const fiscalConfigRuntime = applyTaxRuntimeConfig(
  JSON.parse(fs.readFileSync('data/tax/tax_reform_config.json', 'utf8'))
);
const output = {
  schema_version: ACADEMIC_EVIDENCE_SCHEMA_VERSION,
  ...metadata,
  model_defaults: MODEL_DEFAULTS,
  fiscal_config_runtime: fiscalConfigRuntime,
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
  const physicalBaseline = runScenario({
    companyId,
    scenario: baselineAudit.scenario,
    baselineBundle: bundle,
    baselineMode: 'physical_unanchored',
  });
  const sampleScenarios = decryptJson(`data/${companyId}/phase3/sample_scenarios.json`);
  const sampleList = Array.isArray(sampleScenarios)
    ? sampleScenarios
    : sampleScenarios.scenarios || sampleScenarios.sample_scenarios || [];
  const published_scenarios = mapAcademicSampleScenarios(
    sampleList,
    (sourceScenario, sampleIndex) => {
      const normalizedSourceScenario = normalizeScenarioModelDefaults(
        companyId,
        sourceScenario,
        bundle
      );
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
      baselineMode: 'physical_unanchored',
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
      deterministic: pickResult(
        deterministic,
        scenarioAudit,
        bundle,
        physicalBaseline,
        safeScenarioId
      ),
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
  const baselineScenario = buildBaselineScenario(companyId, bundle);
  const batteryScenarios = [{ key: 'baseline_self', scenario: baselineAudit.scenario }];
  let empresa2Es = null;
  let empresa2Subsets = null;
  if (companyId === 'empresa1') {
    for (const [id, key] of [
      ['e1_14_cds_sem_ribeirao_preto', 'exclusion_a'],
      ['e1_14_cds_sem_cajamar', 'exclusion_b'],
    ]) {
      const plan = academicScenarioPlan.scenarios.find((item) => item.scenario_id === id);
      batteryScenarios.push({
        key,
        scenario: plan?.changes
          ? prepareAcademicReallocation(
              { ...baselineScenario, scenario_id: key, changes: plan.changes },
              companyId
            ).scenario
          : null,
      });
    }
    batteryScenarios.push({
      key: 'inventory_minus_10_days',
      scenario: makeScenario(companyId, bundle, {
        label: 'inventory_minus_10_days',
        inventory_days: Math.max(0, getCompanyModelDefaults(companyId, bundle).inventory_days - 10),
      }),
    });
    batteryScenarios.push({
      key: 'freight_plus_10_percent',
      scenario: makeScenario(companyId, bundle, {
        label: 'freight_plus_10_percent',
        freight_multiplier: 1.1,
      }),
    });
    const serra = bundle.model.active_cds.filter((cd) => /serra/i.test(String(cd)));
    batteryScenarios.push({
      key: 'single_cd_serra',
      scenario:
        serra.length === 1
          ? prepareAcademicReallocation(
              makeScenario(companyId, bundle, { label: 'single_cd_serra', active_cds: serra }),
              companyId
            ).scenario
          : null,
      reason: 'SERRA_CD_NOT_UNIQUE',
    });
  } else {
    const activeCds = bundle.model?.active_cds || [];
    if (activeCds.length === 4) {
      empresa2Subsets = Array.from({ length: 2 ** activeCds.length - 1 }, (_, index) => {
        const mask = index + 1;
        const subset = activeCds.filter((_, bit) => (mask & (1 << bit)) !== 0);
        const scenario = prepareAcademicReallocation(
          makeScenario(companyId, bundle, { label: `subset_${mask}`, active_cds: subset }),
          companyId
        );
        const result = runScenario({
          companyId,
          scenario: scenario.scenario,
          baselineBundle: bundle,
          baselineMode: 'physical_unanchored',
        });
        return {
          subset_id: `anonymous_subset_${String(mask).padStart(2, '0')}`,
          source_class: 'PARAMETRIC_EXPLORATORY',
          result: pickResult(
            result,
            scenario,
            bundle,
            physicalBaseline,
            `scenario_plan_${String(mask).padStart(3, '0')}`
          ),
        };
      });
    } else empresa2Subsets = { status: 'BLOCKED_SOURCE', reason_code: 'EXPECTED_FOUR_ACTIVE_CDS' };
    const resolved = resolveEmpresa2EsCd({
      activeCds: bundle.model?.active_cds,
      flows: bundle.flows,
    });
    const scenario =
      resolved.status === 'resolved'
        ? prepareAcademicReallocation(
            makeScenario(companyId, bundle, { label: 'single_cd_es', active_cds: [resolved.cd] }),
            companyId
          ).scenario
        : null;
    batteryScenarios.push({ key: 'single_cd_es', scenario, reason: resolved.reason_code });
    if (scenario) {
      const current = runScenario({
        companyId,
        scenario,
        baselineBundle: bundle,
        baselineMode: 'physical_unanchored',
      });
      const scenario2033 = {
        ...scenario,
        scenario_id: 'single_cd_es_2033',
        changes: {
          ...scenario.changes,
          tax_mode: 'reform_full_2033',
          tax_regime: 'reform_full_2033',
          tax_year: 2033,
        },
      };
      const base2033 = {
        ...baselineAudit.scenario,
        scenario_id: 'baseline_2033',
        changes: {
          ...baselineAudit.scenario.changes,
          tax_mode: 'reform_full_2033',
          tax_regime: 'reform_full_2033',
          tax_year: 2033,
        },
      };
      const baseResult2033 = runScenario({
        companyId,
        scenario: base2033,
        baselineBundle: bundle,
        baselineMode: 'physical_unanchored',
      });
      const candidate2033 = runScenario({
        companyId,
        scenario: scenario2033,
        baselineBundle: bundle,
        baselineMode: 'physical_unanchored',
      });
      const taxTotals = (result) => {
        const details = result.costs?.tax_details || {};
        return Object.fromEntries(
          [
            'total_current_tax',
            'cbs_total',
            'ibs_total',
            'selective_tax_total',
            'credits_total',
            'total_tax_impact',
          ].map((key) => [
            key,
            details[key] != null && Number.isFinite(Number(details[key]))
              ? Number(details[key])
              : null,
          ])
        );
      };
      const tax2033Sensitivity = runTax2033Sensitivity({
        baselineScenario: base2033,
        candidateScenario: scenario2033,
        run: (item) =>
          runScenario({
            companyId,
            scenario: item,
            baselineBundle: bundle,
            baselineMode: 'physical_unanchored',
          }),
      });
      empresa2Es = {
        tax_2033_sensitivity: tax2033Sensitivity,
        source_class: 'PARAMETRIC_EXPLORATORY',
        comparison_to_workbook: 'NOT_EQUIVALENT_SCENARIO',
        resolution: {
          status: resolved.status,
          reason_code: resolved.reason_code,
          matched_flow_count: resolved.matched_flow_count,
        },
        current: pickResult(current, {}, bundle, physicalBaseline, 'scenario_plan_001'),
        baseline_2033: {
          ...pickResult(baseResult2033, {}, bundle, baseResult2033, 'baseline'),
          tax_components: taxTotals(baseResult2033),
        },
        candidate_2033: {
          ...pickResult(candidate2033, {}, bundle, baseResult2033, 'scenario_plan_001'),
          tax_components: taxTotals(candidate2033),
        },
      };
      batteryScenarios.push({ key: 'single_cd_es_2033', scenario: scenario2033 });
    } else empresa2Es = { status: 'BLOCKED_SOURCE', reason_code: resolved.reason_code };
  }
  const fullMc = process.env.VISAGIO_AUDIT_FULL_MC === '1';
  const monteCarloBattery = fullMc
    ? runMonteCarloBattery({
        companyId,
        baselineBundle: bundle,
        scenarios: batteryScenarios,
        include5000: process.env.VISAGIO_AUDIT_MC_5000 === '1',
        onProgress: ({ scenario_key, profile, seed, iterations }) =>
          process.stderr.write(
            `MC ${companyId} ${scenario_key} ${profile} seed=${seed} n=${iterations}\n`
          ),
      })
    : [{ status: 'BLOCKED_NOT_RUN', reason_code: 'FULL_MC_BATTERY_NOT_REQUESTED' }];
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
        .map((candidate, index) =>
          buildOptimizerBestEvidence(candidate, physicalBaseline, index + 1)
        ),
      ranked_candidates: (opt.scored_scenarios || []).map((candidate, index) =>
        buildOptimizerBestEvidence(candidate, physicalBaseline, index + 1)
      ),
    };
  }
  let optimizationTaxDisabled = null;
  if (companyId === 'empresa1') {
    const noTaxBaselineScenario = {
      ...baselineAudit.scenario,
      changes: { ...baselineAudit.scenario.changes, tax_mode: 'disabled', tax_regime: 'disabled' },
    };
    const noTaxBaseline = runScenario({
      companyId,
      scenario: noTaxBaselineScenario,
      baselineBundle: bundle,
      baselineMode: 'physical_unanchored',
    });
    optimizationTaxDisabled = {};
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
        optimizerConfig: { ...ACADEMIC_OPTIMIZER_CONFIG.optimizer, research_tax_disabled: true },
      });
      optimizationTaxDisabled[profile.profile_id] = {
        profile_id: profile.profile_id,
        weights: { ...profile.weights },
        optimizer_status: opt.optimizer_status,
        comparison_type: 'physical_unanchored_tax_disabled_both_sides',
        decision_use: 'exploratory_only',
        source_class: 'PARAMETRIC_EXPLORATORY',
        baseline_tax_impact: noTaxBaseline.costs?.tax_impact ?? null,
        search_completeness: buildOptimizerCompletenessEvidence(opt),
        best: (opt.best_scenarios || [])
          .slice(0, 3)
          .map((candidate, index) =>
            buildOptimizerBestEvidence(candidate, noTaxBaseline, index + 1)
          ),
        ranked_candidates: (opt.scored_scenarios || []).map((candidate, index) =>
          buildOptimizerBestEvidence(candidate, noTaxBaseline, index + 1)
        ),
      };
    }
  }
  output.companies[companyId] = {
    source_counts: {
      flows: bundle.flows?.length || 0,
      active_cd_count: bundle.model?.active_cds?.length || 0,
    },
    baseline: pickResult(baseline, baselineAudit, bundle, baseline, 'baseline'),
    baseline_physical: {
      ...pickResult(physicalBaseline, baselineAudit, bundle, physicalBaseline, 'baseline'),
      source_class: 'PARAMETRIC_EXPLORATORY',
    },
    academic_comparison_type: 'different_network_same_engine_physical_unanchored',
    published_scenarios_scope: 'legacy_mixed_reference_do_not_use_for_causal_saving',
    published_scenarios,
    empresa2_one_cd_es: empresa2Es,
    empresa2_subsets: empresa2Subsets,
    monte_carlo_battery: monteCarloBattery,
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
        baselineBundle: bundle,
        baseInventoryCost: baseline.costs?.inventory_cost,
        demandMultiplier: 1,
        inventoryDays: getCompanyModelDefaults(companyId, bundle).inventory_days,
        wacc: getCompanyModelDefaults(companyId, bundle).reference_wacc,
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
    optimization_tax_disabled: optimizationTaxDisabled,
  };
}
const evidencePath = process.env.VISAGIO_EVIDENCE_OUTPUT || 'entregaveis/evidence.json';
const outputDirectory = path.dirname(evidencePath);
fs.mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
fs.chmodSync(outputDirectory, 0o700);
// Each execution is immutable: never replace an earlier evidence file.
fs.writeFileSync(evidencePath, JSON.stringify(output, null, 2), { mode: 0o600, flag: 'wx' });
fs.chmodSync(evidencePath, 0o600);
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
