import {
  emptyState,
  escapeHtml,
  formatBRL,
  formatNumber,
  formatPct,
  kpi,
  sectionTabs,
  table,
  businessLabel,
} from '../view-helpers.js';
import { selectBaseline } from '../selectors/business-selectors.js';
import { renderBrazilMap, renderNetworkSvg } from '../charts/charts.js';

function baselineParts(state) {
  const baseline = selectBaseline(state);
  return {
    baseline,
    model: baseline?.model || {},
    costs: baseline?.costs?.costs || {},
    tax: baseline?.tax_results?.tax_results || {},
    flows: baseline?.flows || [],
  };
}

function page(title, testId, body, state) {
  return `<section class="ni-workspace ni-workspace-page ni-overview" data-testid="${testId}"><header class="ni-page-heading"><h1>${title}</h1></header>${sectionTabs('overview', state.ui?.route)}${body}</section>`;
}

function referenceContext(state) {
  const draft = state.ui?.scenario_draft;
  if (!draft)
    return '<p class="ni-reference-context" data-testid="reference-context">Valores da base de referência · 2025</p>';
  const taxYear = Number(draft.changes?.tax_year);
  const target =
    taxYear >= 2026 && taxYear <= 2033
      ? `Ano tributário ${taxYear}`
      : draft.scenario_name || 'cenário selecionado';
  return `<p class="ni-reference-context" data-testid="reference-context">Referência exibida: 2025. ${escapeHtml(target)} aberto para edição; veja o resultado após executar.</p>`;
}

export function renderOverviewSummary(state) {
  const { model, costs, tax, flows } = baselineParts(state);
  const activeCds = Array.isArray(model.active_cds) ? model.active_cds : [];
  const total = costs.total_with_tax;
  const isDemo = state.context?.provider_kind === 'mock';
  const taxUnavailable = isDemo && tax.tax_coverage?.eligible_flow_count === 0;
  const metrics = `${referenceContext(state)}<div class="ni-workspace-kpis ni-results-metrics ni-overview-summary-metrics">${kpi(taxUnavailable ? 'Custo logístico de referência' : 'Custo total de referência', total == null ? '—' : formatBRL(total, true), '', 'baseline-total')}${kpi('CDs ativos', activeCds.length ? formatNumber(activeCds.length) : '—')}${kpi('Fluxos mapeados', flows.length ? formatNumber(flows.length) : '—')}</div>`;
  const costsSummary = `<section class="ni-workspace-panel"><h2>Composição do custo</h2><canvas id="niSummaryCostChart" class="ni-chart" role="img" aria-label="Gráfico da composição do custo de referência"></canvas>${costTable(costs, taxUnavailable)}</section>`;
  const taxCoverage = isDemo
    ? taxUnavailable
      ? 'Sem base fiscal elegível'
      : `${formatNumber(tax.tax_coverage?.eligible_flow_count || 0)} fluxos · base sintética`
    : tax.tax_coverage?.complete_fiscal_coverage_ratio == null
      ? '—'
      : formatPct(tax.tax_coverage.complete_fiscal_coverage_ratio * 100);
  const taxSummary = `<section class="ni-workspace-panel"><h2>Contexto tributário</h2><dl class="ni-workspace-scope-list ni-tax-summary-list"><div><dt>Regime</dt><dd>${escapeHtml(businessLabel(tax.tax_regime))}</dd></div><div><dt>Modo de cálculo</dt><dd>${escapeHtml(businessLabel(tax.tax_mode))}</dd></div><div><dt>Cobertura fiscal</dt><dd>${escapeHtml(taxCoverage)}</dd></div></dl><a class="ni-button secondary" href="#/network/overview/tax" data-route="#/network/overview/tax">Ver contexto tributário</a></section>`;
  const body = `${metrics}<div class="ni-workspace-grid ni-overview-summary-grid">${costsSummary}${taxSummary}</div><div class="ni-actions"><a class="ni-button primary" href="#/network/scenarios/build" data-route="#/network/scenarios/build">Criar simulação</a></div>`;
  return page('Visão geral', 'page-overview-summary', body, state);
}

function costTable(costs, taxUnavailable = false) {
  const labels = [
    ['transfer_cost', 'Transferência'],
    ['distribution_cost', 'Distribuição'],
    ['storage_cost', 'Armazenagem'],
    ['inventory_cost', 'Estoque'],
    ['tax_impact', 'Tributos'],
    ['total_with_tax', taxUnavailable ? 'Total logístico' : 'Total com tributos'],
  ];
  const rows = labels.map(
    ([key, label]) =>
      `<tr><th scope="row">${label}</th><td>${costs[key] == null || (taxUnavailable && key === 'tax_impact') ? '—' : escapeHtml(formatBRL(costs[key]))}</td></tr>`
  );
  return table(['Componente', 'Valor'], rows, 'Custos de referência indisponíveis.');
}

export function renderOverviewNetwork(state) {
  const { flows } = baselineParts(state);
  const map = flows.length
    ? `<div class="ni-network-overview-grid"><div class="ni-workspace-panel"><div class="ni-network-legend"><span><i class="origin"></i>Origem</span><span><i class="cd"></i>Centro de distribuição</span><span><i class="destination"></i>Destino</span></div>${renderNetworkSvg(flows)}</div>${renderBrazilMap(flows)}</div>`
    : emptyState('A rede de referência não está disponível.');
  const hasVolume = flows.some(
    (flow) => Number(flow.annual_weight_kg ?? flow.weight_kg ?? flow.volume ?? 0) > 0
  );
  const hasDistance = flows.some((flow) => Number(flow.distance_km ?? flow.distance ?? 0) > 0);
  const analytics = `<details class="ni-workspace-secondary-analytics" data-testid="network-flow-analytics"><summary>Análise dos fluxos</summary><div class="ni-workspace-grid"><section class="ni-workspace-panel"><h2>Volume por centro de distribuição</h2><canvas id="niVolumeByCdChart" class="ni-chart" role="img" aria-label="Volume por centro de distribuição"></canvas>${hasVolume ? '' : '<p class="ni-note">Volume indisponível na referência.</p>'}</section><section class="ni-workspace-panel"><h2>Distância dos fluxos</h2><canvas id="niDistanceHistogramChart" class="ni-chart" role="img" aria-label="Distribuição das distâncias dos fluxos"></canvas>${hasDistance ? '' : '<p class="ni-note">Distância indisponível na referência.</p>'}</section></div></details>`;
  const body = `${map}<div class="ni-workspace-kpis">${kpi('Fluxos', flows.length ? formatNumber(flows.length) : '—')}${kpi('Origens', uniqueCount(flows, 'origin'))}${kpi('Destinos', uniqueCount(flows, 'destination'))}${kpi('Centros de distribuição', uniqueCount(flows, 'cd'))}</div>${analytics}`;
  return page('Rede de referência', 'page-overview-network', body, state);
}

function uniqueCount(rows, key) {
  const unique = new Set(rows.map((row) => row?.[key]).filter(Boolean));
  return unique.size ? formatNumber(unique.size) : '—';
}

export function renderOverviewCosts(state) {
  const { costs, tax, flows } = baselineParts(state);
  const unavailable =
    state.context.provider_kind === 'mock' && tax.tax_coverage?.eligible_flow_count === 0;
  const hasVolume = flows.some(
    (flow) => Number(flow.annual_weight_kg ?? flow.weight_kg ?? flow.volume ?? 0) > 0
  );
  const hasDistance = flows.some((flow) => Number(flow.distance_km ?? flow.distance ?? 0) > 0);
  const analytics = `<div class="ni-workspace-grid ni-cost-logistics-charts"><section class="ni-workspace-panel"><h2>Volume por centro de distribuição</h2><canvas id="niCostVolumeByCdChart" class="ni-chart" role="img" aria-label="Volume anual distribuído por centro de distribuição"></canvas>${hasVolume ? '' : '<p class="ni-note">Volume indisponível na referência.</p>'}</section><section class="ni-workspace-panel"><h2>Distância dos fluxos</h2><canvas id="niCostDistanceHistogramChart" class="ni-chart" role="img" aria-label="Distribuição das distâncias dos fluxos de referência"></canvas>${hasDistance ? '' : '<p class="ni-note">Distâncias indisponíveis na referência.</p>'}</section></div>`;
  const body = `${referenceContext(state)}<section class="ni-workspace-panel"><h2>Composição do custo</h2><canvas id="niCostChart" class="ni-chart" role="img" aria-label="Gráfico da composição dos custos de referência"></canvas>${costTable(costs, unavailable)}</section>${analytics}`;
  return page('Custos de referência', 'page-overview-costs', body, state);
}

export function renderOverviewTax(state) {
  const { tax } = baselineParts(state);
  const coverage = tax.tax_coverage || {};
  const contract = tax.tax_period_contract || tax.metadata?.tax_period_contract || {};
  const selected = contract.selected_period || {};
  const isDemo = state.context?.provider_kind === 'mock';
  const rows = (contract.available_periods || []).map(
    (period) =>
      `<tr><td>${escapeHtml(period.year ?? '—')}</td><td>${escapeHtml(businessLabel(period.phase))}</td><td>${escapeHtml(businessLabel(period.data_status || period.source_status))}</td><td>${period.current_tax_weight == null ? '—' : escapeHtml(formatPct(period.current_tax_weight * 100))}</td><td>${period.reform_tax_weight == null ? '—' : escapeHtml(formatPct(period.reform_tax_weight * 100))}</td></tr>`
  );
  const periodRows = table(
    ['Ano', 'Fase', 'Estado', 'Peso atual', 'Peso da reforma'],
    rows,
    'Calendário tributário indisponível.'
  );
  const coverageValue = isDemo
    ? coverage.eligible_flow_count === 0
      ? 'Sem estimativa tributária'
      : `Estimativa · ${formatBRL(baselineParts(state).costs.tax_impact, true)}`
    : coverage.complete_fiscal_coverage_ratio == null
      ? '—'
      : formatPct(coverage.complete_fiscal_coverage_ratio * 100);
  const fiscalNote =
    isDemo && coverage.eligible_flow_count > 0
      ? '<p class="ni-note">Receitas e categorias são sintéticas. Sem NCM, CFOP e CST, o resultado é demonstrativo e não representa apuração fiscal.</p>'
      : '';
  const referenceYear =
    selected.year == null
      ? '2025 · Base atual'
      : `${selected.year} · ${businessLabel(selected.phase)}`;
  const details = `${referenceContext(state)}<div class="ni-workspace-kpis ni-tax-overview-metrics">${kpi('Regime da referência', businessLabel(tax.tax_regime))}${kpi('Cálculo da referência', businessLabel(tax.tax_mode))}${kpi(isDemo ? 'Tributos estimados' : 'Cobertura fiscal', coverageValue)}</div><dl class="ni-workspace-scope-list"><div><dt>Ano da referência</dt><dd>${escapeHtml(referenceYear)}</dd></div><div><dt>Dados observados</dt><dd>${escapeHtml(isDemo ? 'Demonstração' : businessLabel(contract.observed_data_coverage?.status))}</dd></div></dl>${fiscalNote}<details class="ni-workspace-secondary-analytics" data-testid="tax-periods-panel"><summary>Calendário tributário</summary>${isDemo ? '<p>Períodos demonstrativos sem histórico observado.</p>' : periodRows}</details>`;
  return page(
    'Tributário',
    'page-overview-tax',
    `<section class="ni-workspace-panel">${details}</section>`,
    state
  );
}
