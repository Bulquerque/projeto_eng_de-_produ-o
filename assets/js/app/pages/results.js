import {
  selectActiveScenario,
  selectBaseline,
  selectDecision,
} from '../selectors/business-selectors.js';
import {
  businessLabel,
  emptyState,
  escapeHtml,
  formatBRL,
  formatNumber,
  formatPct,
  kpi,
  sectionTabs,
  table,
} from '../view-helpers.js';

const COST_COMPONENTS = [
  ['transfer_cost', 'Transferência'],
  ['distribution_cost', 'Distribuição'],
  ['storage_cost', 'Armazenagem'],
  ['inventory_cost', 'Estoque'],
  ['tax_impact', 'Tributos'],
  ['total_with_tax', 'Total com tributos'],
];

function baselineValues(state) {
  const baseline = selectBaseline(state);
  return {
    name: baseline?.model?.scenario_name || 'Referência',
    id: baseline?.model?.scenario_id || 'baseline',
    costs: baseline?.costs?.costs || {},
    model: baseline?.model || {},
  };
}

function resultsTabs(state) {
  return sectionTabs('results', state.ui?.route);
}

export function renderResultsSummary(state) {
  const decision = selectDecision(state);
  const result = decision.result;
  const scenario = decision.scenario || selectActiveScenario(state);
  const baseline = baselineValues(state);
  if (!result || !scenario) {
    const issues = [
      ...new Set([
        ...(decision.final_qa?.blocking_issues || []),
        ...(decision.release?.blocking_issues || []),
      ]),
    ];
    const blocked =
      state.meta?.status === 'decision_blocked' || decision.final_qa?.final_qa_status === 'failed';
    const message = blocked
      ? `<section class="ni-workspace-alert ni-workspace-alert--negative" role="alert" data-testid="decision-blocked"><h2>Não foi possível calcular o cenário</h2>${issues.length ? `<ul>${issues.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p>Revise o cenário e tente novamente.</p>'}<a href="#/network/trust/validation" data-route="#/network/trust/validation">Ver detalhes da execução</a></section>`
      : emptyState('Selecione e simule um cenário para consultar seus resultados.');
    return `<section class="ni-workspace ni-workspace-page ni-results" data-testid="page-results-summary"><header class="ni-page-heading"><h1>Resultados do cenário</h1></header>${resultsTabs(state)}${message}</section>`;
  }

  const currentCosts = result.costs || {};
  const total = result.total_with_tax ?? currentCosts.total_with_tax;
  const referenceTotal = baseline.costs.total_with_tax;
  const totalDelta =
    total == null || referenceTotal == null ? null : Number(total) - Number(referenceTotal);
  const saving = totalDelta == null ? null : -totalDelta;
  const savingPct =
    saving == null || Number(referenceTotal) === 0 ? null : (saving / Number(referenceTotal)) * 100;
  const activeCdCount = scenario?.changes?.active_cds?.length;
  const rows = COST_COMPONENTS.map(([key, label]) => {
    const value = currentCosts[key];
    const reference = baseline.costs[key];
    const delta = value == null || reference == null ? null : Number(value) - Number(reference);
    return `<tr><th scope="row">${label}</th><td>${value == null ? '—' : escapeHtml(formatBRL(value))}</td><td>${reference == null ? '—' : escapeHtml(formatBRL(reference))}</td><td>${delta == null ? '—' : escapeHtml(formatBRL(delta))}</td></tr>`;
  });
  const exportFiles = decision.export_package?.files || [];
  const actions = `<details class="ni-workspace-secondary-analytics"><summary>Salvar e exportar</summary><div class="ni-actions">${state.data?.selected_scenario && result ? '<button type="button" class="ni-button secondary" data-action="save-current-scenario" data-testid="scenario-save">Salvar cenário</button><button type="button" class="ni-button secondary" data-action="export-current-scenario" data-testid="scenario-export">Exportar cenário JSON</button>' : ''}${exportFiles.length ? '<button type="button" class="ni-button secondary" data-action="open-export">Abrir pacote de entrega</button>' : ''}</div></details>`;
  const summary = `<section class="ni-results-summary"><div class="ni-results-decision"><div><span class="ni-results-kind">Resultado do cenário</span><h2>${escapeHtml(scenario.scenario_name || 'Cenário avaliado')}</h2></div><div class="ni-results-impact ni-results-saving${saving != null && saving < 0 ? ' ni-results-impact--negative' : ''}"><span class="ni-results-impact-label">Economia ante a referência</span><strong class="ni-results-impact-value">${saving == null ? '—' : escapeHtml(formatBRL(saving, true))}</strong><small class="ni-results-impact-percent">${savingPct == null ? '—' : escapeHtml(formatPct(savingPct))}</small></div></div><div class="ni-workspace-kpis ni-results-metrics">${kpi('Custo total', total == null ? '—' : formatBRL(total, true), '', 'result-total')}${kpi('Referência', referenceTotal == null ? '—' : formatBRL(referenceTotal, true))}${kpi('CDs ativos', activeCdCount == null ? '—' : formatNumber(activeCdCount))}</div></section>`;
  return `<section class="ni-workspace ni-workspace-page ni-results" data-testid="page-results-summary"><header class="ni-page-heading"><h1>Resultados do cenário</h1></header>${resultsTabs(state)}${summary}<section class="ni-workspace-panel ni-results-reference"><h2>Economia por componente</h2><canvas id="niDecisionComponentDeltaChart" class="ni-chart" role="img" aria-label="Economia ou aumento de custo por componente"></canvas><details class="ni-workspace-secondary-analytics"><summary>Comparação detalhada de custos</summary>${table(['Componente', 'Resultado', 'Referência', 'Diferença'], rows)}</details></section>${actions}</section>`;
}

export function comparisonCandidates(state) {
  const decision = selectDecision(state);
  const baseline = baselineValues(state);
  const comparison = decision.comparison?.comparison || [];
  const candidates = [];
  const byId = new Map();
  if (baseline.id && baseline.costs.total_with_tax != null) {
    byId.set(baseline.id, {
      scenario_id: baseline.id,
      scenario_name: 'Referência',
      total_with_tax: baseline.costs.total_with_tax,
      costs: baseline.costs,
      active_cds_count: baseline.model.active_cds?.length,
      status: 'baseline',
    });
  }
  for (const kind of ['simulation']) {
    const run = state.data?.analysis_runs?.[kind];
    if (!run?.scenario || !run?.result || run.company_id !== state.context?.company_id) continue;
    const runId = `saved-${kind}:${run.run_id}`;
    byId.set(runId, {
      scenario_id: runId,
      scenario_name: `Simulação · ${run.scenario.scenario_name || 'Última execução'}`,
      total_with_tax: run.result.total_with_tax ?? run.result.costs?.total_with_tax,
      costs: run.result.costs || {},
      active_cds_count: run.scenario.changes?.active_cds?.length,
      preserved_execution: true,
      execution_kind: kind,
    });
  }
  for (const row of comparison) if (row.scenario_id) byId.set(row.scenario_id, row);
  for (const row of candidates) {
    if (!row.scenario_id || byId.has(row.scenario_id)) continue;
    const cost = row.result?.total_with_tax ?? row.total_with_tax;
    byId.set(row.scenario_id, {
      ...row,
      scenario_name: row.scenario_name || row.scenario?.scenario_name,
      total_with_tax: cost,
      costs: row.result?.costs || row.costs || {},
      active_cds_count: row.scenario?.changes?.active_cds?.length ?? row.active_cds?.length,
    });
  }
  const selected = decision.scenario;
  if (selected?.scenario_id && !byId.has(selected.scenario_id)) {
    byId.set(selected.scenario_id, {
      scenario_id: selected.scenario_id,
      scenario_name: selected.scenario_name,
      total_with_tax: decision.result?.total_with_tax,
      costs: decision.result?.costs || {},
      active_cds_count: selected.changes?.active_cds?.length,
    });
  }
  return [...byId.values()];
}

export function renderResultsComparison(state) {
  const baseline = baselineValues(state);
  const rows = comparisonCandidates(state);
  const activeId = state.context?.selected_scenario_id;
  const metric = (candidate, key) =>
    candidate[key] == null ? '—' : escapeHtml(formatBRL(candidate[key], true));
  const componentMetric = (candidate, key) => metric(candidate.costs || {}, key);
  const candidates = rows.filter(
    (row) => row.scenario_id !== baseline.id && !row.preserved_execution
  );
  const headings = rows
    .map((row) => {
      const isBaseline = row.scenario_id === baseline.id;
      const label = isBaseline ? 'Referência' : row.scenario_name || 'Alternativa';
      const marker =
        !isBaseline && row.scenario_id === activeId ? '<small>Selecionado</small>' : '';
      return `<th scope="col" class="${row.scenario_id === activeId ? 'is-selected' : ''}">${escapeHtml(label)}${marker}</th>`;
    })
    .join('');
  const metrics = [
    ['Custo total', (row) => metric(row, 'total_with_tax')],
    [
      'Economia ante referência',
      (row) => {
        const value = row.total_with_tax == null ? Number.NaN : Number(row.total_with_tax);
        const ref =
          baseline.costs.total_with_tax == null
            ? Number.NaN
            : Number(baseline.costs.total_with_tax);
        return Number.isFinite(value) && Number.isFinite(ref)
          ? escapeHtml(formatBRL(ref - value, true))
          : '—';
      },
    ],
    [
      'CDs ativos',
      (row) =>
        row.active_cds_count == null ? '—' : escapeHtml(formatNumber(row.active_cds_count)),
    ],
    ['Transferência', (row) => componentMetric(row, 'transfer_cost')],
    ['Distribuição', (row) => componentMetric(row, 'distribution_cost')],
    ['Armazenagem', (row) => componentMetric(row, 'storage_cost')],
    ['Estoque', (row) => componentMetric(row, 'inventory_cost')],
  ];
  const body = rows.length
    ? `<div class="ni-workspace-matrix-wrap"><table class="ni-workspace-matrix"><thead><tr><th scope="col">Indicador</th>${headings}</tr></thead><tbody>${metrics.map(([label, render]) => `<tr><th scope="row">${label}</th>${rows.map((row) => `<td class="${row.scenario_id === activeId ? 'is-selected' : ''}">${render(row)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="ni-comparison-cards">${rows.map((row) => `<article class="ni-comparison-card${row.scenario_id === activeId ? ' is-selected' : ''}"><h2>${escapeHtml(row.scenario_id === baseline.id ? 'Referência' : row.scenario_name || 'Alternativa')}</h2><dl>${metrics.map(([label, render]) => `<div><dt>${label}</dt><dd>${render(row)}</dd></div>`).join('')}</dl></article>`).join('')}</div>`
    : emptyState('Execute uma simulação ou gere recomendações para comparar alternativas.');
  const selectActions = candidates
    .filter((row) => row.scenario_id !== activeId)
    .map(
      (row) =>
        `<button type="button" class="ni-button secondary" data-action="select-compared-scenario" data-scenario-id="${escapeHtml(row.scenario_id)}">Selecionar ${escapeHtml(row.scenario_name || 'alternativa')}</button>`
    )
    .join('');
  const chartRows = rows.filter(
    (row) => row.total_with_tax != null && Number.isFinite(Number(row.total_with_tax))
  );
  const chart =
    chartRows.length > 1
      ? `<section class="ni-workspace-panel ni-results-comparison-chart"><h2>Custo total por alternativa</h2><canvas id="niComparisonCostChart" class="ni-chart" role="img" aria-label="Gráfico de barras comparando o custo total da referência e das alternativas disponíveis"></canvas></section>`
      : '';
  return `<section class="ni-workspace ni-workspace-page ni-results-comparison" data-testid="page-results-comparison"><header class="ni-page-heading"><h1>Comparação</h1></header>${resultsTabs(state)}${chart}<section class="ni-workspace-panel">${body}${selectActions ? `<div class="ni-actions">${selectActions}</div>` : ''}</section></section>`;
}

export function renderResultsTradeoffs(state) {
  return `<section class="ni-workspace ni-workspace-page ni-results-tradeoffs" data-testid="page-results-tradeoffs"><header class="ni-page-heading"><h1>Avaliação de alternativas</h1></header>${resultsTabs(state)}<section class="ni-workspace-panel"><p>Ranking, score e trade-offs pertencem à avaliação de alternativas.</p><a class="ni-button primary" href="#/network/optimizer/results" data-route="#/network/optimizer/results">Abrir avaliação de alternativas</a></section></section>`;
}

function renderSensitivityMatrix(matrix = {}) {
  matrix ||= {};
  const columns = matrix.columns || matrix.x_values || [];
  const rows = matrix.rows || matrix.y_values || [];
  const values =
    matrix.values ||
    matrix.saving_pct ||
    rows.map((y) =>
      columns.map((x) => {
        const cell = matrix.matrix_results?.find((row) => row.x_value === x && row.y_value === y);
        return cell?.errors?.length ? null : cell?.saving_pct;
      })
    );
  if (!columns.length || !rows.length || !values.length)
    return emptyState('Matriz de sensibilidade indisponível.');
  const header = `<tr><th scope="col">${escapeHtml(businessLabel(matrix.y_variable))} / ${escapeHtml(businessLabel(matrix.x_variable))}</th>${columns.map((item) => `<th scope="col">${escapeHtml(item)}</th>`).join('')}</tr>`;
  const body = rows
    .map(
      (row, rowIndex) =>
        `<tr><th scope="row">${escapeHtml(row)}</th>${columns
          .map((_, columnIndex) => {
            const value = values[rowIndex]?.[columnIndex];
            return `<td>${value == null ? '—' : escapeHtml(formatPct(value))}</td>`;
          })
          .join('')}</tr>`
    )
    .join('');
  return `<div class="ni-table-wrap"><table class="ni-workspace-heatmap" data-testid="sensitivity-matrix"><caption>Economia ante a referência (%)</caption><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
}

export function renderRiskAnalysis(state, advanced = false) {
  const decision = selectDecision(state);
  const risk = decision.risk || {};
  const monteCarlo = risk.monte_carlo || {};
  const summary = monteCarlo.summary || {};
  const riskConfig = state.ui?.risk_draft || monteCarlo.config || {};
  const options = (name, entries, fallback) =>
    entries
      .map(
        ([value, label]) =>
          `<option value="${value}"${(riskConfig[name] ?? fallback) === value ? ' selected' : ''}>${label}</option>`
      )
      .join('');
  const stress = (risk.stress?.stress_results || []).filter((row) => row);
  const validStress = stress.filter((row) => row.status === 'success');
  const negative = validStress.find((row) => row.scenario_still_better_than_baseline === false);
  const stressSummary = negative
    ? `<p class="ni-workspace-alert ni-workspace-alert--negative">${escapeHtml(negative.case_name || 'Um cenário de estresse')} apresentou economia de ${escapeHtml(formatPct(negative.saving_pct))}.</p>`
    : validStress.length
      ? `<p class="ni-workspace-alert ni-workspace-alert--positive">${formatNumber(risk.stress?.summary?.cases_positive ?? validStress.length)} de ${formatNumber(validStress.length)} casos avaliados mantiveram economia.</p>`
      : `<p class="ni-note">Casos de estresse indisponíveis.</p>`;
  const noRisk = !monteCarlo.summary && !risk.stress && !risk.sensitivity_matrix;
  const chart = (title, id, label) =>
    `<section class="ni-workspace-panel"><h2>${title}</h2><canvas id="${id}" class="ni-chart" role="img" aria-label="${label}"></canvas></section>`;
  const controls = `<details class="ni-workspace-advanced"><summary>Ajustar análise de risco</summary><form id="niRiskForm" class="ni-workspace-field-grid" data-testid="risk-controls" novalidate><label class="ni-workspace-field"><span>Iterações</span><input type="number" name="iterations" min="50" max="5000" step="50" value="${escapeHtml(riskConfig.iterations ?? summary.iterations ?? 300)}"></label><label class="ni-workspace-field"><span>Seed</span><input type="number" name="seed" step="1" value="${escapeHtml(riskConfig.seed ?? summary.seed ?? 42)}"></label><label class="ni-workspace-field"><span>Perfil de incerteza</span><select name="profile">${options(
    'profile',
    [
      ['balanced', 'Equilibrado'],
      ['conservative', 'Conservador'],
      ['broad', 'Amplo'],
    ],
    'balanced'
  )}</select></label><label class="ni-workspace-field"><span>Fator de análise</span><select name="scatter_driver">${options('scatter_driver', [['freight_multiplier', 'Frete'], ['demand_multiplier', 'Demanda'], ['inventory_days', 'Dias de estoque'], ['wacc', 'Custo de capital'], ...(state.context.provider_kind === 'mock' ? [] : [['tax_multiplier', 'Tributos']])], 'freight_multiplier')}</select></label><label class="ni-workspace-field"><span>Teste de estresse</span><select name="stress_profile">${options(
    'stress_profile',
    [
      ['standard', 'Padrão'],
      ['conservative', 'Conservador'],
    ],
    'standard'
  )}</select></label><label class="ni-workspace-field"><span>Variável de sensibilidade</span><select name="sensitivity_variable">${options(
    'sensitivity_variable',
    [
      ['freight_multiplier', 'Frete'],
      ['demand_multiplier', 'Demanda'],
      ['inventory_days', 'Dias de estoque'],
      ['wacc', 'Custo de capital'],
    ],
    'freight_multiplier'
  )}</select></label><label class="ni-workspace-field"><span>Eixo horizontal da matriz</span><select name="sensitivity_x">${options(
    'sensitivity_x',
    [
      ['freight_multiplier', 'Frete'],
      ['demand_multiplier', 'Demanda'],
      ['inventory_days', 'Dias de estoque'],
      ['wacc', 'Custo de capital'],
    ],
    'freight_multiplier'
  )}</select></label><label class="ni-workspace-field"><span>Eixo vertical da matriz</span><select name="sensitivity_y">${options(
    'sensitivity_y',
    [
      ['demand_multiplier', 'Demanda'],
      ['freight_multiplier', 'Frete'],
      ['inventory_days', 'Dias de estoque'],
      ['wacc', 'Custo de capital'],
    ],
    'demand_multiplier'
  )}</select></label><button type="submit" class="ni-button primary" data-testid="risk-run">Recalcular risco</button></form></details>`;
  if (noRisk) {
    return `${emptyState(decision.result ? 'Calcule o risco com as premissas abaixo.' : 'Simule um cenário para consultar o risco operacional.')}${decision.result ? controls : ''}`;
  }
  const kpis = `<div class="ni-workspace-kpis">${kpi('Probabilidade de economia', summary.probability_saving_positive == null ? '—' : formatPct(summary.probability_saving_positive * 100))}${kpi('Economia · P10', summary.p10_saving_pct == null ? '—' : formatPct(summary.p10_saving_pct))}${kpi('Economia · mediana', summary.median_saving_pct == null ? '—' : formatPct(summary.median_saving_pct))}${kpi('Economia · P90', summary.p90_saving_pct == null ? '—' : formatPct(summary.p90_saving_pct))}</div>`;
  const stressTable = advanced
    ? table(
        ['Caso', 'Custo total', 'Economia', 'Estado'],
        stress.map(
          (row) =>
            `<tr><td>${escapeHtml(row.case_name || '—')}</td><td>${row.total_with_tax == null ? '—' : escapeHtml(formatBRL(row.total_with_tax, true))}</td><td>${row.saving_pct == null ? '—' : escapeHtml(formatPct(row.saving_pct))}</td><td>${escapeHtml(businessLabel(row.status))}</td></tr>`
        ),
        'Resultados de estresse indisponíveis.'
      )
    : '';
  const metadata = advanced
    ? `<details class="ni-workspace-secondary-analytics"><summary>Detalhes do cálculo</summary><dl class="ni-workspace-metadata"><div><dt>Iterações válidas</dt><dd>${escapeHtml(formatNumber(summary.iterations_valid ?? summary.iterations))}</dd></div><div><dt>Perfil</dt><dd>${escapeHtml(businessLabel(summary.profile || monteCarlo.config?.profile))}</dd></div><div><dt>Seed</dt><dd>${escapeHtml(formatNumber(summary.seed ?? monteCarlo.config?.seed))}</dd></div></dl></details>`
    : '';
  const summaryCharts = `<div class="ni-workspace-grid">${chart('Distribuição da economia', 'niRiskHistogramChart', 'Distribuição da economia simulada')}${chart('Principais fatores', 'niRiskDriversChart', 'Principais fatores de risco')}</div>`;
  const advancedCharts = advanced
    ? `<div class="ni-workspace-grid">${chart('Faixa de incerteza', 'niRiskChart', 'Faixa de incerteza')}${chart('Probabilidade de economia', 'niRiskProbabilityChart', 'Probabilidade de economia')}${chart('Curva percentílica', 'niRiskCdfChart', 'Curva percentílica')}${chart('Custo total', 'niRiskTotalChart', 'Distribuição do custo total')}${chart('Relação entre fator e economia', 'niRiskScatterChart', 'Relação entre fator e economia')}${chart('Sensibilidade', 'niSensitivityChart', 'Sensibilidade das variáveis')}</div><section class="ni-workspace-panel"><h2>Matriz de sensibilidade</h2>${renderSensitivityMatrix(risk.sensitivity_matrix)}</section>${stressTable}${metadata}`
    : '';
  return `${kpis}${stressSummary}${controls}${summaryCharts}${advancedCharts}`;
}

export function renderResultsRisk(state, advanced = false) {
  const decision = selectDecision(state);
  const scenario = decision.scenario;
  return `<section class="ni-workspace ni-workspace-page ni-results-risk" data-testid="page-results-risk"><header class="ni-page-heading"><h1>Risco operacional</h1>${scenario ? `<p>${escapeHtml(scenario.scenario_name || 'Cenário analisado')}</p>` : ''}</header>${resultsTabs(state)}${renderRiskAnalysis(state, advanced)}${advanced ? '' : '<a class="ni-button secondary" href="#/network/results/risk/advanced" data-route="#/network/results/risk/advanced">Ver análise detalhada</a>'}</section>`;
}
