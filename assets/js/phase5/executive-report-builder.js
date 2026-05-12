function esc(v) { return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'); }
function brl(v) { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '—'; }
function pct(v) { const n = Number(v); return Number.isFinite(n) ? `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—'; }
function status(v) { return { recommended: 'recomendado', not_recommended: 'não recomendado', review_required: 'revisar' }[v] || v || '—'; }
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
    ${rows.length ? `
      <table class="executive-table-premium" style="margin-top:12px"><thead><tr><th>Métrica</th><th>Referência</th><th>Simulado</th><th>Erro</th><th>Status</th></tr></thead><tbody>
      ${rows.map(row => `<tr><td>${esc(row.metric)}</td><td>${esc(brl(row.reference))}</td><td>${esc(brl(row.simulated))}</td><td>${esc(row.percentage_error == null ? '—' : pct(row.percentage_error))}</td><td>${esc(row.status || '—')}</td></tr>`).join('')}
      </tbody></table>
    ` : '<p>Sem métricas de workbook consolidadas para exibir.</p>'}
  `;
}
export function buildExecutiveReportHtml({ companyId, selectedScenario, recommendation, stress, robustness, audit, comparison, workbookParity } = {}) {
  const scenarioName = selectedScenario?.scenario_name || selectedScenario?.scenario?.scenario_name || selectedScenario?.scenario_id || selectedScenario?.result?.scenario_id || 'Cenário selecionado';
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
    <h3>Stress test</h3>
    <p>${esc(stress?.summary?.cases_positive || 0)} de ${esc(stress?.summary?.cases_run || 0)} casos mantiveram resultado melhor ou igual ao baseline.</p>
    ${workbookParitySection(workbookParity)}
    <h3>Principais razões</h3>
    <ul>${(recommendation?.main_reasons || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <h3>Riscos e próximos passos</h3>
    <ul>${(recommendation?.main_risks || []).map(x => `<li>${esc(x)}</li>`).join('')}${(recommendation?.next_actions || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <h3>Auditoria</h3>
    <p>Baseline: ${esc(audit?.baseline_scenario_id || '—')} · Cenário: ${esc(audit?.selected_scenario_id || '—')}</p>
  </article>`;
}
