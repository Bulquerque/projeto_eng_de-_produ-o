import { safeNumber } from '../core/common.js';

export function calculateRobustness({
  companyId,
  scenarioId,
  stressResults = [],
  quality = {},
  monteCarlo = null,
  evidence = null,
} = {}) {
  const validStressResults = stressResults.filter(
    (result) => result?.status !== 'blocked' && Number.isFinite(Number(result?.saving_pct))
  );
  const blockedStressCases = stressResults.length - validStressResults.length;
  const total = validStressResults.length || 0;
  const positives = validStressResults.filter((r) => r.scenario_still_better_than_baseline).length;
  const positiveRatio = total ? positives / total : 0;
  const worstCaseSavingPct = total
    ? Math.min(...validStressResults.map((r) => safeNumber(r.saving_pct)))
    : 0;
  const qualityScore = safeNumber(quality.quality_score, 70);
  const risk = String(quality.risk_level || 'medium').toLowerCase();
  const riskPenalty = risk === 'high' ? 18 : risk === 'medium' ? 8 : 0;
  const worstPenalty = worstCaseSavingPct < 0 ? Math.min(30, Math.abs(worstCaseSavingPct) * 2) : 0;
  const stressScore = Math.max(
    0,
    Math.min(100, positiveRatio * 70 + qualityScore * 0.3 - riskPenalty - worstPenalty)
  );
  const mcProbability = Number(monteCarlo?.summary?.probability_saving_positive);
  const mcP10 = Number(monteCarlo?.summary?.p10_saving_pct);
  const hasMonteCarlo = Number.isFinite(mcProbability) && Number.isFinite(mcP10);
  const probabilisticScore = hasMonteCarlo
    ? Math.max(0, Math.min(100, mcProbability * 70 + (mcP10 >= 0 ? 30 : 0)))
    : null;
  const evidenceScore = Number(evidence?.evidence_score);
  const evidencePenalty =
    Number.isFinite(evidenceScore) && evidenceScore < 70
      ? Math.min(20, (70 - evidenceScore) * 0.25)
      : 0;
  const robustness_score = Math.max(
    0,
    Math.min(
      100,
      (hasMonteCarlo ? stressScore * 0.7 + probabilisticScore * 0.3 : stressScore) - evidencePenalty
    )
  );
  const status = robustness_score >= 80 ? 'high' : robustness_score >= 55 ? 'medium' : 'low';
  const alerts = [];
  if (blockedStressCases > 0)
    alerts.push(`${blockedStressCases} caso(s) de stress foram bloqueados por resultado inválido.`);
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
    robustness_status: status,
    cases_positive: positives,
    cases_total: total,
    cases_blocked: blockedStressCases,
    stress_status: blockedStressCases ? 'inconclusive' : 'complete',
    worst_case_saving_pct: worstCaseSavingPct,
    stress_score: stressScore,
    probabilistic_score: probabilisticScore,
    monte_carlo_probability_positive: hasMonteCarlo ? mcProbability : null,
    monte_carlo_p10_saving_pct: hasMonteCarlo ? mcP10 : null,
    evidence_score: Number.isFinite(evidenceScore) ? evidenceScore : null,
    evidence_penalty: evidencePenalty,
    alerts,
    warnings: [],
    errors: [],
  };
}
