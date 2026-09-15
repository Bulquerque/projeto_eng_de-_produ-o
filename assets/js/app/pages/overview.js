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
  selectActiveScenario,
  selectBaseline,
  selectDecision,
} from '../selectors/business-selectors.js';
import { renderBrazilMap, renderNetworkSvg } from '../charts/charts.js';

function baselineResult(state) {
  const baseline = selectBaseline(state);
  return {
    costs: baseline?.costs?.costs || {},
    model: baseline?.model || {},
    tax: baseline?.tax_results?.tax_results || {},
  };
}

function formatRecommendationStatus(status) {
  return (
    {
      recommended_with_warnings: 'Recomendado com ressalvas',
      recommended: 'Recomendado',
      not_recommended: 'Não recomendado',
      baseline_ready: 'Baseline carregado',
    }[status] ||
    status ||
    'Baseline carregado'
  );
}

export function renderOverviewSummary(state) {
  const base = baselineResult(state);
  const decision = selectDecision(state);
  const selected = selectActiveScenario(state);
  const total = selected?.result?.total_with_tax ?? base.costs.total_with_tax;
  const evidence = decision.result?.evidence;
  const quality = decision.quality || selected?.quality || decision.result?.quality || {};
  const monteCarlo = decision.risk?.monte_carlo?.summary || {};
  const probabilitySaving = monteCarlo.probability_saving_positive;
  const robustness = decision.risk?.robustness?.robustness_score;
  const recommendation = decision.recommendation;
  const summaryTitle =
    recommendation?.executive_summary ||
    'Baseline, cenário ativo e qualidade dos dados em uma única leitura.';
  const summaryStatus = formatRecommendationStatus(recommendation?.recommendation_status);
  const summaryReasons = recommendation?.main_reasons?.length
    ? recommendation.main_reasons
    : [
        'O baseline está disponível para exploração.',
        'Os cálculos continuam no engine do projeto.',
        'Dados ausentes permanecem explicitamente identificados.',
      ];
  return `<div class="ni-page-heading" data-testid="page-overview-summary"><p class="ni-eyebrow">Network Intelligence · Overview</p><h1>Visão executiva</h1><p>O workspace começa pela recomendação e mantém os detalhes técnicos acessíveis por seção.</p></div>${sectionTabs('overview', state.ui.route)}
    <section class="ni-hero-card" data-testid="overview-recommendation"><div><p class="ni-eyebrow">Recomendação atual</p><h2>${escapeHtml(summaryStatus)}</h2><p>${escapeHtml(summaryTitle)}</p><div class="ni-actions"><a class="ni-button primary" href="#/network/scenarios/build" data-route="#/network/scenarios/build">Abrir cenário</a><a class="ni-button secondary" href="#/network/optimizer/configure" data-route="#/network/optimizer/configure">Executar análise</a></div></div><div class="ni-hero-aside"><span>CENÁRIO ATIVO</span><strong>${escapeHtml(selected?.scenario_name || base.model.scenario_id || 'Baseline')}</strong><span>${formatBRL(total, true)} · ${state.context.provider_kind === 'mock' ? 'fixture demonstrativa' : 'provider real protegido'}</span></div></section>
    <div class="ni-kpi-grid">${kpi('P(saving > 0)', probabilitySaving == null ? '—' : formatPct(probabilitySaving * 100), 'probabilidade condicional de saving')}${kpi('Robustez', robustness == null ? '—' : `${robustness}/100`, 'stress + Monte Carlo + evidência')}${kpi('Evidence', evidence?.evidence_score == null ? '—' : `${evidence.evidence_score}/100`, evidence?.evidence_status || 'aguardando cenário', 'evidence-score')}${kpi('Risco', quality.risk_level || '—', selected ? 'qualidade operacional' : 'aguardando cenário')}</div>
    <div class="ni-grid two">${card(recommendation ? 'Por que recomendamos?' : 'Por que esta leitura?', `<ul class="ni-list">${summaryReasons.map((reason) => `<li>✓ ${escapeHtml(reason)}</li>`).join('')}</ul>`, { eyebrow: 'Pipeline de decisão' })}${card('Baseline', `<dl class="ni-details"><div><dt>Cenário</dt><dd>${escapeHtml(base.model.scenario_id || '—')}</dd></div><div><dt>Fluxos</dt><dd>${formatNumber(baseFlows(state))}</dd></div><div><dt>Uso</dt><dd>${escapeHtml(base.tax.decision_use || 'decision_support')}</dd></div></dl>`, { eyebrow: 'Fase 2' })}</div>
    <div class="ni-grid two"><div class="ni-card"><p class="ni-eyebrow">Próxima ação</p><h2>Explore o cenário ativo</h2><div class="ni-actions"><a class="ni-button primary" href="#/network/scenarios/build" data-route="#/network/scenarios/build" data-testid="decision-run">Construir cenário</a><a class="ni-button secondary" href="#/network/optimizer/configure" data-route="#/network/optimizer/configure">Abrir otimizador</a></div></div>${card('Pontos de atenção', `<ul class="ni-list"><li>Dados ausentes permanecem como <strong>—</strong>.</li><li>Monte Carlo é apresentado como incerteza exploratória.</li><li>Evidence, robustez e cobertura fiscal permanecem separados.</li><li>Status atual: <strong>${escapeHtml(summaryStatus)}</strong>.</li></ul>`, { eyebrow: 'Contrato preservado' })}</div>`;
}

function baseFlows(state) {
  return selectBaseline(state)?.flows?.length || 0;
}

export function renderOverviewNetwork(state) {
  const flows = selectBaseline(state)?.flows || [];
  return `<div class="ni-page-heading" data-testid="page-overview-network"><p class="ni-eyebrow">Overview · Network</p><h1>Visão da rede</h1><p>Representação topológica e geográfica resumida baseada nos fluxos carregados do baseline.</p></div>${sectionTabs('overview', state.ui.route)}<div class="ni-network-overview-grid"><div class="ni-card"><div class="ni-network-legend"><span><i class="origin"></i> origem</span><span><i class="cd"></i> CD</span><span><i class="destination"></i> destino</span></div>${flows.length ? renderNetworkSvg(flows) : emptyState('Nenhum fluxo real carregado.')}</div>${renderBrazilMap(flows)}</div><div class="ni-card" data-testid="network-flow-analytics"><h2>Analítica dos fluxos</h2><p>Os gráficos preservam a leitura da interface principal e só são exibidos quando o provider fornece a métrica correspondente.</p><div class="ni-grid two"><div><canvas id="niVolumeByCdChart" class="ni-chart" role="img" aria-label="Volume por centro de distribuição"></canvas>${flows.some((flow) => Number(flow.annual_weight_kg ?? flow.weight_kg ?? flow.volume ?? 0) > 0) ? '' : '<p class="ni-note">Volume não informado no recorte atual.</p>'}</div><div><canvas id="niDistanceHistogramChart" class="ni-chart" role="img" aria-label="Histograma de distâncias dos fluxos"></canvas>${flows.some((flow) => Number(flow.distance_km ?? flow.distance ?? 0) > 0) ? '' : '<p class="ni-note">Distância não informada no recorte atual.</p>'}</div></div></div><div class="ni-card"><h2>Escopo exibido</h2><p>${formatNumber(flows.length)} fluxo(s) carregado(s). A visualização é uma síntese; os detalhes auditáveis permanecem no bundle e no export.</p></div>`;
}

export function renderOverviewCosts(state) {
  const base = baselineResult(state).costs;
  const rows = [
    ['Transferência', formatBRL(base.transfer_cost)],
    ['Distribuição', formatBRL(base.distribution_cost)],
    ['Armazenagem', formatBRL(base.storage_cost)],
    ['Estoque', formatBRL(base.inventory_cost)],
    ['Tributos', formatBRL(base.tax_impact)],
    ['Total com tributo', formatBRL(base.total_with_tax)],
  ].map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`);
  return `<div class="ni-page-heading" data-testid="page-overview-costs"><p class="ni-eyebrow">Overview · Costs</p><h1>Custos do baseline</h1><p>Valores vindos do bundle carregado, sem recálculo na página.</p></div>${sectionTabs('overview', state.ui.route)}<div class="ni-grid two"><div class="ni-card"><h2>Decomposição</h2>${table(['Componente', 'Valor'], rows)}</div><div class="ni-card"><h2>Leitura</h2><div class="ni-kpi-stack">${kpi('Total logístico', formatBRL(base.total_logistics_cost))}${kpi('Tributos', formatBRL(base.tax_impact))}${kpi('Total', formatBRL(base.total_with_tax))}</div></div></div>`;
}

export function renderOverviewTax(state) {
  const tax = baselineResult(state).tax;
  const coverage = tax.tax_coverage || {};
  const contract = tax.tax_period_contract || tax.metadata?.tax_period_contract || {};
  const selected = contract.selected_period || {};
  const periods = contract.available_periods || [];
  const reference = contract.current_reference_data_period || {};
  const periodRows = periods.map(
    (period) =>
      `<tr><td>${escapeHtml(period.year ?? '—')}</td><td>${escapeHtml(period.phase || '—')}</td><td>${escapeHtml(period.data_status || period.source_status || '—')}</td><td>${escapeHtml(period.current_tax_weight == null ? '—' : formatPct(period.current_tax_weight * 100))}</td><td>${escapeHtml(period.reform_tax_weight == null ? '—' : formatPct(period.reform_tax_weight * 100))}</td></tr>`
  );
  const periodBody = periods.length
    ? table(['Ano', 'Fase', 'Status', 'Peso atual', 'Peso reforma'], periodRows)
    : emptyState('Cronograma fiscal não disponível no bundle atual.');
  return `<div class="ni-page-heading" data-testid="page-overview-tax"><p class="ni-eyebrow">Overview · Tax</p><h1>Cobertura fiscal</h1><p>A interface preserva a classificação do motor fiscal e não completa períodos ausentes por hipótese.</p></div>${sectionTabs('overview', state.ui.route)}<div class="ni-kpi-grid">${kpi('Modo', tax.tax_mode || '—')}${kpi('Regime', tax.tax_regime || '—')}${kpi('Uso permitido', tax.decision_use || '—')}${kpi('Cobertura completa', coverage.complete_fiscal_coverage_ratio == null ? '—' : formatPct(coverage.complete_fiscal_coverage_ratio * 100))}</div><div class="ni-grid two"><div class="ni-card"><h2>Período selecionado</h2><dl class="ni-details"><div><dt>Ano/fase</dt><dd>${escapeHtml(selected.year == null ? '—' : `${selected.year} · ${selected.phase || '—'}`)}</dd></div><div><dt>Status</dt><dd>${escapeHtml(selected.source_status || '—')}</dd></div><div><dt>Referência atual</dt><dd>${escapeHtml(reference.period_start || '—')} a ${escapeHtml(reference.period_end || 'aberto')}</dd></div><div><dt>Uso temporal</dt><dd>${escapeHtml(contract.observed_data_coverage?.status || '—')}</dd></div></dl></div><div class="ni-card"><h2>Fonte e limitações</h2><p>${escapeHtml(tax.explanation || 'Metadados fiscais do baseline não disponíveis.')}</p><p class="ni-note">Identificadores e caminhos protegidos permanecem fora da interface pública.</p></div></div><div class="ni-card" data-testid="tax-periods-panel"><h2>Calendário de transição</h2>${periodBody}</div>`;
}
