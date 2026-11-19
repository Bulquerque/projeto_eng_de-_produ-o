import { safeNumber } from '../core/common.js';

function finiteValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function calculateRobustness({
  companyId,
  scenarioId,
  stressResults = [],
  expectedStressCaseCount = null,
  quality = {},
  monteCarlo = null,
  evidence = null,
} = {}) {
  const stressList = Array.isArray(stressResults) ? stressResults : [];
  const validStressResults = stressList.filter(
    (result) =>
      result?.status !== 'blocked' &&
      finiteValue(result?.saving_pct) !== null &&
      typeof result?.scenario_still_better_than_baseline === 'boolean'
  );
  const blockedStressCases = stressList.length - validStressResults.length;
  const expectedStressCount = finiteValue(expectedStressCaseCount);
  const uniqueStressCaseCount = new Set(
    stressList.map((result) => String(result?.case_id || '')).filter(Boolean)
  ).size;
  const limitedStressCases = validStressResults.filter(
    (result) => result.data_quality_status === 'limited_fiscal_coverage'
  ).length;
  const stressComplete =
    expectedStressCount !== null &&
    expectedStressCount > 0 &&
    stressList.length === expectedStressCount &&
    uniqueStressCaseCount === expectedStressCount &&
    validStressResults.length === expectedStressCount;
  const total = validStressResults.length || 0;
  const positives = validStressResults.filter((r) => r.scenario_still_better_than_baseline).length;
  const positiveRatio = total ? positives / total : 0;
  const worstCaseSavingPct = total
    ? Math.min(...validStressResults.map((r) => safeNumber(r.saving_pct)))
    : 0;
  const suppliedQualityScore = finiteValue(quality?.quality_score);
  const qualityScore = suppliedQualityScore ?? 0;
  const risk = String(quality?.risk_level || '').toLowerCase();
  const qualityComplete =
    suppliedQualityScore !== null &&
    suppliedQualityScore >= 0 &&
    suppliedQualityScore <= 100 &&
    ['low', 'medium', 'high'].includes(risk);
  const riskPenalty = risk === 'high' ? 18 : risk === 'medium' ? 8 : 0;
  const worstPenalty = worstCaseSavingPct < 0 ? Math.min(30, Math.abs(worstCaseSavingPct) * 2) : 0;
  const stressScore = Math.max(
    0,
    Math.min(100, positiveRatio * 70 + qualityScore * 0.3 - riskPenalty - worstPenalty)
  );
  const mcProbability = finiteValue(monteCarlo?.summary?.probability_saving_positive);
  const mcP10 = finiteValue(monteCarlo?.summary?.p10_saving_pct);
  const requestedIterations = finiteValue(monteCarlo?.summary?.iterations_requested);
  const validIterations = finiteValue(monteCarlo?.summary?.iterations_valid);
  const monteCarloComplete =
    monteCarlo?.monte_carlo_status === 'success' &&
    mcProbability !== null &&
    mcProbability >= 0 &&
    mcProbability <= 1 &&
    mcP10 !== null &&
    requestedIterations !== null &&
    validIterations !== null &&
    requestedIterations > 0 &&
    validIterations === requestedIterations &&
    monteCarlo?.data_quality_status !== 'limited_fiscal_coverage';
  const hasMonteCarlo = monteCarloComplete;
  const probabilisticScore = hasMonteCarlo
    ? Math.max(0, Math.min(100, mcProbability * 70 + (mcP10 >= 0 ? 30 : 0)))
    : null;
  const evidenceScore = finiteValue(evidence?.evidence_score);
  const evidenceComplete = evidenceScore !== null && evidenceScore >= 0 && evidenceScore <= 100;
  const evidencePenalty =
    Number.isFinite(evidenceScore) && evidenceScore < 70
      ? Math.min(20, (70 - evidenceScore) * 0.25)
      : 0;
  const missingInputs = [];
  if (!stressComplete) missingInputs.push('stress_completo');
  if (!qualityComplete) missingInputs.push('qualidade_e_risco');
  const scoreAvailable = stressComplete && qualityComplete;
  const robustness_score = scoreAvailable
    ? Math.max(
        0,
        Math.min(
          100,
          (hasMonteCarlo ? stressScore * 0.7 + probabilisticScore * 0.3 : stressScore) -
            (evidenceComplete ? evidencePenalty : 0)
        )
      )
    : null;
  const status =
    robustness_score === null
      ? 'not_calculated'
      : robustness_score >= 80
        ? 'high'
        : robustness_score >= 55
          ? 'medium'
          : 'low';
  const fiscalCoverageLimited = limitedStressCases > 0;
  const robustnessInterpretation = fiscalCoverageLimited
    ? 'robustez_condicional_exploratoria'
    : 'robustez_condicional_modelada';
  const alerts = [];
  if (!scoreAvailable)
    alerts.push(`Robustez não calculada: faltam insumos completos (${missingInputs.join(', ')}).`);
  if (scoreAvailable && !monteCarloComplete)
    alerts.push('Monte Carlo completo indisponível; o índice usa apenas stress e qualidade.');
  if (scoreAvailable && !evidenceComplete)
    alerts.push('Score de evidência indisponível; a penalidade de evidência não foi aplicada.');
  if (blockedStressCases > 0)
    alerts.push(`${blockedStressCases} caso(s) de stress foram bloqueados por resultado inválido.`);
  if (limitedStressCases > 0)
    alerts.push(
      `${limitedStressCases} caso(s) de stress foram calculados com cobertura fiscal parcial; a robustez é exploratória.`
    );
  if (worstCaseSavingPct < 0)
    alerts.push('O cenário perde saving em pelo menos um caso de stress.');
  if (risk === 'high') alerts.push('O risco operacional alto reduz a robustez da recomendação.');
  if (hasMonteCarlo && mcProbability < 0.65)
    alerts.push('A probabilidade condicional de saving positivo é inferior a 65%.');
  if (Number.isFinite(evidenceScore) && evidenceScore < 55)
    alerts.push('A qualidade da evidência limita a interpretação da robustez.');
  return {
    company_id: companyId,
    scenario_id: scenarioId,
    robustness_score,
    conditional_robustness_score: robustness_score,
    certified_robustness_score:
      fiscalCoverageLimited || !scoreAvailable || !monteCarloComplete || !evidenceComplete
        ? null
        : robustness_score,
    robustness_interpretation: scoreAvailable
      ? robustnessInterpretation
      : 'robustez_nao_calculada_insumos_incompletos',
    robustness_status: status,
    robustness_calculation_status: scoreAvailable
      ? fiscalCoverageLimited || !monteCarloComplete || !evidenceComplete
        ? 'complete_with_warnings'
        : 'complete'
      : 'incomplete_inputs',
    missing_inputs: missingInputs,
    cases_positive: positives,
    cases_total: total,
    cases_blocked: blockedStressCases,
    stress_status: !stressComplete
      ? 'inconclusive'
      : limitedStressCases
        ? 'complete_with_warnings'
        : 'complete',
    cases_limited: limitedStressCases,
    worst_case_saving_pct: total ? worstCaseSavingPct : null,
    stress_score: stressComplete && qualityComplete ? stressScore : null,
    probabilistic_score: monteCarloComplete ? probabilisticScore : null,
    monte_carlo_probability_positive: monteCarloComplete ? mcProbability : null,
    monte_carlo_p10_saving_pct: monteCarloComplete ? mcP10 : null,
    evidence_score: evidenceComplete ? evidenceScore : null,
    evidence_penalty: evidenceComplete ? evidencePenalty : null,
    alerts,
    warnings: [],
    errors: [],
  };
}
