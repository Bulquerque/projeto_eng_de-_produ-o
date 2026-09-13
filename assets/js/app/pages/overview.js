import {
  card,
  emptyState,
  escapeHtml,
  formatBRL,
  formatNumber,
  formatPct,
  kpi,
  statusChip,
  table,
} from '../view-helpers.js';
import {
  selectActiveScenario,
  selectBaseline,
  selectDecision,
} from '../selectors/business-selectors.js';
import { renderNetworkSvg } from '../charts/charts.js';

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
  const decision = selectDecision(state);
  const selected = selectActiveScenario(state);
  const total = selected?.result?.total_with_tax ?? base.costs.total_with_tax;
  const evidence = decision.result?.evidence;
  return `<div class="ni-page-heading" data-testid="page-overview-summary"><p class="ni-eyebrow">Network Intelligence · Overview</p><h1>Visão executiva</h1><p>Baseline, cenário ativo e qualidade dos dados em uma única leitura.</p></div>
    <div class="ni-kpi-grid">${kpi('Empresa', state.context.company_id || '—', state.context.provider_kind === 'mock' ? 'demo_only' : 'provider project')}${kpi('CDs ativos', formatNumber(base.model.active_cds?.length), base.model.active_cds?.join(' · ') || '—')}${kpi('Total com tributo', formatBRL(total, true), selected ? 'cenário ativo' : 'baseline')}${kpi('Evidence', evidence?.evidence_score == null ? '—' : `${evidence.evidence_score}/100`, evidence?.evidence_status || 'aguardando cenário', 'evidence-score')}${kpi('Release', decision.release?.release_status || '—', decision.release?.warnings?.[0] || '')}</div>
    <div class="ni-grid two">${card('Baseline', `<dl class="ni-details"><div><dt>Cenário</dt><dd>${escapeHtml(base.model.scenario_id || '—')}</dd></div><div><dt>Fluxos</dt><dd>${formatNumber(baseFlows(state))}</dd></div><div><dt>Uso</dt><dd>${escapeHtml(base.tax.decision_use || 'decision_support')}</dd></div></dl>`, { eyebrow: 'Fase 2' })}${card('Decisão atual', selected ? `<p>${escapeHtml(selected.scenario_name || selected.scenario_id)}</p>${statusChip(decision.recommendation?.recommendation_status, decision.recommendation?.recommendation_status || 'calculando')}` : emptyState('Execute um cenário ou o otimizador para liberar a decisão.'), { eyebrow: 'Fases 3–5' })}</div>
    <div class="ni-grid two"><div class="ni-card"><p class="ni-eyebrow">Próxima ação</p><h2>Explore o cenário ativo</h2><div class="ni-actions"><a class="ni-button primary" href="#/network/scenarios/build" data-route="#/network/scenarios/build" data-testid="decision-run">Construir cenário</a><a class="ni-button secondary" href="#/network/optimizer/configure" data-route="#/network/optimizer/configure">Abrir otimizador</a></div></div>${card('Qualidade e limitações', `<ul class="ni-list"><li>Dados ausentes permanecem como <strong>—</strong>.</li><li>Monte Carlo é apresentado como incerteza exploratória.</li><li>Evidence, robustez e cobertura fiscal permanecem separados.</li></ul>`, { eyebrow: 'Contrato preservado' })}</div>`;
}

function baseFlows(state) {
  return selectBaseline(state)?.flows?.length || 0;
}

export function renderOverviewNetwork(state) {
  const flows = selectBaseline(state)?.flows || [];
  return `<div class="ni-page-heading" data-testid="page-overview-network"><p class="ni-eyebrow">Overview · Network</p><h1>Visão da rede</h1><p>Representação topológica resumida baseada nos fluxos carregados do baseline.</p></div><div class="ni-card"><div class="ni-network-legend"><span><i class="origin"></i> origem</span><span><i class="cd"></i> CD</span><span><i class="destination"></i> destino</span></div>${flows.length ? renderNetworkSvg(flows) : emptyState('Nenhum fluxo real carregado.')}</div><div class="ni-card"><h2>Escopo exibido</h2><p>${formatNumber(flows.length)} fluxo(s) carregado(s). A visualização é uma síntese; os detalhes auditáveis permanecem no bundle e no export.</p></div>`;
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
  return `<div class="ni-page-heading" data-testid="page-overview-costs"><p class="ni-eyebrow">Overview · Costs</p><h1>Custos do baseline</h1><p>Valores vindos do bundle carregado, sem recálculo na página.</p></div><div class="ni-grid two"><div class="ni-card"><h2>Decomposição</h2>${table(['Componente', 'Valor'], rows)}</div><div class="ni-card"><h2>Leitura</h2><div class="ni-kpi-stack">${kpi('Total logístico', formatBRL(base.total_logistics_cost))}${kpi('Tributos', formatBRL(base.tax_impact))}${kpi('Total', formatBRL(base.total_with_tax))}</div></div></div>`;
}

export function renderOverviewTax(state) {
  const tax = baselineResult(state).tax;
  const coverage = tax.tax_coverage || {};
  return `<div class="ni-page-heading" data-testid="page-overview-tax"><p class="ni-eyebrow">Overview · Tax</p><h1>Cobertura fiscal</h1><p>A interface preserva a classificação do motor fiscal e não completa períodos ausentes por hipótese.</p></div><div class="ni-kpi-grid">${kpi('Modo', tax.tax_mode || '—')}${kpi('Regime', tax.tax_regime || '—')}${kpi('Uso permitido', tax.decision_use || '—')}${kpi('Cobertura completa', coverage.complete_fiscal_coverage_ratio == null ? '—' : formatPct(coverage.complete_fiscal_coverage_ratio * 100))}</div><div class="ni-card"><h2>Fonte e limitações</h2><p>${escapeHtml(tax.explanation || 'Metadados fiscais do baseline não disponíveis.')}</p></div>`;
}
