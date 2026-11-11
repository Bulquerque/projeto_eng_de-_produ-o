import { generateCandidateScenarios } from './candidate-scenario-generator.js';
import { runScenario } from '../phase3/scenario-simulator.js';
import { evaluateScenarioQuality } from '../phase3/scenario-quality-check.js';
import { evaluateConstraints, validateConstraintConfig } from './constraint-engine.js';
import { extractScenarioMetrics } from './scenario-metric-extractor.js';
import { normalizeMetrics } from './metric-normalizer.js';
import { scoreScenarios } from './scenario-scoring.js';
import {
  SUPPORTED_METHOD,
  buildBaselineScenario,
  buildFailureResult,
  buildSearchLog,
  classifyRefinementCandidates,
  compareExactRanking,
  scenarioChangesKey,
  uniqueByChanges,
} from './optimizer-utils.js';
import { buildRefinementVariants } from './optimizer-refinement.js';
import {
  CANONICAL_OPTIMIZATION_POLICY,
  buildCanonicalOptimizationConfig,
} from '../core/optimization-policy.js';
import { safeNumber } from '../core/common.js';
import { normalizeObjective, validateObjective } from './objective-validator.js';
import { assessObjectiveSensitivity } from './optimization-sensitivity.js';
import { buildDataQualityAssessment } from '../core/analysis-quality.js';

const REFINEMENT_CONFIG = Object.freeze({
  allow_tax_toggle: false,
  freight_steps: [],
  demand_steps: [],
  inventory_steps: [],
  wacc_steps: [],
});

// Keep the optimizer's reference and every candidate on the same physical model.
// The simulator's default may use the canonical anchor for an unchanged network.
const OPTIMIZER_BASELINE_MODE = 'physical_unanchored';

function evaluateCandidate({ companyId, scenario, baselineBundle, constraints }) {
  const result = runScenario({
    companyId,
    scenario,
    baselineBundle,
    baselineMode: OPTIMIZER_BASELINE_MODE,
  });
  if (result.simulation_status !== 'success') {
    return { reason: result.errors?.[0] || 'simulação inválida' };
  }
  const quality = evaluateScenarioQuality({ scenarioResult: result, baselineBundle });
  const constraint = evaluateConstraints({
    scenarioResult: result,
    quality,
    scenario,
    constraints,
  });
  if (!constraint.passes_constraints) {
    return { reason: constraint.violations[0] || 'restrição violada' };
  }

  return {
    record: {
      scenario,
      result,
      quality,
      constraint,
      data_quality: buildDataQualityAssessment({
        taxResults: result.tax_results,
        scenario,
      }),
    },
  };
}

function evaluateCandidates(
  candidates,
  { companyId, baselineBundle, constraints, deduplicate = false, seenScenarioIds, seenScenarioKeys }
) {
  const records = [];
  const invalidReasons = [];
  let invalid = 0;
  let simulated = 0;
  const scenarios = deduplicate ? uniqueByChanges(candidates) : candidates;

  for (const scenario of scenarios) {
    const scenarioKey = scenarioChangesKey(scenario.changes || {});
    if (seenScenarioKeys?.has(scenarioKey)) continue;
    seenScenarioKeys?.add(scenarioKey);
    if (seenScenarioIds?.has(scenario.scenario_id)) continue;
    seenScenarioIds?.add(scenario.scenario_id);
    simulated += 1;

    const evaluation = evaluateCandidate({ companyId, scenario, baselineBundle, constraints });
    if (!evaluation.record) {
      invalid += 1;
      invalidReasons.push(evaluation.reason);
      continue;
    }
    records.push(evaluation.record);
  }

  return { records, invalid, invalidReasons, simulated };
}

function buildBaselineReferenceMetrics(baselineRecord) {
  if (!baselineRecord.result?.scenario_id) return [];
  return [
    {
      scenario_id: baselineRecord.result.scenario_id,
      total_cost: baselineRecord.result.total_with_tax,
      service_quality: baselineRecord.quality.quality_score,
      operational_risk: baselineRecord.quality.risk_numeric ?? 50,
      tax_impact: baselineRecord.result.costs?.tax_impact ?? 0,
      inventory_efficiency: baselineRecord.quality.quality_metrics?.inventory_efficiency ?? 50,
    },
  ];
}

function buildRankedScenarios(scoring, records) {
  const recordById = new Map(records.map((record) => [record.result.scenario_id, record]));
  return scoring.scored_scenarios
    .map((scored) => {
      const record = recordById.get(scored.scenario_id);
      return {
        ...scored,
        scenario: record?.scenario,
        result: record?.result,
        quality: record?.quality,
        constraint: record?.constraint,
        data_quality: record?.data_quality,
      };
    })
    .sort(compareExactRanking)
    .map((record, index) => ({ ...record, rank: index + 1 }));
}

export function runOptimization({
  companyId,
  baselineBundle,
  objective,
  taxYear = null,
  constraints = {},
  optimizerConfig = {},
}) {
  const researchTaxDisabled = optimizerConfig.research_tax_disabled === true;
  const effectiveConstraints = researchTaxDisabled
    ? { ...constraints, allow_tax_disabled: true }
    : constraints;
  const canonicalConfig = buildCanonicalOptimizationConfig(
    optimizerConfig,
    companyId,
    baselineBundle
  );
  const requestedMethod = String(canonicalConfig.method || 'exact_discrete');
  const maxCandidates = Number(canonicalConfig.max_candidates ?? 2000);
  const refinementRounds = Math.max(0, Math.floor(Number(optimizerConfig.refinement_rounds ?? 2)));
  const refinementSeedCount = Math.max(
    1,
    Math.floor(Number(optimizerConfig.refinement_seed_count ?? 5))
  );
  const objectiveValidation = validateObjective(objective, { expectedCompanyId: companyId });
  if (!objectiveValidation.valid) {
    return buildFailureResult({
      companyId,
      searchLog: buildSearchLog({
        methodRequested: String(optimizerConfig.method || 'exact_discrete'),
        methodApplied: null,
        refinementRounds,
        refinementSeedCount,
        seed: canonicalConfig.seed,
        invalidReasons: objectiveValidation.errors,
      }),
      warnings: objectiveValidation.warnings,
      errors: objectiveValidation.errors,
    });
  }
  const effectiveObjective = normalizeObjective(objective);
  const constraintValidation = validateConstraintConfig(effectiveConstraints);
  if (!constraintValidation.valid) {
    return buildFailureResult({
      companyId,
      searchLog: buildSearchLog({
        methodRequested: requestedMethod,
        methodApplied: SUPPORTED_METHOD,
        refinementRounds,
        refinementSeedCount,
        seed: canonicalConfig.seed,
        invalidReasons: constraintValidation.errors,
      }),
      errors: constraintValidation.errors,
    });
  }

  const candidateGenerationConfig = {
    max_candidates: maxCandidates,
    freight_multipliers: [CANONICAL_OPTIMIZATION_POLICY.freight_multiplier],
    inventory_days_options: [canonicalConfig.inventory_days],
    base_tax_mode: researchTaxDisabled ? 'disabled' : CANONICAL_OPTIMIZATION_POLICY.tax_mode,
    base_tax_regime: researchTaxDisabled ? 'disabled' : CANONICAL_OPTIMIZATION_POLICY.tax_regime,
    tax_year: researchTaxDisabled ? null : taxYear,
    allow_tax_disabled: researchTaxDisabled || CANONICAL_OPTIMIZATION_POLICY.allow_tax_disabled,
    demand_multipliers: [CANONICAL_OPTIMIZATION_POLICY.demand_multiplier],
    seed: canonicalConfig.seed,
    exhaustive_subsets: optimizerConfig.exhaustive_subsets === true,
  };
  const generated = generateCandidateScenarios({
    companyId,
    baselineBundle,
    generationConfig: candidateGenerationConfig,
  });

  const generatedCount = generated.candidate_scenarios.length;
  const searchWarnings = [...(generated.warnings || [])];
  const searchErrors = [...(generated.errors || [])];
  if (!generated.generation_summary?.search_space_complete) {
    searchWarnings.push(
      'O espaço de CDs foi catalogado por uma estratégia limitada; o resultado é ótimo somente dentro dos candidatos avaliados.'
    );
  }

  if (requestedMethod !== SUPPORTED_METHOD) {
    const message = `Método de busca "${requestedMethod}" não é suportado. Use "${SUPPORTED_METHOD}".`;
    return buildFailureResult({
      companyId,
      searchLog: buildSearchLog({
        methodRequested: requestedMethod,
        methodApplied: null,
        refinementRounds,
        refinementSeedCount,
        seed: canonicalConfig.seed,
        exactSearchSpace: false,
        invalidReasons: [message],
      }),
      errors: [message],
    });
  }

  if (generated.generation_summary?.limited_by_max_candidates) {
    const message = `Espaço discreto truncado pelo limite de segurança (${maxCandidates}). Aumente o limite para avaliar todas as alternativas.`;
    return buildFailureResult({
      companyId,
      searchLog: buildSearchLog({
        methodRequested: requestedMethod,
        methodApplied: SUPPORTED_METHOD,
        generatedCandidates: generatedCount,
        candidateSpaceSize: generated.generation_summary?.candidate_space_size ?? generatedCount,
        refinementRounds,
        refinementSeedCount,
        seed: canonicalConfig.seed,
        spaceLimited: true,
        exactSearchSpace: false,
        invalidReasons: [message],
      }),
      warnings: searchWarnings,
      errors: [...searchErrors, message],
    });
  }

  const initialEvaluation = evaluateCandidates(generated.candidate_scenarios, {
    companyId,
    baselineBundle,
    constraints: effectiveConstraints,
  });
  const { records: scenarioRecords, invalid, invalidReasons } = initialEvaluation;

  const baselineScenario = buildBaselineScenario(
    companyId,
    baselineBundle,
    generated.candidate_scenarios[0]?.changes
  );
  const baselineResult = runScenario({
    companyId,
    scenario: baselineScenario,
    baselineBundle,
    baselineMode: OPTIMIZER_BASELINE_MODE,
  });
  if (baselineResult.simulation_status !== 'success') {
    const message = 'Falha ao simular o baseline de referência.';
    return buildFailureResult({
      companyId,
      searchLog: buildSearchLog({
        methodRequested: requestedMethod,
        methodApplied: SUPPORTED_METHOD,
        generatedCandidates: generatedCount,
        simulatedCandidates: initialEvaluation.simulated,
        validCandidates: scenarioRecords.length,
        invalidCandidates: invalid,
        refinementRounds,
        refinementSeedCount,
        seed: canonicalConfig.seed,
        invalidReasons: [message],
      }),
      warnings: searchWarnings,
      errors: [message],
    });
  }

  const baselineRecord = {
    scenario: baselineScenario,
    result: baselineResult,
    quality: evaluateScenarioQuality({ scenarioResult: baselineResult, baselineBundle }),
    constraint: { passes_constraints: true, violations: [], warnings: [] },
  };

  // Select refinement seeds from a stable candidate order, never from a
  // profile's preliminary score. This keeps the evaluated catalog identical
  // across profiles for the same company, generated space and constraints.
  const refinementSeeds = uniqueByChanges(
    [...scenarioRecords]
      .sort((a, b) =>
        String(a.result?.scenario_id || '').localeCompare(String(b.result?.scenario_id || ''))
      )
      .slice(0, refinementSeedCount)
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
        refinementConfig: REFINEMENT_CONFIG,
      });
      refinementGenerated += variants.length;
      refinedCandidates.push(...variants);
    }
  }

  const baseScenarioKeys = new Set([
    ...generated.candidate_scenarios.map((candidate) =>
      scenarioChangesKey(candidate?.changes || {})
    ),
    scenarioChangesKey(baselineRecord.scenario?.changes || {}),
  ]);
  const seenScenarioIds = new Set([
    ...generated.candidate_scenarios.map((candidate) => candidate.scenario_id),
    baselineRecord.result.scenario_id,
  ]);
  const seenScenarioKeys = new Set(baseScenarioKeys);
  const refinedEvaluation = evaluateCandidates(refinedCandidates, {
    companyId,
    baselineBundle,
    constraints: effectiveConstraints,
    deduplicate: true,
    seenScenarioIds,
    seenScenarioKeys,
  });
  const {
    records: refinedRecords,
    invalid: refinedInvalid,
    invalidReasons: refinedInvalidReasons,
    simulated: refinedSimulated,
  } = refinedEvaluation;

  const baseCandidateSpaceSize = Number(
    generated.generation_summary?.candidate_space_size ?? generatedCount
  );
  const searchDomain = {
    active_cd_ids: baselineBundle?.model?.active_cds || [],
    dimensions: {
      freight_multipliers: candidateGenerationConfig.freight_multipliers,
      demand_multipliers: candidateGenerationConfig.demand_multipliers,
      inventory_days_options: candidateGenerationConfig.inventory_days_options,
      tax_modes: candidateGenerationConfig.allow_tax_disabled
        ? [
            ...new Set(
              [generated.candidate_scenarios[0]?.changes?.tax_mode, 'disabled'].filter(Boolean)
            ),
          ]
        : [
            generated.candidate_scenarios[0]?.changes?.tax_mode ||
              candidateGenerationConfig.base_tax_mode,
          ],
    },
    fixed_changes: generated.candidate_scenarios[0]?.changes || {},
  };
  const refinementCounts = classifyRefinementCandidates({
    candidates: refinedCandidates,
    baseScenarioKeys,
    domain: searchDomain,
    baseCandidateSpaceSize,
  });
  const { outsideDeclaredSpaceCount: outsideRefinementCount } = refinementCounts;
  const allScenarioRecords = uniqueByChanges([...scenarioRecords, ...refinedRecords]);
  const candidateSpaceSize = refinementCounts.candidateSpaceSize;
  const totalSimulated = generatedCount + refinedSimulated;
  const totalValid = scenarioRecords.length + refinedRecords.length;
  const totalInvalid = invalid + refinedInvalid;
  const limitedFiscalRecords = allScenarioRecords.filter(
    (record) => record.data_quality?.coverage_limited
  );
  const physicalProxyRecords = allScenarioRecords.filter(
    (record) =>
      record.result?.diagnostics?.transfer_proxy_assessment?.decision_use === 'exploratory_only'
  );
  const coverageRatio = candidateSpaceSize > 0 ? totalSimulated / candidateSpaceSize : 0;
  const baseSpaceComplete = Boolean(generated.generation_summary?.search_space_complete);
  const exactSearchSpace =
    baseSpaceComplete &&
    !generated.generation_summary?.limited_by_max_candidates &&
    outsideRefinementCount === 0;
  const exactnessReason = exactSearchSpace
    ? 'Todas as combinações discretas declaradas foram enumeradas sem truncamento ou refino adicional.'
    : baseSpaceComplete && outsideRefinementCount > 0
      ? 'A enumeração-base é completa, mas o refino adicionou candidatos fora do domínio discreto declarado.'
      : generated.generation_summary?.limited_by_max_candidates
        ? 'A enumeração foi truncada pelo limite máximo de candidatos.'
        : 'A estratégia de CDs é um catálogo limitado; não representa todas as combinações possíveis.';

  const spaceLimited =
    !baseSpaceComplete ||
    Boolean(generated.generation_summary?.limited_by_max_candidates) ||
    outsideRefinementCount > 0;

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
        refinementCandidatesUnique: refinementCounts.uniqueCandidateCount,
        refinementCandidatesNewToCatalog: refinementCounts.newToCatalogCount,
        refinementCandidatesWithinDeclaredSpace: refinementCounts.withinDeclaredSpaceCount,
        refinementCandidatesOutsideDeclaredSpace: refinementCounts.outsideDeclaredSpaceCount,
        baseCandidateSpaceSize,
        seed: canonicalConfig.seed,
        spaceLimited,
        exactSearchSpace,
        exactnessReason,
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
    referenceMetrics: buildBaselineReferenceMetrics(baselineRecord),
  });
  const scoring = scoreScenarios({
    companyId,
    objective: effectiveObjective,
    normalizedMetrics: normalized.normalized_metrics,
  });
  const rankingSensitivity = assessObjectiveSensitivity({
    companyId,
    scenarioMetrics: metrics.scenario_metrics,
    referenceMetrics: buildBaselineReferenceMetrics(baselineRecord),
  });
  const enriched = buildRankedScenarios(scoring, allScenarioRecords);
  const best_scenarios = enriched.slice(0, 10);
  const best_by_total_cost =
    [...enriched].sort(
      (a, b) =>
        safeNumber(a.result?.total_with_tax, Number.POSITIVE_INFINITY) -
        safeNumber(b.result?.total_with_tax, Number.POSITIVE_INFINITY)
    )[0] || null;

  return {
    company_id: companyId,
    comparison_baseline_mode: OPTIMIZER_BASELINE_MODE,
    refinement_seed_policy: 'stable_scenario_id_order_independent_of_objective',
    tax_research_mode: researchTaxDisabled ? 'all_scenarios_tax_disabled' : 'canonical_tax_policy',
    optimizer_status: exactSearchSpace ? 'success' : 'success_with_limited_space',
    result_scope: exactSearchSpace ? 'exact_declared_space' : 'conditional_declared_catalog',
    data_quality_status: limitedFiscalRecords.length ? 'limited_fiscal_coverage' : 'complete',
    decision_use:
      researchTaxDisabled || limitedFiscalRecords.length || physicalProxyRecords.length
        ? 'exploratory_only'
        : 'decision_support',
    data_quality_summary: {
      candidates_with_limited_fiscal_coverage: limitedFiscalRecords.length,
      candidates_with_complete_fiscal_coverage:
        allScenarioRecords.length - limitedFiscalRecords.length,
      candidates_with_physical_proxy_limit: physicalProxyRecords.length,
    },
    search_strategy: 'broad_then_refine',
    best_scenarios,
    best_by_total_cost,
    scored_scenarios: enriched,
    scenario_records: allScenarioRecords,
    baseline_reference: baselineRecord,
    metrics,
    normalized,
    ranking_sensitivity: rankingSensitivity,
    search_log: {
      ...buildSearchLog({
        methodRequested: requestedMethod,
        methodApplied: SUPPORTED_METHOD,
        generatedCandidates: generatedCount + refinementGenerated,
        simulatedCandidates: totalSimulated,
        validCandidates: totalValid,
        invalidCandidates: totalInvalid,
        candidateSpaceSize,
        coverageRatio,
        exactSearchSpace,
        exactnessReason,
        refinementRounds,
        refinementSeedCount,
        refinementCandidatesGenerated: refinementGenerated,
        refinementCandidatesSimulated: refinedSimulated,
        refinementCandidatesUnique: refinementCounts.uniqueCandidateCount,
        refinementCandidatesNewToCatalog: refinementCounts.newToCatalogCount,
        refinementCandidatesWithinDeclaredSpace: refinementCounts.withinDeclaredSpaceCount,
        refinementCandidatesOutsideDeclaredSpace: refinementCounts.outsideDeclaredSpaceCount,
        baseCandidateSpaceSize,
        seed: canonicalConfig.seed,
        spaceLimited,
        bestScore: best_scenarios[0]?.final_score ?? null,
        bestScenarioId: best_scenarios[0]?.scenario_id ?? null,
        bestByTotalCostScenarioId: best_by_total_cost?.scenario_id ?? null,
        bestByTotalCostValue: best_by_total_cost?.result?.total_with_tax ?? null,
        invalidReasons: [...invalidReasons, ...refinedInvalidReasons],
      }),
      data_quality_status: limitedFiscalRecords.length ? 'limited_fiscal_coverage' : 'complete',
      limited_fiscal_candidates: limitedFiscalRecords.length,
    },
    warnings: [
      ...searchWarnings,
      ...(researchTaxDisabled
        ? [
            'Modo de pesquisa sem tributos: baseline e todos os candidatos são simulados sem tributo; resultados somente exploratórios.',
          ]
        : []),
      ...(physicalProxyRecords.length
        ? [
            'A transferência usa proxy física não validada; o ranking é exploratório e não constitui recomendação operacional.',
          ]
        : []),
      ...(exactSearchSpace
        ? []
        : [
            'Ranking condicional: o espaço avaliado não é completo; não representa ótimo global fora do catálogo declarado.',
          ]),
      ...(metrics.warnings || []),
      ...(normalized.warnings || []),
      ...(scoring.warnings || []),
      ...(rankingSensitivity.warnings || []),
      ...(limitedFiscalRecords.length
        ? [
            `A busca encontrou ${limitedFiscalRecords.length} cenário(s) com cobertura fiscal parcial; a classificação é exploratória e os campos ausentes não foram inventados.`,
          ]
        : []),
    ],
    errors: [],
  };
}
