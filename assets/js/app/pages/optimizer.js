import { selectDecision } from '../selectors/business-selectors.js';
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

export function renderOptimizerConfigure(state) {
  const constraints = state.data.optimizer?.constraints || {};
  const profiles = [
    ['balanced', 'Balanceado'],
    ['cfo', 'CFO'],
    ['supply', 'Supply'],
    ['fiscal', 'Fiscal'],
    ['conservative', 'Conservador'],
  ];
  return `<div class="ni-page-heading" data-testid="page-optimizer-configure"><p class="ni-eyebrow">Optimizer · Configure</p><h1>Configurar busca</h1><p>Os parâmetros serão encaminhados ao optimizer discreto existente e respeitarão a política fiscal do provider.</p></div>${sectionTabs('optimizer', state.ui.route)}<form id="niOptimizerForm" class="ni-card ni-form" data-testid="optimizer-form" novalidate><label>Perfil<select name="profile_id">${profiles.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label><div class="ni-form-grid"><label>Máximo de candidatos<input name="max_candidates" type="number" min="100" max="10000" step="100" value="${escapeHtml(constraints.max_candidates ?? 2000)}" required></label><label>Seed<input name="seed" type="number" step="1" value="42" required></label><label>CDs mínimos<input name="min_active_cds" type="number" min="1" step="1" value="${escapeHtml(constraints.min_active_cds ?? 1)}" required></label><label>CDs máximos<input name="max_active_cds" type="number" min="1" step="1" value="${escapeHtml(constraints.max_active_cds ?? 999)}" required></label><label>Concentração máxima por CD<input name="max_cd_volume_share" type="number" min="0.01" max="1" step="0.01" value="${escapeHtml(constraints.max_cd_volume_share ?? 0.75)}" required></label><label>Risco máximo<select name="max_risk_level"><option value="low">Baixo</option><option value="medium">Médio</option><option value="high" selected>Alto</option></select></label><label>Iterações Monte Carlo<input name="risk_iterations" type="number" min="50" max="5000" step="50" value="300"></label><label>Seed Monte Carlo<input name="risk_seed" type="number" step="1" value="42"></label><label>Perfil de incerteza<select name="risk_profile"><option value="balanced">Equilibrado</option><option value="conservative">Conservador</option><option value="broad">Amplo</option></select></label><label>Driver do scatter<select name="risk_scatter_driver"><option value="freight_multiplier">Frete</option><option value="demand_multiplier">Demanda</option><option value="inventory_days">Dias de estoque</option><option value="wacc">WACC</option><option value="tax_multiplier">Tributo</option></select></label><label>Perfil de stress<select name="stress_profile"><option value="standard">Padrão</option><option value="conservative">Conservador</option></select></label><label>Sensibilidade<select name="sensitivity_variable"><option value="freight_multiplier">Frete</option><option value="demand_multiplier">Demanda</option><option value="inventory_days">Dias de estoque</option><option value="wacc">WACC</option></select></label><label>Matriz X<select name="sensitivity_x"><option value="freight_multiplier">Frete</option><option value="demand_multiplier">Demanda</option><option value="inventory_days">Dias de estoque</option><option value="wacc">WACC</option></select></label><label>Matriz Y<select name="sensitivity_y"><option value="demand_multiplier">Demanda</option><option value="freight_multiplier">Frete</option><option value="inventory_days">Dias de estoque</option><option value="wacc">WACC</option></select></label></div><p class="ni-note">A busca só será chamada de global quando o engine retornar <code>exact_search_space=true</code>. O modo tributário desligado permanece bloqueado pela política do projeto.</p><button type="submit" class="ni-button primary" data-testid="optimizer-run">Rodar busca</button></form><div class="ni-card"><h2>Baseline usado</h2><p>${escapeHtml(state.data.baseline?.model?.scenario_id || '—')} · ${formatNumber(state.data.baseline?.model?.active_cds?.length || 0)} CD(s) ativo(s)</p></div>`;
}

export function renderOptimizerResults(state) {
  const optimizer = selectDecision(state).optimizer;
  if (!optimizer)
    return `<div class="ni-page-heading" data-testid="page-optimizer-results"><h1>Resultados do otimizador</h1></div>${sectionTabs('optimizer', state.ui.route)}${emptyState('Execute uma busca antes de abrir os resultados.')}`;
  const log = optimizer.search_log || {};
  const rows = (optimizer.best_scenarios || []).map(
    (row) =>
      `<tr><td>${escapeHtml(row.scenario_id)}</td><td>${escapeHtml(formatBRL(row.result?.total_with_tax))}</td><td>${escapeHtml(formatNumber(row.final_score, 2))}</td><td>${escapeHtml(row.quality?.risk_level || '—')}</td></tr>`
  );
  const candidates = optimizer.scored_scenarios?.length
    ? optimizer.scored_scenarios
    : optimizer.best_scenarios || [];
  const manualOptions = candidates
    .slice(0, 200)
    .map(
      (row) =>
        `<option value="${escapeHtml(row.scenario_id)}">${escapeHtml(row.scenario_name || row.scenario_id)}</option>`
    )
    .join('');
  const manualSelection = candidates.length
    ? `<div class="ni-card ni-selection-card"><p class="ni-eyebrow">Seleção final</p><h2>Escolher cenário manualmente</h2><p>Use a seleção manual quando o ranking precisar de uma decisão deliberada. O pipeline recalcula risco, Evidence, QA e release para o cenário selecionado.</p><label>Opção do ranking<select id="niManualScenarioSelect" data-testid="manual-scenario-selector">${manualOptions}</select></label><label>ID manual (opcional)<input id="niManualScenarioId" data-testid="manual-scenario-id" type="text" placeholder="Cole um ID elegível do ranking"></label><div class="ni-actions"><button type="button" class="ni-button primary" data-action="run-decision-manual">Executar decisão deste cenário</button></div></div>`
    : '';
  return `<div class="ni-page-heading" data-testid="page-optimizer-results"><p class="ni-eyebrow">Optimizer · Results</p><h1>Ranking de cenários</h1><p>${escapeHtml(optimizer.result_scope || '—')}</p></div>${sectionTabs('optimizer', state.ui.route)}<div class="ni-kpi-grid">${kpi('Status', optimizer.optimizer_status || '—')}${kpi('Cobertura', log.coverage_ratio == null ? '—' : formatPct(log.coverage_ratio * 100))}${kpi('Busca exata', log.exact_search_space ? 'sim' : 'não')}${kpi('Candidatos', formatNumber(log.simulated_candidates))}</div><div class="ni-grid two"><div class="ni-card"><canvas id="niRankingChart" class="ni-chart" role="img" aria-label="Ranking dos cenários"></canvas></div><div class="ni-card" data-testid="optimizer-ranking">${table(['Cenário', 'Total', 'Score', 'Risco'], rows, 'Nenhum cenário elegível.')}</div></div>${manualSelection}<div class="ni-actions"><a class="ni-button secondary" href="#/network/optimizer/tradeoffs" data-route="#/network/optimizer/tradeoffs">Ver trade-offs</a><a class="ni-button primary" href="#/network/trust/validation" data-route="#/network/trust/validation">Executar decisão final</a></div>`;
}

export function renderOptimizerTradeoffs(state) {
  const optimizer = selectDecision(state).optimizer;
  if (!optimizer)
    return `<div class="ni-page-heading" data-testid="page-optimizer-tradeoffs"><h1>Trade-offs</h1></div>${sectionTabs('optimizer', state.ui.route)}${emptyState('Execute o otimizador antes de abrir a fronteira.')}`;
  const rows = (optimizer.best_scenarios || []).map(
    (row) =>
      `<tr><td>${escapeHtml(row.scenario_id)}</td><td>${escapeHtml(formatBRL(row.result?.total_with_tax))}</td><td>${escapeHtml(formatNumber(row.final_score, 2))}</td><td>${escapeHtml(row.data_quality?.decision_use || '—')}</td></tr>`
  );
  return `<div class="ni-page-heading" data-testid="page-optimizer-tradeoffs"><p class="ni-eyebrow">Optimizer · Trade-offs</p><h1>Fronteira de decisão</h1><p>O ranking é condicionado ao espaço e aos pesos informados.</p></div>${sectionTabs('optimizer', state.ui.route)}${card('Candidatos comparáveis', table(['Cenário', 'Total', 'Score', 'Uso'], rows, 'Nenhum candidato disponível.'))}`;
}
