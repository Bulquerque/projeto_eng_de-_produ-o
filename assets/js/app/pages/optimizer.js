import { selectDecision } from '../selectors/business-selectors.js';
import {
  card,
  emptyState,
  escapeHtml,
  formatBRL,
  formatNumber,
  formatPct,
  kpi,
  table,
} from '../view-helpers.js';

export function renderOptimizerConfigure(state) {
  return `<div class="ni-page-heading" data-testid="page-optimizer-configure"><p class="ni-eyebrow">Optimizer · Configure</p><h1>Configurar busca</h1><p>Os parâmetros serão encaminhados ao optimizer discreto existente.</p></div><form id="niOptimizerForm" class="ni-card ni-form" data-testid="optimizer-form"><label>Perfil<select name="profile_id"><option value="balanced">Balanceado</option><option value="cfo">CFO</option><option value="supply">Supply</option><option value="fiscal">Fiscal</option><option value="conservative">Conservador</option></select></label><div class="ni-form-grid"><label>Máximo de candidatos<input name="max_candidates" type="number" min="100" max="10000" step="100" value="2000"></label><label>Seed<input name="seed" type="number" step="1" value="42"></label></div><p class="ni-note">A busca só será chamada de global quando o engine retornar <code>exact_search_space=true</code>.</p><button type="submit" class="ni-button primary" data-testid="optimizer-run">Rodar busca</button></form><div class="ni-card"><h2>Baseline usado</h2><p>${escapeHtml(state.data.baseline?.model?.scenario_id || '—')} · ${formatNumber(state.data.baseline?.model?.active_cds?.length || 0)} CD(s) ativo(s)</p></div>`;
}

export function renderOptimizerResults(state) {
  const optimizer = selectDecision(state).optimizer;
  if (!optimizer)
    return `<div class="ni-page-heading" data-testid="page-optimizer-results"><h1>Resultados do otimizador</h1></div>${emptyState('Execute uma busca antes de abrir os resultados.')}`;
  const log = optimizer.search_log || {};
  const rows = (optimizer.best_scenarios || []).map(
    (row) =>
      `<tr><td>${escapeHtml(row.scenario_id)}</td><td>${escapeHtml(formatBRL(row.result?.total_with_tax))}</td><td>${escapeHtml(formatNumber(row.final_score, 2))}</td><td>${escapeHtml(row.quality?.risk_level || '—')}</td></tr>`
  );
  return `<div class="ni-page-heading" data-testid="page-optimizer-results"><p class="ni-eyebrow">Optimizer · Results</p><h1>Ranking de cenários</h1><p>${escapeHtml(optimizer.result_scope || '—')}</p></div><div class="ni-kpi-grid">${kpi('Status', optimizer.optimizer_status || '—')}${kpi('Cobertura', log.coverage_ratio == null ? '—' : formatPct(log.coverage_ratio * 100))}${kpi('Busca exata', log.exact_search_space ? 'sim' : 'não')}${kpi('Candidatos', formatNumber(log.simulated_candidates))}</div><div class="ni-grid two"><div class="ni-card"><canvas id="niRankingChart" class="ni-chart" role="img" aria-label="Ranking dos cenários"></canvas></div><div class="ni-card" data-testid="optimizer-ranking">${table(['Cenário', 'Total', 'Score', 'Risco'], rows, 'Nenhum cenário elegível.')}</div></div><div class="ni-actions"><a class="ni-button secondary" href="#/network/optimizer/tradeoffs" data-route="#/network/optimizer/tradeoffs">Ver trade-offs</a><a class="ni-button primary" href="#/network/trust/validation" data-route="#/network/trust/validation">Executar decisão final</a></div>`;
}

export function renderOptimizerTradeoffs(state) {
  const optimizer = selectDecision(state).optimizer;
  if (!optimizer)
    return `<div class="ni-page-heading" data-testid="page-optimizer-tradeoffs"><h1>Trade-offs</h1></div>${emptyState('Execute o otimizador antes de abrir a fronteira.')}`;
  const rows = (optimizer.best_scenarios || []).map(
    (row) =>
      `<tr><td>${escapeHtml(row.scenario_id)}</td><td>${escapeHtml(formatBRL(row.result?.total_with_tax))}</td><td>${escapeHtml(formatNumber(row.final_score, 2))}</td><td>${escapeHtml(row.data_quality?.decision_use || '—')}</td></tr>`
  );
  return `<div class="ni-page-heading" data-testid="page-optimizer-tradeoffs"><p class="ni-eyebrow">Optimizer · Trade-offs</p><h1>Fronteira de decisão</h1><p>O ranking é condicionado ao espaço e aos pesos informados.</p></div>${card('Candidatos comparáveis', table(['Cenário', 'Total', 'Score', 'Uso'], rows, 'Nenhum candidato disponível.'))}`;
}
