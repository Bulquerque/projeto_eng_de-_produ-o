import {
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
} from '../selectors/business-selectors.js';
import { renderBrazilMap, renderNetworkSvg } from '../charts/charts.js';

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
  const selectedResult = selected?.result;
  const activeResult = decision.result;
  const hasTotal = (result) =>
    result &&
    Object.prototype.hasOwnProperty.call(result, 'total_with_tax') &&
    finiteMetric(result.total_with_tax) != null;
  if (!selected || selected.scenario_type === 'baseline') return baselineTotal;
  if (hasTotal(activeResult)) return activeResult.total_with_tax;
  if (hasTotal(selectedResult)) return selectedResult.total_with_tax;
  if (hasTotal(activeResult?.costs)) return activeResult.costs.total_with_tax;
  if (hasTotal(selectedResult?.costs?.costs)) return selectedResult.costs.costs.total_with_tax;
  if (hasTotal(selectedResult?.costs)) return selectedResult.costs.total_with_tax;
  return null;
}

function finiteMetric(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function moneyOrDash(value) {
  return finiteMetric(value) == null ? '—' : formatBRL(value, true);
}

function baselineResult(state) {
  const baseline = selectBaseline(state);
  return {
    costs: baseline?.costs?.costs || {},
    model: baseline?.model || {},
    tax: baseline?.tax_results?.tax_results || {},
  };
}

export function renderOverviewSummary(state) {
  const base = baselineResult(state);
  const selected = selectActiveScenario(state);
  const isBaseline = !selected || selected.scenario_type === 'baseline';
  const scenarioResult = state?.data?.scenario_result;
  const selectedResult = selected?.result;
  const activeCosts = isBaseline
    ? base.costs
    : scenarioResult?.costs || selectedResult?.costs?.costs || selectedResult?.costs || {};
  const total = selectedScenarioTotal(
    { result: scenarioResult },
    selected,
    base.costs.total_with_tax
  );
  const baselineTotal = base.costs.total_with_tax;
  const baselineAmount = finiteMetric(baselineTotal);
  const activeAmount = finiteMetric(total);
  const savings =
    baselineAmount != null && activeAmount != null ? baselineAmount - activeAmount : null;
  const flows = baseFlows(state);
  const activeName = selected?.scenario_name || base.model.scenario_id || 'Baseline';
  const logistics = activeCosts.total_logistics_cost;
  const tax = activeCosts.tax_impact;
  const origin = state?.context?.provider_kind === 'mock' ? 'Demonstração' : 'Empresa ativa';
  return `<div class="ni-page-heading" data-testid="page-overview-summary"><p class="ni-eyebrow">Visão executiva</p><h1>Visão executiva</h1><p>Custos e volume da operação no cenário selecionado.</p></div>${sectionTabs('overview', state.ui.route)}
    <div class="ni-card ni-overview-summary-strip" data-testid="overview-metrics"><div><span>CENÁRIO · ${escapeHtml(origin)}</span><strong>${escapeHtml(activeName)}</strong></div><div><span>TOTAL COM TRIBUTOS</span><strong>${moneyOrDash(total)}</strong></div><div><span>CUSTO LOGÍSTICO</span><strong>${moneyOrDash(logistics)}</strong></div><div><span>TRIBUTOS</span><strong>${moneyOrDash(tax)}</strong></div><div><span>ECONOMIA VS. BASELINE</span><strong>${savings == null ? '—' : moneyOrDash(savings)}</strong></div><div><span>FLUXOS NO BASELINE</span><strong>${formatNumber(flows)}</strong></div></div>
    <div class="ni-grid two"><div class="ni-chart-tile"><h2>Composição de custos</h2><canvas id="niOverviewCostCompositionChart" class="ni-chart" role="img" aria-label="Composição dos custos do baseline ativo" hidden></canvas><p class="ni-chart-summary" data-chart-summary="niOverviewCostCompositionChart">Composição no baseline</p><details class="ni-chart-method"><summary>Dados</summary><p class="ni-note" data-chart-caption="niOverviewCostCompositionChart">Valores publicados no baseline ativo.</p></details></div><div class="ni-chart-tile"><h2>Economia por componente</h2><canvas id="niOverviewCostComparisonChart" class="ni-chart" role="img" aria-label="Economia ou aumento de custo por componente" hidden></canvas><p class="ni-chart-summary" data-chart-summary="niOverviewCostComparisonChart">Baseline − cenário</p><details class="ni-chart-method"><summary>Dados</summary><p class="ni-note" data-chart-caption="niOverviewCostComparisonChart">Disponível quando baseline e cenário têm componentes comparáveis.</p></details></div><div class="ni-chart-tile"><h2>Fluxos por centro de distribuição</h2><canvas id="niFlowCountByCdChart" class="ni-chart" role="img" aria-label="Contagem de fluxos por centro de distribuição" hidden></canvas><p class="ni-chart-summary" data-chart-summary="niFlowCountByCdChart">Fluxos de distribuição por CD</p><details class="ni-chart-method"><summary>Dados</summary><p class="ni-note" data-chart-caption="niFlowCountByCdChart">Contagem de registros de distribuição associados a CD.</p></details></div></div>`;
}

function baseFlows(state) {
  const flows = selectBaseline(state)?.flows;
  return Array.isArray(flows) ? flows.length : undefined;
}

export function renderOverviewNetwork(state) {
  const flows = Array.isArray(selectBaseline(state)?.flows) ? selectBaseline(state).flows : [];
  return `<div class="ni-page-heading" data-testid="page-overview-network"><p class="ni-eyebrow">Visão executiva · Malha</p><h1>Visão da rede</h1><p>Fluxos do baseline.</p></div>${sectionTabs('overview', state.ui.route)}<div class="ni-network-overview-grid"><div class="ni-card"><div class="ni-network-legend"><span><i class="origin"></i> origem</span><span><i class="cd"></i> CD</span><span><i class="destination"></i> destino</span></div>${flows.length ? renderNetworkSvg(flows) : emptyState('Nenhum fluxo carregado.')}</div>${renderBrazilMap(flows)}</div><div class="ni-card ni-overview-analytics" data-testid="network-flow-analytics"><h2>Fluxos de distribuição</h2><p class="ni-note">Os gráficos abaixo usam fluxos de distribuição com saída de um CD. Abastecimento entre fábrica e CD fica fora da contagem, do peso e da distância para evitar misturar etapas da rede.</p><div class="ni-grid two"><div class="ni-chart-tile"><canvas id="niFlowCountByCdChart" class="ni-chart" role="img" aria-label="Contagem de fluxos de distribuição por centro de distribuição" hidden></canvas><p class="ni-chart-summary" data-chart-summary="niFlowCountByCdChart">Fluxos por CD</p><details class="ni-chart-method"><summary>Dados</summary><p class="ni-note" data-chart-caption="niFlowCountByCdChart">Contagem de registros de distribuição associados a CD.</p></details></div><div class="ni-chart-tile"><canvas id="niVolumeByCdChart" class="ni-chart" role="img" aria-label="Peso em toneladas por centro de distribuição"></canvas><p class="ni-chart-summary" data-chart-summary="niVolumeByCdChart">Peso por CD · t</p><details class="ni-chart-method"><summary>Dados</summary><p class="ni-note" data-chart-caption="niVolumeByCdChart">Soma do peso explícito em kg por CD; exibida em toneladas. Fluxos sem peso não entram.</p></details></div><div class="ni-chart-tile"><canvas id="niDistanceHistogramChart" class="ni-chart" role="img" aria-label="Contagem de fluxos de distribuição por faixa de distância"></canvas><p class="ni-chart-summary" data-chart-summary="niDistanceHistogramChart">Fluxos por distância</p><details class="ni-chart-method"><summary>Dados</summary><p class="ni-note" data-chart-caption="niDistanceHistogramChart">Contagem de fluxos de distribuição com distância positiva informada.</p></details></div><div class="ni-chart-tile"><canvas id="niWeightDistanceChart" class="ni-chart" role="img" aria-label="Distribuição de peso conhecido por faixa de distância" hidden></canvas><p class="ni-chart-summary" data-chart-summary="niWeightDistanceChart">Peso · kg × km</p><details class="ni-chart-method"><summary>Dados</summary><p class="ni-note" data-chart-caption="niWeightDistanceChart">Peso e distância registrados por fluxo.</p></details></div><div class="ni-chart-tile"><canvas id="niOverviewCdCostChart" class="ni-chart" role="img" aria-label="Custo de distribuição por centro de distribuição" hidden></canvas><p class="ni-chart-summary" data-chart-summary="niOverviewCdCostChart">Custo por CD</p><details class="ni-chart-method"><summary>Dados</summary><p class="ni-note" data-chart-caption="niOverviewCdCostChart">Custo de distribuição modelado, quando há detalhe associado ao fluxo e ao CD.</p></details></div></div></div>`;
}

export function renderOverviewCosts(state) {
  const base = baselineResult(state).costs;
  return `<div class="ni-page-heading" data-testid="page-overview-costs"><p class="ni-eyebrow">Visão executiva · Custos</p><h1>Custos do baseline</h1><p>Composição registrada no baseline selecionado.</p></div>${sectionTabs('overview', state.ui.route)}<div class="ni-grid two"><div class="ni-card ni-chart-card"><h2>Composição</h2><canvas id="niOverviewCostCompositionChart" class="ni-chart" role="img" aria-label="Composição do custo logístico e tributos do baseline" hidden></canvas><p class="ni-chart-summary" data-chart-summary="niOverviewCostCompositionChart">Custos do baseline</p><details class="ni-chart-method"><summary>Dados</summary><p class="ni-note" data-chart-caption="niOverviewCostCompositionChart">Valores publicados no baseline ativo.</p></details></div><div class="ni-card ni-chart-card"><h2>Leitura</h2><div class="ni-kpi-stack">${kpi('Total logístico', formatBRL(base.total_logistics_cost, true))}${kpi('Tributos', formatBRL(base.tax_impact, true))}${kpi('Total', formatBRL(base.total_with_tax, true))}</div><canvas id="niOverviewCostComparisonChart" class="ni-chart" role="img" aria-label="Variação do custo do baseline para o cenário ativo" hidden></canvas><p class="ni-chart-summary" data-chart-summary="niOverviewCostComparisonChart">Variação com cenário calculado</p><details class="ni-chart-method"><summary>Dados</summary><p class="ni-note" data-chart-caption="niOverviewCostComparisonChart">Comparação disponível quando há custo calculado para o cenário.</p></details></div></div>`;
}

export function renderOverviewTax(state) {
  const baseline = selectBaseline(state);
  const activeCompany = selectActiveCompany(state);
  const baselineCompany =
    baseline?.company_id || baseline?.model?.company_id || baseline?.provenance?.company_id;
  const baselineMatchesCompany = Boolean(
    baseline && activeCompany && baselineCompany === activeCompany
  );
  const selected = selectActiveScenario(state);
  const scenarioResult = state?.data?.scenario_result || selected?.result || null;
  const scenarioMatchesCompany =
    (!selected?.company_id || selected.company_id === activeCompany) &&
    (!scenarioResult?.company_id || scenarioResult.company_id === activeCompany);
  const hasScenarioTax = Boolean(
    baselineMatchesCompany &&
    scenarioMatchesCompany &&
    selected &&
    selected.scenario_type !== 'baseline' &&
    scenarioResult
  );
  const scenarioTax = scenarioResult?.tax_results?.tax_results || scenarioResult?.tax_results || {};
  const scenarioCosts = scenarioResult?.costs?.costs || scenarioResult?.costs || {};
  const tax = hasScenarioTax
    ? scenarioTax
    : baselineMatchesCompany
      ? baselineResult(state).tax
      : {};
  const taxImpact = hasScenarioTax
    ? (finiteMetric(scenarioCosts.tax_impact) ??
      finiteMetric(tax.tax_impact) ??
      finiteMetric(tax.total_tax_impact))
    : (finiteMetric(baselineResult(state).costs.tax_impact) ??
      finiteMetric(tax.tax_impact) ??
      finiteMetric(tax.total_tax_impact));
  // The transition calendar is a property of the active baseline contract;
  // scenario results carry the selected regime and impact, but may not repeat
  // the full published period table.
  const baselineTax = baselineResult(state).tax;
  const contract =
    baselineTax.tax_period_contract ||
    baselineTax.metadata?.tax_period_contract ||
    tax.tax_period_contract ||
    tax.metadata?.tax_period_contract ||
    {};
  const periods = Array.isArray(contract.available_periods) ? contract.available_periods : [];
  const demonstration =
    state?.context?.provider_kind === 'mock' || activeCompany === 'empresa_mock';
  const sourceLabel = demonstration ? 'Demonstração · empresa fictícia' : 'Empresa ativa';
  const safeText = (value, fallback = '—') =>
    ['string', 'number'].includes(typeof value) && value !== '' ? String(value) : fallback;
  const structuredPeriods = periods.filter(
    (period) => period && typeof period === 'object' && !Array.isArray(period)
  );
  const periodRows = structuredPeriods.map(
    (period) =>
      `<tr><td>${escapeHtml(safeText(period.year))}</td><td>${escapeHtml(humanizeCode(period.phase))}</td><td>${escapeHtml(formatFiscalWeight(period.current_tax_weight))}</td><td>${escapeHtml(formatFiscalWeight(period.reform_tax_weight))}</td></tr>`
  );
  const periodBody = structuredPeriods.length
    ? table(['Ano', 'Fase', 'Peso atual', 'Peso reforma'], periodRows)
    : emptyState(
        periods.length
          ? 'Há períodos listados, mas não há pesos publicados para comparação.'
          : 'Calendário fiscal indisponível no contrato da empresa ativa.'
      );
  const ownershipMessage = !baseline
    ? 'Dados tributários indisponíveis. Carregue o baseline da empresa ativa.'
    : !activeCompany || !baselineCompany
      ? 'Não foi possível confirmar a empresa de origem destes dados fiscais. Recarregue o baseline ativo.'
      : !baselineMatchesCompany
        ? 'Os dados fiscais deste baseline não correspondem à empresa ativa. Recarregue os dados para consultar os valores corretos.'
        : 'Pesos exibidos somente quando publicados no contrato fiscal.';
  const activeYear = Number(selected?.changes?.tax_year);
  const taxContext = hasScenarioTax
    ? `Cenário ativo${Number.isInteger(activeYear) ? ` · ano fiscal ${activeYear}` : ''}`
    : 'Baseline da empresa ativa';
  const pageDescription = hasScenarioTax
    ? 'Impacto tributário do cenário ativo e pesos publicados no contrato fiscal.'
    : 'Impacto tributário e pesos publicados no contrato fiscal do baseline.';
  const regimeValue =
    {
      current: 'Atual',
      reform_2026: 'Ano-teste 2026',
      reform_2027_2028: 'CBS 2027–2028',
      transition_2029: 'Transição 2029',
      transition_2030: 'Transição 2030',
      transition_2031: 'Transição 2031',
      transition_2032: 'Transição 2032',
      reform_full_2033: 'Reforma integral 2033',
    }[tax.tax_regime || selected?.changes?.tax_regime] ||
    tax.regime_label ||
    tax.tax_regime_label ||
    selected?.changes?.tax_regime_label ||
    humanizeCode(tax.tax_regime || selected?.changes?.tax_regime);
  return `<div class="ni-page-heading" data-testid="page-overview-tax"><p class="ni-eyebrow">Visão executiva · Tributação</p><h1>Tributos</h1><p>${pageDescription}</p></div>${sectionTabs('overview', state.ui.route)}<div class="ni-card ni-tax-source" data-testid="tax-source"><strong>${escapeHtml(sourceLabel)}</strong><span>${escapeHtml(ownershipMessage)}</span></div>${baselineMatchesCompany ? `<div class="ni-kpi-grid">${kpi('Impacto tributário registrado', moneyOrDash(taxImpact), taxContext)}${kpi('Regime', regimeValue)}</div><div class="ni-card ni-chart-section ni-tax-chart"><h2>Impacto tributário</h2><canvas id="niOverviewTaxImpactChart" class="ni-chart" role="img" aria-label="Impacto tributário registrado no baseline e cenário ativo" hidden></canvas><p class="ni-chart-summary" data-chart-summary="niOverviewTaxImpactChart">Baseline e cenário ativo, quando disponível</p><details class="ni-chart-method"><summary>Dados</summary><p class="ni-note" data-chart-caption="niOverviewTaxImpactChart">Valores tributários publicados no baseline e no resultado do cenário.</p></details></div><div class="ni-card ni-chart-section ni-tax-chart"><div class="ni-tax-chart-heading"><div><h2>Pesos tributários por período</h2><p class="ni-note">Percentual dos pesos publicados para cada regime.</p></div><span>${escapeHtml(sourceLabel)}</span></div><canvas id="niOverviewTaxCoverageChart" class="ni-chart" role="img" aria-label="Pesos publicados do regime atual e da reforma por período" hidden></canvas><p class="ni-chart-summary" data-chart-summary="niOverviewTaxCoverageChart">Pesos fiscais publicados</p><details class="ni-chart-method"><summary>Como ler</summary><p class="ni-note" data-chart-caption="niOverviewTaxCoverageChart">Comparação publicada apenas para períodos com pesos explícitos.</p></details></div><details class="ni-card" data-testid="tax-periods-panel"><summary>Calendário fiscal · ${structuredPeriods.length} períodos</summary>${periodBody}</details>` : `<div class="ni-card">${emptyState(ownershipMessage)}</div>`}`;
}
