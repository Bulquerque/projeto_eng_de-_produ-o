import { MODEL_ASSUMPTIONS } from '../shared/model-assumptions.js';

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}
export function calculateRobustness({
  companyId,
  scenarioId,
  stressResults = [],
  quality = {},
} = {}) {
  const warnings = [];
  const total = stressResults.length || 0;
  const positives = stressResults.filter((r) => r.scenario_still_better_than_baseline).length;
  const positiveRatio = total ? positives / total : 0;
  const worstCaseSavingPct = total ? Math.min(...stressResults.map((r) => n(r.saving_pct))) : 0;
  const assumptions = MODEL_ASSUMPTIONS.robustness;
  const qualityScore = n(quality.quality_score, assumptions.default_quality_score);
  if (!Number.isFinite(Number(quality.quality_score))) {
    warnings.push(
      `quality_score ausente; proxy explícito ${assumptions.default_quality_score} aplicado.`
    );
  }
  if (!quality.risk_level) warnings.push('risk_level ausente; proxy explícito "medium" aplicado.');
  const risk = String(quality.risk_level || 'medium').toLowerCase();
  const riskPenalty =
    risk === 'high'
      ? assumptions.high_risk_penalty
      : risk === 'medium'
        ? assumptions.medium_risk_penalty
        : 0;
  const worstPenalty =
    worstCaseSavingPct < 0
      ? Math.min(
          assumptions.negative_saving_penalty_cap,
          Math.abs(worstCaseSavingPct) * assumptions.negative_saving_penalty_multiplier
        )
      : 0;
  const robustness_score = Math.max(
    0,
    Math.min(
      100,
      positiveRatio * assumptions.positive_case_weight +
        qualityScore * assumptions.quality_weight -
        riskPenalty -
        worstPenalty
    )
  );
  const status =
    robustness_score >= assumptions.high_threshold
      ? 'high'
      : robustness_score >= assumptions.medium_threshold
        ? 'medium'
        : 'low';
  const alerts = [];
  if (worstCaseSavingPct < 0)
    alerts.push('O cenário perde saving em pelo menos um caso de stress.');
  if (risk === 'high') alerts.push('O risco operacional alto reduz a robustez da recomendação.');
  return {
    company_id: companyId,
    scenario_id: scenarioId,
    robustness_score,
    robustness_status: status,
    cases_positive: positives,
    cases_total: total,
    worst_case_saving_pct: worstCaseSavingPct,
    calculation_mode: 'parameterized_proxy',
    alerts,
    warnings,
    errors: [],
  };
}
