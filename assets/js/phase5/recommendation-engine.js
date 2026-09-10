import { safeNumber } from '../core/common.js';
import { isEvidenceSufficientForRecommendation } from '../core/evidence-quality-engine.js';

export function buildRecommendation({
  companyId,
  selectedScenario,
  comparison = {},
  quality = {},
  robustness = {},
  objective = {},
  rankingSensitivity = null,
  optimization = null,
} = {}) {
  const scenarioId =
    selectedScenario?.scenario_id ||
    selectedScenario?.scenario?.scenario_id ||
    selectedScenario?.result?.scenario_id;
  const comparisonRow = (comparison.comparison || []).find(
    (row) => row?.scenario_id === scenarioId
  );
  const savingPct = safeNumber(comparison.saving_pct ?? comparisonRow?.saving_pct);
  const hasPositiveSaving = savingPct > 0;
  const risk = String(
    quality.risk_level || selectedScenario?.quality?.risk_level || 'medium'
  ).toLowerCase();
  const robustnessScore = safeNumber(robustness.robustness_score, 0);
  const monteCarlo =
    selectedScenario?.monte_carlo?.summary ||
    selectedScenario?.scenario?.monte_carlo?.summary ||
    selectedScenario?.monte_carlo_summary ||
    null;
  const mcProbability = monteCarlo
    ? safeNumber(monteCarlo.probability_saving_positive, null)
    : null;
  const mcP10 = monteCarlo ? safeNumber(monteCarlo.p10_saving_pct, null) : null;
  const rankingStable =
    !rankingSensitivity || safeNumber(rankingSensitivity.stability_ratio, 0) >= 0.5;
  const exactSearchSpace = optimization?.exact_search_space !== false;
  const evidence =
    selectedScenario?.result?.evidence || selectedScenario?.evidence || quality.evidence || null;
  const evidenceScore = evidence ? safeNumber(evidence.evidence_score, 0) : 0;
  const evidenceStrongEnough = evidence
    ? isEvidenceSufficientForRecommendation(evidence, { minimumScore: 70 })
    : false;
  const evidenceUsable = evidenceScore >= 45;
  const hasMaterialEvidenceBlockers = Boolean(evidence?.blockers?.length);
  let status = 'not_recommended';
  if (
    hasPositiveSaving &&
    risk !== 'high' &&
    robustnessScore >= 70 &&
    (mcProbability === null || mcProbability >= 0.65) &&
    (mcP10 === null || mcP10 >= 0) &&
    rankingStable &&
    exactSearchSpace &&
    evidenceStrongEnough
  ) {
    status = 'recommended';
  } else if (
    hasPositiveSaving &&
    robustnessScore >= 45 &&
    (mcProbability === null || mcProbability >= 0.5) &&
    evidenceUsable &&
    !hasMaterialEvidenceBlockers
  ) {
    status = 'recommended_with_warnings';
  }
  const main_reasons = [];
  if (hasPositiveSaving) {
    main_reasons.push('saving positivo contra o baseline');
  } else if (savingPct === 0) {
    main_reasons.push('custo igual ao baseline; não há saving operacional');
  }
  if (selectedScenario?.final_score !== undefined)
    main_reasons.push('bom score no objetivo selecionado');
  if (robustnessScore >= 55) main_reasons.push('robustez aceitável nos testes de stress');
  if (monteCarlo) {
    const interpretation = monteCarlo.probability_interpretation
      ? `; ${monteCarlo.probability_interpretation.replaceAll('_', ' ')}`
      : '';
    main_reasons.push(
      `probabilidade de saving positivo de ${
        mcProbability != null
          ? (mcProbability * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
          : '—'
      }%${interpretation}`
    );
    if (mcP10 != null) {
      main_reasons.push(
        `p10 de saving em ${mcP10.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
      );
    }
  }
  const main_risks = [];
  if (risk === 'high' || risk === 'medium')
    main_risks.push(`risco operacional ${risk === 'high' ? 'alto' : 'médio'}`);
  if (robustness.alerts?.length) main_risks.push(...robustness.alerts);
  if (rankingSensitivity?.stability_status === 'unstable')
    main_risks.push('o ranking muda entre perfis de pesos; decisão sensível ao objetivo');
  if (!exactSearchSpace)
    main_risks.push(
      'o espaço de decisão não é completo; o ranking é condicional ao catálogo avaliado'
    );
  if (savingPct < 0) main_risks.push('custo maior que o baseline');
  if (evidence) {
    main_reasons.push(`nível de suporte da evidência: ${evidenceScore}/100`);
    if (evidence.blockers?.length) main_risks.push(...evidence.blockers);
    if (!evidenceStrongEnough)
      main_risks.push('a evidência disponível não sustenta uma recomendação sem alertas');
    if (!evidenceUsable) main_risks.push('dados insuficientes para recomendar o cenário');
  }
  if (monteCarlo && mcProbability != null && mcProbability < 0.5)
    main_risks.push('baixa probabilidade de saving positivo na análise Monte Carlo');
  if (monteCarlo && mcP10 != null && mcP10 < 0)
    main_risks.push('faixa pessimista do Monte Carlo ainda fica abaixo do baseline');
  const executive_summary =
    status === 'not_recommended'
      ? 'O cenário não é recomendado nesta configuração porque não preserva saving ou robustez suficiente contra o baseline.'
      : status === 'recommended'
        ? 'O cenário é recomendado porque reduz custo estimado, mantém risco controlado, apresentou boa robustez e possui evidência suficiente para a conclusão.'
        : 'O cenário é recomendado com alertas: ele melhora o resultado estimado, mas exige validações adicionais de risco, premissas e operação.';
  return {
    company_id: companyId,
    scenario_id: scenarioId,
    recommendation_status: status,
    objective_id: objective.objective_id || null,
    executive_summary,
    main_reasons,
    main_risks,
    next_actions: [
      'validar capacidade operacional dos CDs usados',
      'revisar premissas de malha e realocação',
      'comparar contra dados reais atualizados antes de decisão executiva',
    ],
    warnings: [],
    errors: [],
  };
}
