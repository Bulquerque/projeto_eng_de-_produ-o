import { generateCandidateScenarios } from './candidate-scenario-generator.js';
import { runScenario } from '../phase3/scenario-simulator.js';
import { evaluateScenarioQuality } from '../phase3/scenario-quality-check.js';
import { evaluateConstraints, validateConstraintConfig } from './constraint-engine.js';
import { extractScenarioMetrics } from './scenario-metric-extractor.js';
import { normalizeMetrics } from './metric-normalizer.js';
import { scoreScenarios } from './scenario-scoring.js';
import {
  SUPPORTED_METHOD,
  attachBaselineReference,
  buildBaselineScenario,
  buildFailureResult,
  buildSearchLog,
  compareExactRanking,
  n,
  uniqueByChanges,
} from './optimizer-utils.js';
import { buildRefinementVariants } from './optimizer-refinement.js';
import {
  CANONICAL_OPTIMIZATION_POLICY,
  buildCanonicalOptimizationConfig,
} from '../shared/optimization-policy.js';

export function runOptimization({
  companyId,
  baselineBundle,
  objective,
  constraints = {},
  optimizerConfig = {},
}) {
  const canonicalConfig = buildCanonicalOptimizationConfig(optimizerConfig);
  const requestedMethod = String(canonicalConfig.method || 'exact_discrete');
  const maxCandidates = Number(canonicalConfig.max_candidates ?? 2000);
  const refinementRounds = Math.max(0, Math.floor(Number(optimizerConfig.refinement_rounds ?? 2)));
  const refinementSeedCount = Math.max(
    1,
    Math.floor(Number(optimizerConfig.refinement_seed_count ?? 5))
  );
  const refinementConfig = {
    allow_tax_toggle: false,
    freight_steps: [],
    demand_steps: [],
    inventory_steps: [],
    wacc_steps: [],
  };

  const constraintValidation = validateConstraintConfig(constraints);
  if (!constraintValidation.valid) {
    return buildFailureResult({
      companyId,
      searchLog: buildSearchLog({
        methodRequested: requestedMethod,
        methodApplied: SUPPORTED_METHOD,
        refinementRounds,
        refinementSeedCount,
        invalidReasons: constraintValidation.errors,
      }),
      errors: constraintValidation.errors,
    });
  }

  const generated = generateCandidateScenarios({
    companyId,
    baselineBundle,
    generationConfig: {
      max_candidates: maxCandidates,
      freight_multipliers: [CANONICAL_OPTIMIZATION_POLICY.freight_multiplier],
      inventory_days_options: [CANONICAL_OPTIMIZATION_POLICY.inventory_days],
      base_tax_mode: CANONICAL_OPTIMIZATION_POLICY.tax_mode,
      base_tax_regime: CANONICAL_OPTIMIZATION_POLICY.tax_regime,
      allow_tax_disabled: CANONICAL_OPTIMIZATION_POLICY.allow_tax_disabled,
      demand_multipliers: [CANONICAL_OPTIMIZATION_POLICY.demand_multiplier],
    },
  });

  const generatedCount = generated.candidate_scenarios.length;
  const searchWarnings = [...(generated.warnings || [])];
  const searchErrors = [...(generated.errors || [])];

  if (requestedMethod !== SUPPORTED_METHOD) {
    const message = `Método de otimização "${requestedMethod}" não é suportado. Use "${SUPPORTED_METHOD}".`;
    return buildFailureResult({
      companyId,
      searchLog: buildSearchLog({
        methodRequested: requestedMethod,
        methodApplied: null,
        refinementRounds,
        refinementSeedCount,
        exactSearchSpace: false,
        invalidReasons: [message],
      }),
      errors: [message],
    });
  }

  if (generated.generation_summary?.limited_by_max_candidates) {
    const message = `Espaço discreto truncado pelo limite de segurança (${maxCandidates}). Aumente o limite para rodar a otimização exata.`;
    return buildFailureResult({
      companyId,
      searchLog: buildSearchLog({
        methodRequested: requestedMethod,
        methodApplied: SUPPORTED_METHOD,
        generatedCandidates: generatedCount,
        candidateSpaceSize: generated.generation_summary?.candidate_space_size ?? generatedCount,
        refinementRounds,
        refinementSeedCount,
        spaceLimited: true,
        invalidReasons: [message],
      }),
      warnings: searchWarnings,
      errors: [...searchErrors, message],
    });
  }

  const baselineScenario = buildBaselineScenario(companyId, baselineBundle, {
    taxMode: canonicalConfig.tax_mode,
    taxRegime: canonicalConfig.tax_regime,
  });
  const simulatedBaseline = runScenario({
    companyId,
    scenario: baselineScenario,
    baselineBundle,
  });
  if (simulatedBaseline.simulation_status !== 'success') {
    const message = 'Falha ao simular o baseline comparável no regime fiscal da otimização.';
    return buildFailureResult({
      companyId,
      searchLog: buildSearchLog({
        methodRequested: requestedMethod,
        methodApplied: SUPPORTED_METHOD,
        generatedCandidates: generatedCount,
        refinementRounds,
        refinementSeedCount,
        invalidReasons: [message],
      }),
      warnings: searchWarnings,
      errors: [message],
    });
  }
  const baselineResult = attachBaselineReference(simulatedBaseline, simulatedBaseline);
  const baselineRecord = {
    scenario: baselineScenario,
    result: baselineResult,
    quality: evaluateScenarioQuality({ scenarioResult: baselineResult, baselineBundle }),
    constraint: { passes_constraints: true, violations: [], warnings: [] },
  };

  const scenarioRecords = [];
  let invalid = 0;
  const invalidReasons = [];

  for (const scenario of generated.candidate_scenarios) {
    const simulatedResult = runScenario({ companyId, scenario, baselineBundle });
    if (simulatedResult.simulation_status !== 'success') {
      invalid++;
      invalidReasons.push(simulatedResult.errors?.[0] || 'simulação inválida');
      continue;
    }
    const result = attachBaselineReference(simulatedResult, baselineResult);

    const quality = evaluateScenarioQuality({ scenarioResult: result, baselineBundle });
    const constraint = evaluateConstraints({
      scenarioResult: result,
      quality,
      scenario,
      constraints,
    });
    if (!constraint.passes_constraints) {
      invalid++;
      invalidReasons.push(constraint.violations[0] || 'restrição violada');
      continue;
    }

    scenarioRecords.push({ scenario, result, quality, constraint });
  }

  const preliminaryMetrics = extractScenarioMetrics({
    companyId,
    scenarioResults: scenarioRecords,
  });
  const preliminaryNormalized = normalizeMetrics({
    companyId,
    scenarioMetrics: preliminaryMetrics.scenario_metrics,
    referenceMetrics: baselineRecord.result?.scenario_id
      ? [
          {
            scenario_id: baselineRecord.result.scenario_id,
            total_cost: baselineRecord.result.total_with_tax,
            service_quality: baselineRecord.quality.quality_score,
            operational_risk: baselineRecord.quality.risk_numeric ?? 50,
            tax_impact: baselineRecord.result.costs?.tax_impact ?? 0,
            inventory_efficiency:
              baselineRecord.quality.quality_metrics?.inventory_efficiency ?? 50,
          },
        ]
      : [],
  });
  const preliminaryScoring = scoreScenarios({
    companyId,
    objective,
    normalizedMetrics: preliminaryNormalized.normalized_metrics,
  });
  const refinementSeeds = uniqueByChanges(
    (preliminaryScoring.scored_scenarios.length
      ? preliminaryScoring.scored_scenarios
          .map((s) => scenarioRecords.find((r) => r.result.scenario_id === s.scenario_id))
          .filter(Boolean)
      : [baselineRecord]
    ).slice(0, refinementSeedCount)
  );

  const refinedCandidates = [];
  let refinementGenerated = 0;
  for (let round = 0; round < refinementRounds; round += 1) {
    for (const seed of refinementSeeds) {
      const variants = buildRefinementVariants({
        companyId,
        baselineBundle,
        seedRecord: seed,
        roundIndex: round,
        refinementConfig,
      });
      refinementGenerated += variants.length;
      refinedCandidates.push(...variants);
    }
  }

  const seenScenarioIds = new Set([
    ...scenarioRecords.map((r) => r.result.scenario_id),
    baselineRecord.result.scenario_id,
  ]);
  const refinedRecords = [];
  let refinedInvalid = 0;
  let refinedSimulated = 0;
  const refinedInvalidReasons = [];
  const seenScenarioKeys = new Set([
    ...scenarioRecords.map((r) => JSON.stringify(r.scenario?.changes || {})),
    JSON.stringify(baselineRecord.scenario?.changes || {}),
  ]);
  for (const scenario of uniqueByChanges(refinedCandidates)) {
    const scenarioKey = JSON.stringify(scenario.changes || {});
    if (seenScenarioKeys.has(scenarioKey)) continue;
    seenScenarioKeys.add(scenarioKey);
    if (seenScenarioIds.has(scenario.scenario_id)) continue;
    seenScenarioIds.add(scenario.scenario_id);
    refinedSimulated += 1;
    const simulatedResult = runScenario({ companyId, scenario, baselineBundle });
    if (simulatedResult.simulation_status !== 'success') {
      refinedInvalid += 1;
      refinedInvalidReasons.push(simulatedResult.errors?.[0] || 'simulação inválida');
      continue;
    }
    const result = attachBaselineReference(simulatedResult, baselineResult);
    const quality = evaluateScenarioQuality({ scenarioResult: result, baselineBundle });
    const constraint = evaluateConstraints({
      scenarioResult: result,
      quality,
      scenario,
      constraints,
    });
    if (!constraint.passes_constraints) {
      refinedInvalid += 1;
      refinedInvalidReasons.push(constraint.violations[0] || 'restrição violada');
      continue;
    }
    refinedRecords.push({ scenario, result, quality, constraint });
  }

  const allScenarioRecords = uniqueByChanges([...scenarioRecords, ...refinedRecords]);
  const candidateSpaceSize =
    Number(generated.generation_summary?.candidate_space_size ?? generatedCount) +
    Number(refinementGenerated || 0);
  const totalSimulated = generatedCount + refinedSimulated;
  const totalValid = scenarioRecords.length + refinedRecords.length;
  const totalInvalid = invalid + refinedInvalid;
  const coverageRatio = candidateSpaceSize > 0 ? totalSimulated / candidateSpaceSize : 0;

  if (!allScenarioRecords.length) {
    const message = 'Nenhum cenário viável encontrado no espaço discreto modelado.';
    return buildFailureResult({
      companyId,
      searchLog: buildSearchLog({
        methodRequested: requestedMethod,
        methodApplied: SUPPORTED_METHOD,
        generatedCandidates: generatedCount + refinementGenerated,
        simulatedCandidates: totalSimulated,
        validCandidates: totalValid,
        invalidCandidates: totalInvalid,
        candidateSpaceSize,
        coverageRatio,
        refinementRounds,
        refinementSeedCount,
        refinementCandidatesGenerated: refinementGenerated,
        refinementCandidatesSimulated: refinedSimulated,
        invalidReasons: [...invalidReasons, ...refinedInvalidReasons, message],
      }),
      warnings: searchWarnings,
      errors: [...searchErrors, message],
    });
  }

  const metrics = extractScenarioMetrics({ companyId, scenarioResults: allScenarioRecords });
  const normalized = normalizeMetrics({
    companyId,
    scenarioMetrics: metrics.scenario_metrics,
    referenceMetrics: [
      {
        scenario_id: baselineRecord.result.scenario_id,
        total_cost: baselineRecord.result.total_with_tax,
        service_quality: baselineRecord.quality.quality_score,
        operational_risk: baselineRecord.quality.risk_numeric ?? 50,
        tax_impact: baselineRecord.result.costs?.tax_impact ?? 0,
        inventory_efficiency: baselineRecord.quality.quality_metrics?.inventory_efficiency ?? 50,
      },
    ],
  });
  const scoring = scoreScenarios({
    companyId,
    objective,
    normalizedMetrics: normalized.normalized_metrics,
  });
  const resultById = new Map(allScenarioRecords.map((r) => [r.result.scenario_id, r]));
  const enriched = scoring.scored_scenarios
    .map((s) => {
      const record = resultById.get(s.scenario_id);
      return {
        ...s,
        scenario: record?.scenario,
        result: record?.result,
        quality: record?.quality,
        constraint: record?.constraint,
      };
    })
    .sort(compareExactRanking)
    .map((r, i) => ({ ...r, rank: i + 1 }));
  const best_scenarios = enriched.slice(0, 10);
  const best_by_total_cost =
    [...enriched].sort(
      (a, b) =>
        n(a.result?.total_with_tax, Number.POSITIVE_INFINITY) -
        n(b.result?.total_with_tax, Number.POSITIVE_INFINITY)
    )[0] || null;

  return {
    company_id: companyId,
    optimizer_status: 'success',
    search_strategy: 'broad_then_refine',
    baseline_reference: {
      scenario: baselineScenario,
      result: baselineResult,
      quality: baselineRecord.quality,
      comparison_basis: 'same_tax_regime',
      tax_mode: baselineResult.tax_results?.tax_mode || canonicalConfig.tax_mode,
      tax_regime: baselineResult.tax_results?.tax_regime || canonicalConfig.tax_regime,
    },
    best_scenarios,
    best_by_total_cost,
    scored_scenarios: enriched,
    scenario_records: allScenarioRecords,
    metrics,
    normalized,
    search_log: buildSearchLog({
      methodRequested: requestedMethod,
      methodApplied: SUPPORTED_METHOD,
      generatedCandidates: generatedCount + refinementGenerated,
      simulatedCandidates: totalSimulated,
      validCandidates: totalValid,
      invalidCandidates: totalInvalid,
      candidateSpaceSize,
      coverageRatio,
      refinementRounds,
      refinementSeedCount,
      refinementCandidatesGenerated: refinementGenerated,
      refinementCandidatesSimulated: refinedSimulated,
      bestScore: best_scenarios[0]?.final_score ?? null,
      bestScenarioId: best_scenarios[0]?.scenario_id ?? null,
      bestByTotalCostScenarioId: best_by_total_cost?.scenario_id ?? null,
      bestByTotalCostValue: best_by_total_cost?.result?.total_with_tax ?? null,
      invalidReasons: [...invalidReasons, ...refinedInvalidReasons],
    }),
    warnings: [
      ...searchWarnings,
      ...(metrics.warnings || []),
      ...(normalized.warnings || []),
      ...(scoring.warnings || []),
    ],
    errors: [],
  };
}
