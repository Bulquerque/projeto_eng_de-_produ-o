function n(v, d = 0) { const x = Number(v); return Number.isFinite(x) ? x : d; }
export function buildRecommendation({ companyId, selectedScenario, comparison = {}, quality = {}, robustness = {}, objective = {} } = {}) {
  const scenarioId = selectedScenario?.scenario_id || selectedScenario?.scenario?.scenario_id || selectedScenario?.result?.scenario_id;
  const savingPct = n(comparison.saving_pct ?? comparison.comparison?.[0]?.saving_pct);
  const risk = String(quality.risk_level || selectedScenario?.quality?.risk_level || 'medium').toLowerCase();
  const robustnessScore = n(robustness.robustness_score, 0);
  let status = 'not_recommended';
  if (savingPct >= 0 && risk !== 'high' && robustnessScore >= 70) status = 'recommended';
  else if (savingPct >= 0 && robustnessScore >= 45) status = 'recommended_with_warnings';
  const main_reasons = [];
  if (savingPct >= 0) main_reasons.push('saving positivo contra o baseline');
  if (selectedScenario?.final_score !== undefined) main_reasons.push('bom score no objetivo selecionado');
  if (robustnessScore >= 55) main_reasons.push('robustez aceitável nos testes de stress');
  const main_risks = [];
  if (risk === 'high' || risk === 'medium') main_risks.push(`risco operacional ${risk === 'high' ? 'alto' : 'médio'}`);
  if (robustness.alerts?.length) main_risks.push(...robustness.alerts);
  if (savingPct < 0) main_risks.push('custo maior que o baseline');
  const executive_summary = status === 'not_recommended'
    ? 'O cenário não é recomendado nesta configuração porque não preserva saving ou robustez suficiente contra o baseline.'
    : status === 'recommended'
      ? 'O cenário é recomendado porque reduz custo estimado, mantém risco controlado e apresentou boa robustez nos testes.'
      : 'O cenário é recomendado com alertas: ele melhora o resultado estimado, mas exige validações adicionais de risco, premissas e operação.';
  return {
    company_id: companyId,
    scenario_id: scenarioId,
    recommendation_status: status,
    objective_id: objective.objective_id || null,
    executive_summary,
    main_reasons,
    main_risks,
    next_actions: ['validar capacidade operacional dos CDs usados', 'refinar premissas tributárias e de frete', 'comparar contra dados reais atualizados antes de decisão executiva'],
    warnings: [],
    errors: []
  };
}
