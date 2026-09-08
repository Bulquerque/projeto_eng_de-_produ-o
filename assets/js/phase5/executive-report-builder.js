import {
  buildScenarioSummary,
  formatInventoryDaysDisplay,
  formatMultiplierDisplay,
} from '../core/scenario-summary.js';

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
    {
      recommended: 'recomendado',
      recommended_with_warnings: 'recomendado com alertas',
      not_recommended: 'não recomendado',
      review_required: 'revisar',
    }[v] ||
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
  const monteCarloConfig = selectedScenario?.monte_carlo?.config || {};
  const monteCarlo =
    selectedScenario?.monte_carlo?.summary ||
    selectedScenario?.scenario?.monte_carlo?.summary ||
    selectedScenario?.monte_carlo_summary ||
    null;
  if (!monteCarlo) return '';

  return `
    <h3>Análise probabilística</h3>
    <table class="executive-table-premium"><thead><tr><th>Indicador</th><th>Valor</th></tr></thead><tbody>
      <tr><td>Perfil</td><td>${esc(monteCarlo.profile || '—')}</td></tr>
      <tr><td>Iterações válidas / solicitadas</td><td>${esc(monteCarlo.iterations_valid ?? monteCarlo.iterations ?? '—')} / ${esc(monteCarlo.iterations_requested ?? monteCarlo.iterations ?? '—')}</td></tr>
      <tr><td>Seed / RNG</td><td>${esc(monteCarlo.seed_effective ?? monteCarlo.seed ?? '—')} · ${esc(monteCarlo.rng_algorithm || '—')}</td></tr>
      <tr><td>Modelo</td><td>${esc(monteCarloConfig.model || 'complementar')}</td></tr>
      <tr><td>Distribuições</td><td>${esc(JSON.stringify(monteCarloConfig.spread || {}))}</td></tr>
      <tr><td>Prob. saving positivo</td><td>${esc(pct(Number(monteCarlo.probability_saving_positive || 0) * 100))}</td></tr>
      <tr><td>Saving p10 / p50 / p90</td><td>${esc(pct(monteCarlo.p10_saving_pct))} · ${esc(pct(monteCarlo.median_saving_pct))} · ${esc(pct(monteCarlo.p90_saving_pct))}</td></tr>
      <tr><td>Driver mais influente</td><td>${esc(monteCarlo.most_sensitive_driver || '—')}</td></tr>
      <tr><td>Faixa de risco</td><td>${esc(monteCarlo.risk_band || '—')}</td></tr>
    </tbody></table>
  `;
}

function rankingSensitivitySection(rankingSensitivity = null) {
  if (!rankingSensitivity) return '';
  const winners = rankingSensitivity.winner_frequency || [];
  return `
    <h3>Sensibilidade do ranking aos pesos</h3>
    <table class="executive-table-premium"><thead><tr><th>Indicador</th><th>Valor</th></tr></thead><tbody>
      <tr><td>Perfis avaliados</td><td>${esc(rankingSensitivity.profiles_evaluated ?? '—')}</td></tr>
      <tr><td>Status de estabilidade</td><td>${esc(rankingSensitivity.stability_status || '—')}</td></tr>
      <tr><td>Cenário mais frequente</td><td>${esc(rankingSensitivity.most_stable_scenario_id || '—')}</td></tr>
      <tr><td>Frequência do vencedor</td><td>${esc(pct(Number(rankingSensitivity.stability_ratio || 0) * 100))}</td></tr>
    </tbody></table>
    ${
      winners.length
        ? `<table class="executive-table-premium" style="margin-top:12px"><thead><tr><th>Cenário</th><th>Perfis</th><th>Frequência</th></tr></thead><tbody>${winners
            .map(
              (winner) =>
                `<tr><td>${esc(winner.scenario_id)}</td><td>${esc(winner.profile_count)}</td><td>${esc(pct(Number(winner.profile_share || 0) * 100))}</td></tr>`
            )
            .join('')}</tbody></table>`
        : '<p>Não há vencedores registrados para os perfis avaliados.</p>'
    }
  `;
}

function methodologySection(selectedScenario = {}, audit = {}) {
  const result = selectedScenario?.result || selectedScenario;
  const costs = result?.costs || {};
  const diagnostics = costs.diagnostics || {};
  const changes = selectedScenario?.scenario?.changes || selectedScenario?.changes || {};
  const warnings = [...new Set([...(costs.warnings || []), ...(result?.warnings || [])])];
  return `
    <h3>Metodologia e rastreabilidade</h3>
    <table class="executive-table-premium"><thead><tr><th>Item</th><th>Registro</th></tr></thead><tbody>
      <tr><td>Método de custo</td><td>${esc(costs.calculation_method || '—')}</td></tr>
      <tr><td>Classificação da fonte</td><td>${esc(diagnostics.source_classification || '—')}</td></tr>
      <tr><td>Fonte tributária</td><td>${esc(result?.tax_results?.tax_source_label || '—')}</td></tr>
      <tr><td>Regime tributário do cenário</td><td>${esc(result?.tax_results?.tax_regime || changes.tax_regime || changes.tax_mode || '—')}</td></tr>
      <tr><td>Estoque</td><td>Escolha B — independente da quantidade de CDs ativos</td></tr>
      <tr><td>Fallbacks físicos</td><td>${esc(JSON.stringify({ counts: diagnostics.fallback_counts || {}, rates: diagnostics.fallback_rates || {}, flow_count: diagnostics.flow_count ?? null }))}</td></tr>
      <tr><td>Proveniência do proxy de transferência</td><td>${esc(JSON.stringify(diagnostics.transfer_proxy_provenance || '—'))}</td></tr>
      <tr><td>Audit ID</td><td>${esc(audit?.audit_id || '—')}</td></tr>
    </tbody></table>
    <p class="small-note">Os custos sem observação direta são identificados como proxy ou fallback no resultado e no pacote JSON. Eles não devem ser lidos como tarifa histórica validada.</p>
    ${warnings.length ? `<p><strong>Alertas do cálculo:</strong> ${warnings.map((warning) => esc(warning)).join(' · ')}</p>` : ''}
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
  rankingSensitivity,
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
    <h3>Cenário e parecer</h3>
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
    <h3>Stress test</h3>
    <p>${esc(stress?.summary?.cases_positive || 0)} de ${esc(stress?.summary?.cases_run || 0)} casos mantiveram resultado melhor ou igual ao baseline.</p>
    ${monteCarloSection(selectedScenario)}
    ${rankingSensitivitySection(rankingSensitivity || audit?.ranking_sensitivity)}
    ${methodologySection(selectedScenario, audit)}
    ${workbookParitySection(workbookParity)}
    <h3>Principais razões</h3>
    <ul>${(recommendation?.main_reasons || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <h3>Riscos e próximos passos</h3>
    <ul>${(recommendation?.main_risks || []).map((x) => `<li>${esc(x)}</li>`).join('')}${(recommendation?.next_actions || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <h3>Auditoria</h3>
    <p>Baseline: ${esc(audit?.baseline_scenario_id || '—')} · Cenário: ${esc(audit?.selected_scenario_id || '—')}</p>
  </article>`;
}
