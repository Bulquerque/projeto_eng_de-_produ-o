import {
  card,
  emptyState,
  escapeHtml,
  formatBRL,
  formatNumber,
  formatPct,
  kpi,
  sectionTabs,
  table,
} from '../view-helpers.js';
import {
  selectActiveCompany,
  selectActiveScenario,
  selectBaseline,
  selectDecision,
} from '../selectors/business-selectors.js';
import { renderBrazilMap, renderNetworkSvg } from '../charts/charts.js';
import { robustnessPresentation, userStatusLabel } from '../charts/trust-analytics.js';

function humanizeCode(value, labels = {}) {
  if (!['string', 'number'].includes(typeof value) || value === '') return 'Não informado';
  const key = String(value).trim().toLowerCase();
  if (labels[key]) return labels[key];
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^./, (letter) => letter.toLocaleUpperCase('pt-BR'));
}

function formatFiscalWeight(value) {
  if (!['string', 'number'].includes(typeof value) || value === '') return '—';
  const ratio = Number(value);
  return Number.isFinite(ratio) && ratio >= 0 && ratio <= 1 ? formatPct(ratio * 100) : '—';
}

function selectedScenarioTotal(decision, selected, baselineTotal) {
  const hasTotal = (result) =>
    result && Object.prototype.hasOwnProperty.call(result, 'total_with_tax');
  if (selected && selected.scenario_type !== 'baseline') {
    if (hasTotal(decision.result)) return decision.result.total_with_tax;
    if (hasTotal(selected.result)) return selected.result.total_with_tax;
    return null;
  }
  if (hasTotal(decision.result)) return decision.result.total_with_tax;
  if (hasTotal(selected?.result)) return selected.result.total_with_tax;
  return baselineTotal;
}

function baselineResult(state) {
  const baseline = selectBaseline(state);
  return {
    costs: baseline?.costs?.costs || {},
    model: baseline?.model || {},
    tax: baseline?.tax_results?.tax_results || {},
  };
}

function formatRecommendationStatus(status) {
  if (status == null || status === '') return 'Aguardando recomendação';
  return (
    {
      recommended_with_warnings: 'Recomendado com ressalvas',
      recommended: 'Recomendado',
      not_recommended: 'Não recomendado',
      baseline_ready: 'Baseline carregado',
    }[status] || humanizeCode(status, { no_recommendation: 'Sem recomendação calculada' })
  );
}

export function renderOverviewSummary(state) {
  const base = baselineResult(state);
  const decision = selectDecision(state);
  const selected = selectActiveScenario(state);
  const total = selectedScenarioTotal(decision, selected, base.costs.total_with_tax);
  const evidence = decision.result?.evidence;
  const quality = decision.quality || selected?.quality || decision.result?.quality || {};
  const monteCarlo = decision.risk?.monte_carlo?.summary || {};
  const probabilitySaving = monteCarlo.probability_saving_positive;
  const robustness = robustnessPresentation(decision.risk?.robustness);
  const recommendation = decision.recommendation;
  const summaryTitle =
    recommendation?.executive_summary || 'Síntese do custo e da qualidade dos dados selecionados.';
  const summaryStatus = formatRecommendationStatus(recommendation?.recommendation_status);
  const summaryReasons = recommendation?.main_reasons?.length
    ? recommendation.main_reasons
    : ['Ainda não há recomendação calculada para os dados selecionados.'];
  return `<div class="ni-page-heading" data-testid="page-overview-summary"><p class="ni-eyebrow">Visão executiva</p><h1>Visão executiva</h1><p>Recomendação, custo e qualidade do cenário selecionado.</p></div>${sectionTabs('overview', state.ui.route)}
    <section class="ni-hero-card" data-testid="overview-recommendation"><div><p class="ni-eyebrow">Recomendação atual</p><h2>${escapeHtml(summaryStatus)}</h2><p>${escapeHtml(summaryTitle)}</p><div class="ni-actions"><a class="ni-button primary" href="#/network/scenarios/build" data-route="#/network/scenarios/build">Abrir cenário</a><a class="ni-button secondary" href="#/network/optimizer/configure" data-route="#/network/optimizer/configure">Executar análise</a></div></div><div class="ni-hero-aside"><span>CENÁRIO ATIVO</span><strong>${escapeHtml(selected?.scenario_name || base.model.scenario_id || 'Baseline')}</strong><span>${formatBRL(total, true)} · ${state.context.provider_kind === 'mock' ? 'demonstração' : 'dados da empresa'}</span></div></section>
    <div class="ni-kpi-grid">${kpi('Simulações com economia', probabilitySaving == null ? '—' : formatPct(probabilitySaving * 100), 'Fração simulada com saving positivo')}${kpi(robustness.label, robustness.value == null ? '—' : `${formatNumber(robustness.value, 1)}/100`, robustness.note)}${kpi('Evidência', evidence?.evidence_score == null ? '—' : `${evidence.evidence_score}/100`, userStatusLabel(evidence?.evidence_status || 'aguardando cenário'), 'evidence-score')}${kpi('Risco', humanizeCode(quality.risk_level, { low: 'Baixo', medium: 'Médio', high: 'Alto', critical: 'Crítico' }), selected ? 'Qualidade operacional do cenário' : 'Aguardando cenário')}</div>
    <div class="ni-grid two">${card(recommendation ? 'Recomendação para o cenário' : 'Leitura do cenário', `<p class="ni-note">${escapeHtml(selected?.scenario_name || base.model.scenario_id || 'Baseline')}</p><ul class="ni-list">${summaryReasons.map((reason) => `<li>✓ ${escapeHtml(reason)}</li>`).join('')}</ul>`, { eyebrow: 'Síntese' })}${card('Baseline', `<dl class="ni-details"><div><dt>Cenário</dt><dd>${escapeHtml(base.model.scenario_id || '—')}</dd></div><div><dt>Fluxos</dt><dd>${formatNumber(baseFlows(state))}</dd></div><div><dt>Uso permitido</dt><dd>${escapeHtml(humanizeCode(base.tax.decision_use, { demo_only: 'Apenas demonstração', exploratory_only: 'Apenas exploratório', decision_support: 'Apoio à decisão' }))}</dd></div></dl>`, { eyebrow: 'Referência' })}</div>
    <div class="ni-grid two"><div class="ni-card"><p class="ni-eyebrow">Próxima ação</p><h2>Explore o cenário ativo</h2><div class="ni-actions"><a class="ni-button primary" href="#/network/scenarios/build" data-route="#/network/scenarios/build" data-testid="decision-run">Construir cenário</a><a class="ni-button secondary" href="#/network/optimizer/configure" data-route="#/network/optimizer/configure">Abrir mecanismo de avaliação</a></div></div>${card('Interpretação', '<p>Consulte fonte e cobertura antes de comparar resultados.</p>')}</div>`;
}

function baseFlows(state) {
  const flows = selectBaseline(state)?.flows;
  return Array.isArray(flows) ? flows.length : undefined;
}

export function renderOverviewNetwork(state) {
  const flows = Array.isArray(selectBaseline(state)?.flows) ? selectBaseline(state).flows : [];
  return `<div class="ni-page-heading" data-testid="page-overview-network"><p class="ni-eyebrow">Visão executiva · Malha</p><h1>Visão da rede</h1><p>Fluxos do baseline.</p></div>${sectionTabs('overview', state.ui.route)}<div class="ni-network-overview-grid"><div class="ni-card"><div class="ni-network-legend"><span><i class="origin"></i> origem</span><span><i class="cd"></i> CD</span><span><i class="destination"></i> destino</span></div>${flows.length ? renderNetworkSvg(flows) : emptyState('Nenhum fluxo carregado.')}</div>${renderBrazilMap(flows)}</div><div class="ni-card ni-overview-analytics" data-testid="network-flow-analytics"><h2>Fluxos de distribuição</h2><p class="ni-note">Os gráficos abaixo usam fluxos de distribuição com saída de um CD. Abastecimento entre fábrica e CD fica fora da contagem, do peso e da distância para evitar misturar etapas da rede.</p><div class="ni-grid two"><div class="ni-chart-tile"><canvas id="niFlowCountByCdChart" class="ni-chart" role="img" aria-label="Contagem de fluxos de distribuição por centro de distribuição" hidden></canvas><p class="ni-chart-summary" data-chart-summary="niFlowCountByCdChart">Fluxos por CD</p><details class="ni-chart-method"><summary>Dados e premissas</summary><p class="ni-note" data-chart-caption="niFlowCountByCdChart">Contagem de registros de distribuição associados a CD.</p></details></div><div class="ni-chart-tile"><canvas id="niVolumeByCdChart" class="ni-chart" role="img" aria-label="Peso em toneladas por centro de distribuição"></canvas><p class="ni-chart-summary" data-chart-summary="niVolumeByCdChart">Peso por CD · t</p><details class="ni-chart-method"><summary>Dados e premissas</summary><p class="ni-note" data-chart-caption="niVolumeByCdChart">Soma do peso explícito em kg por CD; exibida em toneladas. Fluxos sem peso não entram.</p></details></div><div class="ni-chart-tile"><canvas id="niDistanceHistogramChart" class="ni-chart" role="img" aria-label="Contagem de fluxos de distribuição por faixa de distância"></canvas><p class="ni-chart-summary" data-chart-summary="niDistanceHistogramChart">Fluxos por distância</p><details class="ni-chart-method"><summary>Dados e premissas</summary><p class="ni-note" data-chart-caption="niDistanceHistogramChart">Contagem de fluxos de distribuição com distância positiva informada.</p></details></div><div class="ni-chart-tile"><canvas id="niWeightDistanceChart" class="ni-chart" role="img" aria-label="Distribuição de peso conhecido por faixa de distância" hidden></canvas><p class="ni-chart-summary" data-chart-summary="niWeightDistanceChart">Peso · kg × km</p><details class="ni-chart-method"><summary>Dados e premissas</summary><p class="ni-note" data-chart-caption="niWeightDistanceChart">Cobertura de peso e distância dos fluxos elegíveis.</p></details></div><div class="ni-chart-tile"><canvas id="niOverviewCdCostChart" class="ni-chart" role="img" aria-label="Custo de distribuição por centro de distribuição" hidden></canvas><p class="ni-chart-summary" data-chart-summary="niOverviewCdCostChart">Custo por CD</p><details class="ni-chart-method"><summary>Dados e premissas</summary><p class="ni-note" data-chart-caption="niOverviewCdCostChart">Custo de distribuição modelado, quando há detalhe associado ao fluxo e ao CD.</p></details></div></div></div>`;
}

export function renderOverviewCosts(state) {
  const base = baselineResult(state).costs;
  return `<div class="ni-page-heading" data-testid="page-overview-costs"><p class="ni-eyebrow">Visão executiva · Custos</p><h1>Custos do baseline</h1><p>Composição registrada no baseline selecionado.</p></div>${sectionTabs('overview', state.ui.route)}<div class="ni-grid two"><div class="ni-card ni-chart-card"><h2>Composição</h2><canvas id="niOverviewCostCompositionChart" class="ni-chart" role="img" aria-label="Composição do custo logístico e tributos do baseline" hidden></canvas><p class="ni-chart-summary" data-chart-summary="niOverviewCostCompositionChart">Custos do baseline</p><details class="ni-chart-method"><summary>Dados e premissas</summary><p class="ni-note" data-chart-caption="niOverviewCostCompositionChart">Valores publicados no baseline ativo.</p></details></div><div class="ni-card ni-chart-card"><h2>Leitura</h2><div class="ni-kpi-stack">${kpi('Total logístico', formatBRL(base.total_logistics_cost, true))}${kpi('Tributos', formatBRL(base.tax_impact, true))}${kpi('Total', formatBRL(base.total_with_tax, true))}</div><canvas id="niOverviewCostComparisonChart" class="ni-chart" role="img" aria-label="Variação do custo do baseline para o cenário ativo" hidden></canvas><p class="ni-chart-summary" data-chart-summary="niOverviewCostComparisonChart">Variação com cenário calculado</p><details class="ni-chart-method"><summary>Dados e premissas</summary><p class="ni-note" data-chart-caption="niOverviewCostComparisonChart">Comparação disponível quando há custo calculado para o cenário.</p></details></div></div>`;
}

export function renderOverviewTax(state) {
  const baseline = selectBaseline(state);
  const activeCompany = selectActiveCompany(state);
  const baselineCompany =
    baseline?.company_id || baseline?.model?.company_id || baseline?.provenance?.company_id;
  const baselineMatchesCompany = Boolean(
    baseline && activeCompany && baselineCompany === activeCompany
  );
  const tax = baselineMatchesCompany ? baselineResult(state).tax : {};
  const coverage = tax.tax_coverage || {};
  const contract = tax.tax_period_contract || tax.metadata?.tax_period_contract || {};
  const selected =
    contract.selected_period && typeof contract.selected_period === 'object'
      ? contract.selected_period
      : {};
  const periods = Array.isArray(contract.available_periods) ? contract.available_periods : [];
  const reference =
    contract.current_reference_data_period &&
    typeof contract.current_reference_data_period === 'object'
      ? contract.current_reference_data_period
      : {};
  const observedCoverage =
    contract.observed_data_coverage && typeof contract.observed_data_coverage === 'object'
      ? contract.observed_data_coverage
      : {};
  const demonstration =
    state?.context?.provider_kind === 'mock' || activeCompany === 'empresa_mock';
  const sourceLabel = demonstration ? 'Demonstração · empresa fictícia' : 'Empresa ativa';
  const safeText = (value, fallback = '—') =>
    ['string', 'number'].includes(typeof value) && value !== '' ? String(value) : fallback;
  const safeStatus = (value) => userStatusLabel(safeText(value, null));
  const structuredPeriods = periods.filter(
    (period) => period && typeof period === 'object' && !Array.isArray(period)
  );
  const periodRows = structuredPeriods.map(
    (period) =>
      `<tr><td>${escapeHtml(safeText(period.year))}</td><td>${escapeHtml(humanizeCode(period.phase))}</td><td>${escapeHtml(safeStatus(period.data_status || period.source_status))}</td><td>${escapeHtml(formatFiscalWeight(period.current_tax_weight))}</td><td>${escapeHtml(formatFiscalWeight(period.reform_tax_weight))}</td></tr>`
  );
  const periodBody = structuredPeriods.length
    ? table(['Ano', 'Fase', 'Status', 'Peso atual', 'Peso reforma'], periodRows)
    : emptyState(
        periods.length
          ? 'Há períodos listados, mas a fonte não informa pesos e status em campos separados.'
          : 'Calendário fiscal indisponível no contrato da empresa ativa.'
      );
  const decisionUseLabels = {
    demo_only: 'Apenas demonstração',
    exploratory_only: 'Apenas exploratório',
    decision_support: 'Apoio à decisão',
    operational: 'Operacional',
  };
  const coverageRatio = coverage.complete_fiscal_coverage_ratio;
  const coverageValue = ['string', 'number'].includes(typeof coverageRatio)
    ? Number(coverageRatio)
    : null;
  const validCoverage =
    coverageValue != null &&
    Number.isFinite(coverageValue) &&
    coverageValue >= 0 &&
    coverageValue <= 1;
  const coverageNote = validCoverage
    ? 'Declarada no contrato fiscal'
    : 'Sem proporção válida publicada';
  const explanation = safeText(tax.explanation, 'Metadados fiscais indisponíveis.');
  const selectedPeriod =
    [safeText(selected.year, ''), safeText(selected.phase, '')].filter(Boolean).join(' · ') || '—';
  const ownershipMessage = !baseline
    ? 'Dados fiscais indisponíveis. Carregue o baseline da empresa ativa para consultar a cobertura.'
    : !activeCompany || !baselineCompany
      ? 'Não foi possível confirmar a empresa de origem destes dados fiscais. Recarregue o baseline ativo.'
      : !baselineMatchesCompany
        ? 'Os dados fiscais deste baseline não correspondem à empresa ativa. Recarregue os dados para consultar a cobertura correta.'
        : 'Pesos exibidos somente quando publicados no contrato fiscal.';
  return `<div class="ni-page-heading" data-testid="page-overview-tax"><p class="ni-eyebrow">Visão executiva · Tributação</p><h1>Cobertura fiscal</h1><p>Pesos publicados no contrato fiscal do baseline selecionado.</p></div>${sectionTabs('overview', state.ui.route)}<div class="ni-card ni-tax-source" data-testid="tax-source"><strong>${escapeHtml(sourceLabel)}</strong><span>${escapeHtml(ownershipMessage)}</span></div>${baselineMatchesCompany ? `<div class="ni-kpi-grid">${kpi('Cobertura fiscal completa', validCoverage ? formatPct(coverageValue * 100) : '—', coverageNote)}${kpi('Regime', humanizeCode(tax.tax_regime, { current: 'Atual', reform: 'Reforma' }))}${kpi('Uso permitido', humanizeCode(tax.decision_use, decisionUseLabels))}</div><div class="ni-card ni-chart-section ni-tax-chart"><div class="ni-tax-chart-heading"><div><h2>Pesos tributários por período</h2><p class="ni-note">Percentual dos pesos publicados para cada regime.</p></div><span>${escapeHtml(sourceLabel)}</span></div><canvas id="niOverviewTaxCoverageChart" class="ni-chart" role="img" aria-label="Pesos publicados do regime atual e da reforma por período" hidden></canvas><p class="ni-chart-summary" data-chart-summary="niOverviewTaxCoverageChart">Pesos fiscais publicados</p><details class="ni-chart-method"><summary>Como ler</summary><p class="ni-note" data-chart-caption="niOverviewTaxCoverageChart">Comparação publicada apenas para períodos com pesos explícitos.</p></details></div><div class="ni-grid two ni-tax-details"><details class="ni-card"><summary>Período e fonte</summary><dl class="ni-details"><div><dt>Período selecionado</dt><dd>${escapeHtml(selectedPeriod)}</dd></div><div><dt>Status</dt><dd>${escapeHtml(safeStatus(selected.data_status || selected.source_status))}</dd></div><div><dt>Referência atual</dt><dd>${escapeHtml(safeText(reference.period_start))} a ${escapeHtml(safeText(reference.period_end))}</dd></div><div><dt>Cobertura temporal</dt><dd>${escapeHtml(safeStatus(observedCoverage.status))}</dd></div></dl><p>${escapeHtml(explanation)}</p></details><details class="ni-card" data-testid="tax-periods-panel"><summary>Calendário fiscal · ${structuredPeriods.length} períodos</summary>${periodBody}</details></div>` : `<div class="ni-card">${emptyState(ownershipMessage)}</div>`}`;
}
