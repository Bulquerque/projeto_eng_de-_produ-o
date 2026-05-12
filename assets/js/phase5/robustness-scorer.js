function n(v, d = 0) { const x = Number(v); return Number.isFinite(x) ? x : d; }
export function calculateRobustness({ companyId, scenarioId, stressResults = [], quality = {} } = {}) {
  const total = stressResults.length || 0;
  const positives = stressResults.filter(r => r.scenario_still_better_than_baseline).length;
  const positiveRatio = total ? positives / total : 0;
  const worstCaseSavingPct = total ? Math.min(...stressResults.map(r => n(r.saving_pct))) : 0;
  const qualityScore = n(quality.quality_score, 70);
  const risk = String(quality.risk_level || 'medium').toLowerCase();
  const riskPenalty = risk === 'high' ? 18 : risk === 'medium' ? 8 : 0;
  const worstPenalty = worstCaseSavingPct < 0 ? Math.min(30, Math.abs(worstCaseSavingPct) * 2) : 0;
  const robustness_score = Math.max(0, Math.min(100, positiveRatio * 70 + qualityScore * 0.30 - riskPenalty - worstPenalty));
  const status = robustness_score >= 80 ? 'high' : robustness_score >= 55 ? 'medium' : 'low';
  const alerts = [];
  if (worstCaseSavingPct < 0) alerts.push('O cenário perde saving em pelo menos um caso de stress.');
  if (risk === 'high') alerts.push('O risco operacional alto reduz a robustez da recomendação.');
  return { company_id: companyId, scenario_id: scenarioId, robustness_score, robustness_status: status, cases_positive: positives, cases_total: total, worst_case_saving_pct: worstCaseSavingPct, alerts, warnings: [], errors: [] };
}
