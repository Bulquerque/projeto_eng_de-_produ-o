import {
  buildScenarioSummary,
  formatInventoryDaysDisplay,
  formatMultiplierDisplay,
} from '../shared/scenario-summary.js';

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function brl(v) {
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    : '—';
}
function pct(v) {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—';
}
function status(v) {
  return (
    { recommended: 'recomendado', not_recommended: 'não recomendado', review_required: 'revisar' }[
      v
    ] ||
    v ||
    '—'
  );
}
function workbookParitySection(workbookParity = {}) {
  const rows = workbookParity?.rows || [];
  if (!workbookParity) return '';
  const summary = workbookParity.summary || {};
  return `
    <h3>Paridade com workbook</h3>
    <table class="executive-table-premium"><thead><tr><th>Indicador</th><th>Valor</th></tr></thead><tbody>
      <tr><td>Status</td><td>${esc(workbookParity.status_label || '—')}</td></tr>
      <tr><td>Base Fit Score</td><td>${esc(workbookParity.score == null ? 'pendente' : `${workbookParity.score}/100`)}</td></tr>
      <tr><td>Métricas comparadas</td><td>${esc(summary.compared_metrics ?? 0)}</td></tr>
      <tr><td>Erro médio absoluto</td><td>${esc(summary.mean_abs_error_pct == null ? '—' : pct(summary.mean_abs_error_pct))}</td></tr>
      <tr><td>Maior desvio</td><td>${esc(summary.max_abs_error_pct == null ? '—' : pct(summary.max_abs_error_pct))}</td></tr>
      <tr><td>Fonte</td><td>${esc(workbookParity.reference_source || '—')}</td></tr>
      <tr><td>Modo de comparação</td><td>${esc(workbookParity.comparison_mode === 'reference_results' ? 'comparação real do workbook' : workbookParity.comparison_mode === 'proxy_baseline' ? 'baseline estrutural proxy' : workbookParity.comparison_mode === 'base_fit' ? 'Base Fit calculado' : 'pendente')}</td></tr>
      <tr><td>Reconciliação geral</td><td>${esc(workbookParity.reconciliation_label || '—')}</td></tr>
      <tr><td>Reconciliação tributária</td><td>${esc(workbookParity.tax_status || 'pending')}</td></tr>
    </tbody></table>
    ${
      rows.length
        ? `
      <table class="executive-table-premium" style="margin-top:12px"><thead><tr><th>Métrica</th><th>Referência</th><th>Simulado</th><th>Erro</th><th>Status</th></tr></thead><tbody>
      ${rows.map((row) => `<tr><td>${esc(row.metric)}</td><td>${esc(brl(row.reference))}</td><td>${esc(brl(row.simulated))}</td><td>${esc(row.percentage_error == null ? '—' : pct(row.percentage_error))}</td><td>${esc(row.status || '—')}</td></tr>`).join('')}
      </tbody></table>
    `
        : '<p>Sem métricas de workbook consolidadas para exibir.</p>'
    }
  `;
}
function monteCarloSection(selectedScenario = {}) {
  const envelope = selectedScenario?.monte_carlo || selectedScenario?.scenario?.monte_carlo || null;
  const monteCarlo = envelope?.summary || selectedScenario?.monte_carlo_summary || null;
  if (!monteCarlo) return '';
  const config = envelope?.config || {};
  const spread = config.spread || {};

  return `
    <h3>Análise probabilística</h3>
    <table class="executive-table-premium"><thead><tr><th>Indicador</th><th>Valor</th></tr></thead><tbody>
      <tr><td>Perfil</td><td>${esc(monteCarlo.profile || '—')}</td></tr>
      <tr><td>Iterações</td><td>${esc(monteCarlo.iterations ?? '—')}</td></tr>
      <tr><td>Seed</td><td>${esc(monteCarlo.seed ?? config.seed ?? '—')}</td></tr>
      <tr><td>Spreads utilizados</td><td>${esc(
        Object.keys(spread).length
          ? Object.entries(spread)
              .map(([key, value]) => `${key}=${value}`)
              .join('; ')
          : 'não disponíveis no pacote'
      )}</td></tr>
      <tr><td>Prob. saving positivo</td><td>${esc(pct(Number(monteCarlo.probability_saving_positive || 0) * 100))}</td></tr>
      <tr><td>Saving p10 / p50 / p90</td><td>${esc(pct(monteCarlo.p10_saving_pct))} · ${esc(pct(monteCarlo.median_saving_pct))} · ${esc(pct(monteCarlo.p90_saving_pct))}</td></tr>
      <tr><td>Driver mais influente</td><td>${esc(monteCarlo.most_sensitive_driver || '—')}</td></tr>
      <tr><td>Faixa de risco</td><td>${esc(monteCarlo.risk_band || '—')}</td></tr>
      <tr><td>Calibração</td><td>spreads parametrizados manualmente; análise exploratória, sem calibração histórica validada</td></tr>
    </tbody></table>
  `;
}

function fallbackSection(selectedScenario = {}) {
  const result = selectedScenario?.result || selectedScenario;
  const costs = result?.costs || {};
  const fallback = costs.fallback_usage || null;
  if (!fallback) return '';
  const rows = [
    ['Modo do estoque', costs.inventory_calculation_mode || 'days_wacc_only'],
    [
      'Pooling de estoque por CDs',
      costs.inventory_pooling_effect_included ? 'incluído' : 'não incluído',
    ],
    ['Fluxos com proxy cruzada de transferência', fallback.cross_company_transfer_proxy_flows ?? 0],
    ['Peso sob proxy cruzada', pct(fallback.cross_company_transfer_proxy_volume_share_pct)],
    ['Custo físico sob proxy cruzada', pct(fallback.cross_company_transfer_proxy_cost_share_pct)],
    ['Fluxos com fallback de distância', fallback.missing_transfer_distance_flows ?? 0],
    ['Receita coberta pelo fallback de 2,5%', pct(fallback.revenue_pct_fallback_revenue_share_pct)],
    ['Custo físico sob armazenagem proporcional', pct(fallback.storage_proxy_cost_share_pct)],
  ];
  return `
    <h3>Premissas, proxies e fallbacks acionados</h3>
    <table class="executive-table-premium"><thead><tr><th>Indicador</th><th>Valor</th></tr></thead><tbody>
      ${rows.map(([label, value]) => `<tr><td>${esc(label)}</td><td>${esc(value)}</td></tr>`).join('')}
    </tbody></table>
  `;
}

function scenarioConfigurationSection(selectedScenario = {}) {
  const summary = buildScenarioSummary({
    scenario: selectedScenario?.scenario,
    result: selectedScenario?.result || selectedScenario,
  });
  const rows = [
    ['CDs', `${summary.active_cds_count}`],
    ['Frete', formatMultiplierDisplay(summary.freight_multiplier)],
    ['Demanda', formatMultiplierDisplay(summary.demand_multiplier)],
    ['Estoque', formatInventoryDaysDisplay(summary.inventory_days)],
    ['Regime tributário', summary.tax_regime_label],
    ['Transferência', brl(summary.transfer_cost)],
    ['Tributo', brl(summary.tax_impact)],
    ['Total', brl(summary.total_with_tax)],
  ];

  return `
    <h3>Configuração do cenário</h3>
    <table class="executive-table-premium"><thead><tr><th>Indicador</th><th>Valor</th></tr></thead><tbody>
      ${rows.map(([label, value]) => `<tr><td>${esc(label)}</td><td>${esc(value)}</td></tr>`).join('')}
    </tbody></table>
  `;
}
export function buildExecutiveReportHtml({
  companyId,
  selectedScenario,
  recommendation,
  stress,
  robustness,
  audit,
  comparison,
  workbookParity,
} = {}) {
  const scenarioName =
    selectedScenario?.scenario_name ||
    selectedScenario?.scenario?.scenario_name ||
    selectedScenario?.scenario_id ||
    selectedScenario?.result?.scenario_id ||
    'Cenário selecionado';
  const total = selectedScenario?.result?.total_with_tax ?? selectedScenario?.total_with_tax;
  const saving = comparison?.saving_abs ?? comparison?.comparison?.[0]?.saving_abs;
  const savingPct = comparison?.saving_pct;
  return `<article class="executive-report-content">
    <h2>Relatório executivo — ${esc(companyId)}</h2>
    <h3>Cenário recomendado</h3>
    <p><strong>${esc(scenarioName)}</strong></p>
    <p>${esc(recommendation?.executive_summary || '')}</p>
    <h3>Resultado financeiro</h3>
    <table class="executive-table-premium"><thead><tr><th>Indicador Estratégico</th><th>Valor Consolidado</th></tr></thead><tbody>
      <tr><td>Custo Total Estimado</td><td>${esc(brl(total))}</td></tr>
      <tr><td>Saving vs Cenário Base</td><td>${esc(brl(saving))}</td></tr>
      <tr><td>Eficiência (%)</td><td>${esc(pct(savingPct))}</td></tr>
      <tr><td>Score de Robustez</td><td>${esc(Math.round(Number(robustness?.robustness_score || 0)) + '/100')}</td></tr>
      <tr><td>Parecer Final</td><td>${esc(status(recommendation?.recommendation_status))}</td></tr>
    </tbody></table>
    ${scenarioConfigurationSection(selectedScenario)}
    ${fallbackSection(selectedScenario)}
    <h3>Stress test</h3>
    <p>${esc(stress?.summary?.cases_positive || 0)} de ${esc(stress?.summary?.cases_run || 0)} casos mantiveram resultado melhor ou igual ao baseline.</p>
    ${monteCarloSection(selectedScenario)}
    ${workbookParitySection(workbookParity)}
    <h3>Principais razões</h3>
    <ul>${(recommendation?.main_reasons || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <h3>Riscos e próximos passos</h3>
    <ul>${(recommendation?.main_risks || []).map((x) => `<li>${esc(x)}</li>`).join('')}${(recommendation?.next_actions || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <h3>Auditoria</h3>
    <p>Baseline: ${esc(audit?.baseline_scenario_id || '—')} · Cenário: ${esc(audit?.selected_scenario_id || '—')}</p>
  </article>`;
}
