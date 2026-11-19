import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { runScenario } from '../assets/js/phase3/scenario-simulator.js';
import { runMonteCarloSimulation } from '../assets/js/phase3/monte-carlo-engine.js';
import { buildBaselineScenario } from '../assets/js/phase4/optimizer-utils.js';
import { runOptimization } from '../assets/js/phase4/scenario-optimizer.js';
import { buildObjective } from '../assets/js/phase4/objective-builder.js';
import { loadDefaultProfiles } from '../assets/js/phase4/objective-profile-library.js';
import { buildBundleReconciliation } from '../assets/js/core/reconciliation-engine.js';
import { MODEL_DEFAULTS, calculateInventoryCost } from '../assets/js/core/model-configuration.js';
import { runStressTests } from '../assets/js/phase5/stress-test-engine.js';
import { buildStressCaseLibrary } from '../assets/js/phase5/stress-case-library.js';
import { calculateRobustness } from '../assets/js/phase5/robustness-scorer.js';
import { evaluateScenarioQuality } from '../assets/js/phase3/scenario-quality-check.js';
import { buildScenarioFromForm } from '../assets/js/phase3/scenario-builder.js';
import { findMatchingCdLabel } from '../assets/js/core/cd-utils.js';
import { loadRuntimeBundle } from '../tests/runtime_bundle_support.mjs';

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
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const pickResult = (r) => ({
  scenario_id: r.scenario_id,
  scenario_name: r.scenario?.scenario_name || r.scenario_name,
  company_id: r.company_id,
  active_cds: r.scenario?.changes?.active_cds || r.active_cds || [],
  active_cds_count: (r.scenario?.changes?.active_cds || r.active_cds || []).length,
  freight_multiplier: n(
    r.scenario?.changes?.freight_multiplier ?? r.changes?.freight_multiplier ?? 1
  ),
  demand_multiplier: n(r.scenario?.changes?.demand_multiplier ?? r.changes?.demand_multiplier ?? 1),
  inventory_days: n(r.scenario?.changes?.inventory_days ?? r.changes?.inventory_days ?? 45),
  wacc: n(r.scenario?.changes?.wacc ?? r.changes?.wacc ?? 0.15),
  tax_mode: r.scenario?.changes?.tax_mode ?? r.changes?.tax_mode ?? 'current',
  costs: r.costs || {},
  total_with_tax: n(r.total_with_tax),
  saving_pct: n(r.saving_pct),
  quality: r.quality || null,
  diagnostics: r.diagnostics || r.costs?.diagnostics || null,
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
function finiteOrNull(value) {
  return value != null && Number.isFinite(Number(value)) ? Number(value) : null;
}
function summarizeT08Result(result) {
  const costs = result?.costs || {};
  const tax = result?.tax_results || {};
  const coverage = tax.tax_coverage || {};
  const changes = result?.scenario?.changes || {};
  return {
    scenario_id: result?.scenario_id || null,
    scenario_name: result?.scenario_name || null,
    active_cds_count: Array.isArray(changes.active_cds) ? changes.active_cds.length : null,
    freight_multiplier: finiteOrNull(changes.freight_multiplier),
    demand_multiplier: finiteOrNull(changes.demand_multiplier),
    inventory_days: finiteOrNull(changes.inventory_days),
    wacc: finiteOrNull(changes.wacc),
    tax_mode: tax.tax_mode || changes.tax_mode || null,
    tax_regime: tax.tax_regime || changes.tax_regime || null,
    simulation_status: result?.simulation_status || null,
    calculation_status: result?.calculation_status || null,
    data_quality_status: result?.data_quality?.status || null,
    decision_use: result?.data_quality?.decision_use || tax.decision_use || null,
    official_fiscal_validation: tax.official_fiscal_validation === true,
    costs: {
      transfer_cost: finiteOrNull(costs.transfer_cost),
      distribution_cost: finiteOrNull(costs.distribution_cost),
      storage_cost: finiteOrNull(costs.storage_cost),
      inventory_cost: finiteOrNull(costs.inventory_cost),
      total_logistics_cost: finiteOrNull(costs.total_logistics_cost),
      tax_impact: finiteOrNull(costs.tax_impact),
      total_with_tax: finiteOrNull(result?.total_with_tax),
    },
    tax_coverage: {
      input_flow_count: coverage.input_flow_count ?? null,
      eligible_flow_count: coverage.eligible_flow_count ?? null,
      excluded_missing_destination_count: coverage.excluded_missing_destination_count ?? null,
      excluded_missing_revenue_count: coverage.excluded_missing_revenue_count ?? null,
      missing_origin_uf_count: coverage.missing_origin_uf_count ?? null,
      complete_fiscal_coverage_ratio: finiteOrNull(coverage.complete_fiscal_coverage_ratio),
      origin_coverage_ratio: finiteOrNull(coverage.origin_coverage_ratio),
      revenue_coverage_ratio: finiteOrNull(coverage.revenue_coverage_ratio),
      proxy_flow_count: coverage.proxy_flow_count ?? null,
      coverage_limited: coverage.coverage_limited === true,
    },
    diagnostics: {
      fallback_counts: result?.diagnostics?.fallback_counts || null,
      scenario_fallback_counts: result?.diagnostics?.scenario_fallback_counts || null,
      transfer_method_counts: result?.diagnostics?.transfer_method_counts || null,
      flow_method_counts: result?.diagnostics?.flow_method_counts || null,
    },
    warning_count: Array.isArray(result?.warnings) ? result.warnings.length : 0,
    error_count: Array.isArray(result?.errors) ? result.errors.length : 0,
  };
}
function buildT08Evidence({ companyId, bundle }) {
  if (companyId !== 'empresa2') return null;
  const baselineCds = Array.isArray(bundle.model?.active_cds) ? bundle.model.active_cds : [];
  const matchingCds = baselineCds.filter((cd) => findMatchingCdLabel('Red-ES', [cd]));
  const evidence = {
    status: 'blocked',
    task: 'T08',
    company_id: companyId,
    target_cd_source: {
      artifact: 'industrial workbook in supplied materials ZIP',
      worksheet: 'Cenários',
      scenario_label: 'Cenário 2 — 1 CD ES',
      target_match: 'Red-ES',
    },
    requested_tax_mode: 'reform_2033',
    requested_tax_regime: 'reform_full_2033',
    model_tax_source: 'data/complements/complementos/empresa_2/tax/tax_inputs_reform.json',
    workbook_comparison: {
      status: 'not_comparable_tax_regime_unidentified',
      worksheet: 'Cenários',
      scenario_label: 'Cenário 2 — 1 CD ES',
      tax_regime_or_year_field_present: false,
      tax_formula_regime_reference_present: false,
      reason:
        'A planilha identifica a alternativa pelo rótulo do cenário; a fórmula de efeitos tributários filtra débitos/créditos por esse rótulo, sem identificar o ano ou regime 2033.',
    },
    official_fiscal_validation: false,
    limitation:
      'A execução do modelo em regime 2033 é exploratória. A conta da planilha não tem metadado de regime tributário compatível para comparação direta.',
  };
  if (baselineCds.length === 0) {
    evidence.reason = 'baseline_active_cds_missing';
    evidence.missing_source = 'Empresa 2 baseline model active_cds';
    return evidence;
  }
  if (matchingCds.length !== 1) {
    evidence.reason = matchingCds.length ? 'target_cd_match_not_unique' : 'target_cd_not_found';
    evidence.target_cd_match_count = matchingCds.length;
    evidence.missing_source = matchingCds.length
      ? 'unique Red-ES mapping in Empresa 2 baseline model active_cds'
      : 'Red-ES mapping in Empresa 2 baseline model active_cds';
    return evidence;
  }

  const baselineInputs = buildBaselineScenario(companyId, bundle).changes;
  const buildMatchedScenario = ({ scenarioId, scenarioName, activeCds, scenarioType }) =>
    buildScenarioFromForm({
      companyId,
      baselineBundle: bundle,
      scenarioId,
      formValues: {
        scenario_name: scenarioName,
        active_cds: activeCds,
        freight_multiplier: baselineInputs.freight_multiplier,
        demand_multiplier: baselineInputs.demand_multiplier,
        inventory_days: baselineInputs.inventory_days,
        wacc: baselineInputs.wacc,
        tax_mode: 'reform_2033',
        tax_regime: 'reform_full_2033',
        reallocation_rule: baselineInputs.reallocation_rule,
        scenario_type: scenarioType,
      },
    });
  const targetScenario = buildMatchedScenario({
    scenarioId: 'empresa2_t08_red_es_reform_2033',
    scenarioName: 'T08 — CD único ES, regime 2033',
    activeCds: matchingCds,
    scenarioType: 'academic_evidence',
  });
  const sameRegimeBaselineScenario = buildMatchedScenario({
    scenarioId: 'empresa2_t08_baseline_reform_2033',
    scenarioName: 'T08 — baseline Empresa 2, regime 2033',
    activeCds: baselineCds,
    scenarioType: 'academic_evidence_reference',
  });
  const targetResult = runScenario({
    companyId,
    scenario: targetScenario,
    baselineBundle: bundle,
  });
  const sameRegimeBaselineResult = runScenario({
    companyId,
    scenario: sameRegimeBaselineScenario,
    baselineBundle: bundle,
  });
  const targetSummary = summarizeT08Result(targetResult);
  const baselineSummary = summarizeT08Result(sameRegimeBaselineResult);
  const comparableInputFields = [
    'freight_multiplier',
    'demand_multiplier',
    'inventory_days',
    'wacc',
    'tax_mode',
    'tax_regime',
    'reallocation_rule',
  ];
  const sameNonNetworkInputs = comparableInputFields.every(
    (key) => targetScenario.changes[key] === sameRegimeBaselineScenario.changes[key]
  );
  const sameRegime = targetSummary.tax_regime === baselineSummary.tax_regime;
  const targetTotal = targetSummary.costs.total_with_tax;
  const baselineTotal = baselineSummary.costs.total_with_tax;
  const hasComparableTotals =
    targetResult.simulation_status === 'success' &&
    sameRegimeBaselineResult.simulation_status === 'success' &&
    sameRegime &&
    sameNonNetworkInputs &&
    targetTotal != null &&
    baselineTotal != null &&
    baselineTotal !== 0;
  const decisionSupported =
    hasComparableTotals &&
    targetSummary.decision_use === 'decision_support' &&
    baselineSummary.decision_use === 'decision_support' &&
    targetSummary.official_fiscal_validation &&
    baselineSummary.official_fiscal_validation &&
    !targetSummary.tax_coverage.coverage_limited &&
    !baselineSummary.tax_coverage.coverage_limited;
  const delta = hasComparableTotals ? targetTotal - baselineTotal : null;
  evidence.status = decisionSupported
    ? 'validated_same_regime_model_comparison'
    : hasComparableTotals
      ? 'calculated_same_regime_model_comparison_exploratory_only'
      : 'calculated_with_comparison_limits';
  evidence.target_cd_match_count = matchingCds.length;
  evidence.target_cd_match_verified = true;
  evidence.operating_assumptions_source = 'Empresa 2 model baseline defaults applied identically to both scenarios';
  evidence.same_regime_baseline = baselineSummary;
  evidence.single_cd_es_scenario = targetSummary;
  evidence.model_comparison = {
    comparison_basis: 'Empresa 2 model, identical non-network inputs and identical 2033 tax regime',
    same_tax_regime: sameRegime,
    same_non_network_inputs: sameNonNetworkInputs,
    status: decisionSupported
      ? 'comparable_within_model_decision_support'
      : hasComparableTotals
        ? 'comparable_within_model_exploratory_only'
        : 'not_comparable_or_incomplete',
    total_with_tax_delta: finiteOrNull(delta),
    total_with_tax_delta_pct:
      hasComparableTotals && baselineTotal !== 0
        ? finiteOrNull((delta / baselineTotal) * 100)
        : null,
    target_decision_use: targetSummary.decision_use,
    baseline_decision_use: baselineSummary.decision_use,
  };
  return evidence;
}
const output = {
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
  const baseScenario = buildBaselineScenario(companyId, bundle);
  const baseline = runScenario({ companyId, scenario: baseScenario, baselineBundle: bundle });
  const sampleScenarios = decryptJson(`data/${companyId}/phase3/sample_scenarios.json`);
  const sampleList = Array.isArray(sampleScenarios)
    ? sampleScenarios
    : sampleScenarios.scenarios || sampleScenarios.sample_scenarios || [];
  const published_scenarios = sampleList.map((scenario) => {
    const result = runScenario({ companyId, scenario, baselineBundle: bundle });
    const quality = evaluateScenarioQuality({ scenarioResult: result, baselineBundle: bundle });
    const stressCases = buildStressCaseLibrary({ companyId }).stress_cases;
    const stress = runStressTests({
      companyId,
      selectedScenario: scenario,
      baselineBundle: bundle,
      baselineResult: baseline,
      stressCases,
    });
    const robustness = calculateRobustness({
      companyId,
      scenarioId: result.scenario_id,
      stressResults: stress.stress_results,
      expectedStressCaseCount: stressCases.length,
      quality,
      evidence: result.evidence,
    });
    return {
      ...pickResult(result),
      quality,
      data_quality: result.data_quality,
      evidence: result.evidence,
      robustness: {
        robustness_score: robustness.robustness_score,
        conditional_robustness_score: robustness.conditional_robustness_score,
        certified_robustness_score: robustness.certified_robustness_score,
        robustness_interpretation: robustness.robustness_interpretation,
        robustness_status: robustness.robustness_status,
        robustness_calculation_status: robustness.robustness_calculation_status,
        missing_inputs: robustness.missing_inputs,
        stress_status: robustness.stress_status,
        cases_positive: robustness.cases_positive,
        cases_total: robustness.cases_total,
        cases_blocked: robustness.cases_blocked,
        cases_limited: robustness.cases_limited,
        worst_case_saving_pct: robustness.worst_case_saving_pct,
        alerts: robustness.alerts,
      },
    };
  });
  const reconciliation = buildBundleReconciliation(bundle);
  const sameDrivers1 = makeScenario(companyId, bundle, {
    label: 'inventory_test_1_cd',
    active_cds: [bundle.model.active_cds[0]],
  });
  const sameDriversN = makeScenario(companyId, bundle, {
    label: 'inventory_test_all_cds',
    active_cds: bundle.model.active_cds,
  });
  const inventory1 = runScenario({ companyId, scenario: sameDrivers1, baselineBundle: bundle });
  const inventoryN = runScenario({ companyId, scenario: sameDriversN, baselineBundle: bundle });
  const monteCarloScenarios =
    companyId === 'empresa1'
      ? [
          { label: 'baseline_15_cds', active_cds: bundle.model.active_cds },
          {
            label: 'sem_cajamar_14_cds',
            active_cds: bundle.model.active_cds.filter(
              (cd) => !/cajamar/i.test(String(cd))
            ),
          },
          {
            label: 'cd_unico_serra_es',
            active_cds: bundle.model.active_cds.filter((cd) => /serra/i.test(String(cd))),
          },
        ]
      : [{ label: 'baseline_4_cds', active_cds: bundle.model.active_cds }];
  const monteCarloResults = monteCarloScenarios.map((caseConfig) => {
    if (!caseConfig.active_cds.length || (caseConfig.label === 'cd_unico_serra_es' && caseConfig.active_cds.length !== 1)) {
      throw new Error(`Configuração inesperada de CDs para ${caseConfig.label}.`);
    }
    const scenario = makeScenario(companyId, bundle, {
      label: caseConfig.label,
      active_cds: caseConfig.active_cds,
      tax_treatment: 'fixed_baseline',
    });
    const deterministic = runScenario({ companyId, scenario, baselineBundle: bundle });
    const simulation = runMonteCarloSimulation({
      companyId,
      selectedScenario: scenario,
      baselineBundle: bundle,
      deterministicResult: deterministic,
      iterations: 300,
      seed: 42,
      config: {
        profile: 'balanced',
        scatter_driver: 'freight_multiplier',
        tax_treatment: 'fixed_baseline',
        sampled_drivers: ['freight_multiplier'],
        historical_data_mode: 'parametric_only',
      },
    });
    return {
      scenario_id: scenario.scenario_id,
      active_cds_count: scenario.changes.active_cds.length,
      active_cd_match_count: scenario.changes.active_cds.length,
      iterations: simulation.config?.iterations,
      seed: simulation.config?.seed,
      profile: simulation.config?.profile,
      scatter_driver: simulation.config?.scatter_driver,
      tax_treatment: simulation.config?.tax_treatment,
      sampled_drivers: simulation.config?.sampled_drivers,
      historical_data_mode: simulation.config?.historical_data_mode,
      analysis_type: simulation.config?.analysis_type,
      uncertainty_source: simulation.config?.uncertainty_source,
      probability_interpretation: simulation.summary?.probability_interpretation,
      monte_carlo_status: simulation.monte_carlo_status,
      iterations_requested: simulation.config?.iterations,
      iterations_valid: simulation.summary?.iterations_valid ?? null,
      summary: simulation.summary,
      baseline_tax_reference: bundle.costs?.costs?.tax_impact ?? null,
      deterministic_total_with_tax: simulation.summary?.deterministic_total_with_tax ?? null,
      probability_saving_positive: simulation.summary?.probability_saving_positive ?? null,
      p10_saving_pct: simulation.summary?.p10_saving_pct ?? null,
      data_quality: simulation.data_quality,
      provenance: simulation.provenance,
      simulation_provenance: simulation.simulation_provenance,
      warnings: simulation.warnings,
      errors: simulation.errors,
    };
  });
  const mc = monteCarloResults[0];
  const t08Es2033 = buildT08Evidence({ companyId, bundle });
  const profiles = loadDefaultProfiles();
  const optimization = {};
  for (const profile of profiles) {
    const objective = buildObjective({
      companyId,
      objectiveName: profile.profile_name,
      weights: profile.weights,
    });
    const opt = runOptimization({
      companyId,
      baselineBundle: bundle,
      objective,
      constraints: {
        min_active_cds: 1,
        max_active_cds: 999,
        max_cd_volume_share: 1,
        max_risk_level: 'high',
        allow_tax_disabled: true,
      },
      optimizerConfig: { method: 'exact_discrete', max_candidates: 5000, seed: 42 },
    });
    const winner = opt.best_scenarios?.[0] || null;
    const winnerScenario = winner?.scenario || {};
    optimization[profile.profile_id] = {
      profile_id: profile.profile_id,
      profile_name: profile.profile_name,
      weights: profile.weights,
      optimizer_status: opt.optimizer_status,
      decision_use: opt.decision_use,
      result_scope: opt.result_scope,
      search_log: opt.search_log,
      winner_scenario_id: winner?.scenario_id || null,
      winner: winner
        ? {
            scenario_id: winner.scenario_id,
            scenario_name: winnerScenario.scenario_name,
            active_cds: winnerScenario.active_cds || winnerScenario.changes?.active_cds,
            freight_multiplier: winnerScenario.freight_multiplier,
            inventory_days: winnerScenario.inventory_days,
            tax_mode: winnerScenario.tax_treatment || winnerScenario.tax_mode,
            score: winner.score ?? winner.final_score ?? opt.search_log?.best_score,
            total_with_tax: winner.result?.total_with_tax,
            saving_pct: winner.result?.saving_pct,
            risk_level: winner.quality?.risk_level,
          }
        : null,
      best: opt.best_scenarios?.slice(0, 3).map((x) => ({
        scenario_id: x.scenario_id,
        scenario_name: x.scenario?.scenario_name,
        active_cds: x.scenario?.changes?.active_cds,
        score: x.score ?? x.final_score ?? opt.search_log?.best_score,
        total_with_tax: x.result?.total_with_tax,
        saving_pct: x.result?.saving_pct,
        risk_level: x.quality?.risk_level,
      })),
    };
  }
  output.companies[companyId] = {
    source_counts: {
      flows: bundle.flows?.length || 0,
      active_cds: bundle.model?.active_cds?.length || 0,
      core_data_keys: Object.keys(bundle.core_data || {}),
    },
    baseline: pickResult(baseline),
    published_scenarios,
    reconciliation,
    inventory_independence_test: {
      one_cd: pickResult(inventory1),
      all_cds: pickResult(inventoryN),
      equal_inventory_cost:
        Math.abs(n(inventory1.costs?.inventory_cost) - n(inventoryN.costs?.inventory_cost)) < 1e-8,
      direct_formula_check: calculateInventoryCost({
        baseInventoryCost: baseline.costs?.inventory_cost,
        demandMultiplier: 1,
        inventoryDays: 45,
        wacc: 0.15,
      }),
    },
    monte_carlo: {
      iterations: mc.iterations,
      seed: mc.seed,
      profile: mc.profile,
      scatter_driver: mc.scatter_driver,
      sampled_drivers: mc.sampled_drivers,
      historical_data_mode: mc.historical_data_mode,
      analysis_type: mc.analysis_type,
      uncertainty_source: mc.uncertainty_source,
      tax_treatment: mc.tax_treatment,
      interpretation: 'Resultados condicionais às premissas paramétricas e ao tributo mantido fixo no baseline; não representam probabilidade observada no negócio nem medem incerteza tributária.',
      summary: mc.summary,
      provenance: mc.provenance,
      simulation_provenance: mc.simulation_provenance,
      data_quality: mc.data_quality,
      scenario_results: monteCarloResults,
    },
    ...(t08Es2033 ? { t08_es_2033: t08Es2033 } : {}),
    optimization,
  };
}
const evidenceOutputPath = path.resolve(
  process.env.VISAGIO_EVIDENCE_OUTPUT || 'entregaveis/evidence.json'
);
fs.mkdirSync(path.dirname(evidenceOutputPath), { recursive: true });
fs.writeFileSync(evidenceOutputPath, JSON.stringify(output, null, 2));
console.log(
  JSON.stringify(
    {
      companies: Object.fromEntries(
        Object.entries(output.companies).map(([k, v]) => [
          k,
          {
            baseline_total: v.baseline.total_with_tax,
            reconciliation: v.reconciliation,
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
