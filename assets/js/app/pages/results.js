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

function resultKind(state) {
  return state.meta?.result_kind === 'optimization' ? 'Otimização' : 'Simulação';
}

function baselineValues(state) {
  const baseline = selectBaseline(state);
  return {
    name: baseline?.model?.scenario_name || 'Referência',
    id: baseline?.model?.scenario_id || 'baseline',
    costs: baseline?.costs?.costs || {},
    model: baseline?.model || {},
  };
}

function candidateRows(state) {
  const optimizer = state.data?.optimizer;
  const ranked = optimizer?.best_scenarios || [];
  const candidates = ranked.length ? ranked : optimizer?.scored_scenarios || [];
  const select = `<label class="ni-workspace-field"><span>Alternativa</span><select id="niManualScenarioSelect" data-testid="manual-scenario-selector">${candidates
    .slice(0, 200)
    .map(
      (candidate, index) =>
        `<option value="${escapeHtml(candidate.scenario_id)}">${escapeHtml(candidate.scenario_name || candidate.scenario?.scenario_name || `Alternativa ${index + 1}`)}</option>`
    )
    .join('')}</select></label>`;
  const action = candidates.length
    ? `<div class="ni-actions"><button type="button" class="ni-button primary" data-action="run-decision-manual">Avaliar alternativa selecionada</button></div>`
    : '';
  const rows = candidates.map((candidate, index) => {
    const scenarioId = candidate.scenario_id;
    const scenarioName =
      candidate.scenario_name || candidate.scenario?.scenario_name || `Alternativa ${index + 1}`;
    const cost = candidate.result?.total_with_tax ?? candidate.total_with_tax;
    const risk = candidate.quality?.risk_level || candidate.risk_level;
    const cdCount = candidate.scenario?.changes?.active_cds?.length ?? candidate.active_cds?.length;
    const selected = scenarioId && scenarioId === state.context?.selected_scenario_id;
    return `<tr${selected ? ' aria-current="true"' : ''}><td>${formatNumber(index + 1)}</td><th scope="row">${escapeHtml(scenarioName)}</th><td>${cost == null ? '—' : escapeHtml(formatBRL(cost, true))}</td><td>${cdCount == null ? '—' : escapeHtml(formatNumber(cdCount))}</td><td>${candidate.final_score == null ? '—' : escapeHtml(formatNumber(candidate.final_score, 2))}</td><td>${escapeHtml(businessLabel(risk))}</td><td>${scenarioId && !selected ? `<button type="button" class="ni-button secondary" data-action="select-compared-scenario" data-scenario-id="${escapeHtml(scenarioId)}">Selecionar</button>` : selected ? 'Selecionada' : '—'}</td></tr>`;
  });
  return { candidates, select, action, rows };
}

export function renderResultsSummary(state) {
  const decision = selectDecision(state);
  const result = decision.result;
  const scenario = decision.scenario || selectActiveScenario(state);
  const baseline = baselineValues(state);
  const kind = resultKind(state);
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
      ? `<section class="ni-workspace-alert ni-workspace-alert--negative" role="alert" data-testid="decision-blocked"><h2>Não foi possível concluir a otimização</h2>${issues.length ? `<ul>${issues.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : `<p>${escapeHtml(decision.recommendation?.executive_summary || 'Revise as restrições e execute novamente.')}</p>`}<a href="#/network/trust/validation" data-route="#/network/trust/validation">Ver verificações</a></section>`
      : emptyState('Simule um cenário ou execute uma otimização para gerar resultados.');
    return `<section class="ni-workspace ni-workspace-page ni-results" data-testid="page-results-summary"><header class="ni-page-heading"><h1>Resultados</h1></header>${sectionTabs('results', state.ui?.route)}${message}<div class="ni-actions"><a class="ni-button primary" href="#/network/scenarios/build" data-route="#/network/scenarios/build">Ir para simulação</a><a class="ni-button secondary" href="#/network/optimizer/configure" data-route="#/network/optimizer/configure">Ir para otimização</a></div></section>`;
  }

  const currentCosts = result.costs || {};
  const taxUnavailable =
    state.context?.provider_kind === 'mock' &&
    selectBaseline(state)?.tax_results?.tax_results?.tax_coverage?.eligible_flow_count === 0;
  const total = result.total_with_tax ?? currentCosts.total_with_tax;
  const referenceTotal = baseline.costs.total_with_tax;
  const totalDelta =
    total == null || referenceTotal == null ? null : Number(total) - Number(referenceTotal);
  const saving = totalDelta == null ? null : -totalDelta;
  const savingPct =
    saving == null || Number(referenceTotal) === 0 ? null : (saving / Number(referenceTotal)) * 100;
  const activeCdCount = scenario?.changes?.active_cds?.length;
  const rows = COST_COMPONENTS.map(([key, label]) => {
    if (taxUnavailable && key === 'tax_impact')
      return '<tr><th scope="row">Tributos · sem base elegível</th><td>—</td><td>—</td><td>—</td></tr>';
    if (taxUnavailable && key === 'total_with_tax') label = 'Total logístico';
    const value = currentCosts[key];
    const reference = baseline.costs[key];
    const delta = value == null || reference == null ? null : Number(value) - Number(reference);
    return `<tr><th scope="row">${label}</th><td>${value == null ? '—' : escapeHtml(formatBRL(value))}</td><td>${reference == null ? '—' : escapeHtml(formatBRL(reference))}</td><td>${delta == null ? '—' : escapeHtml(formatBRL(delta))}</td></tr>`;
  });
  const ranked = candidateRows(state);
  const ranking = state.data?.optimizer
    ? `<section class="ni-results-ranking ni-workspace-ranking" data-testid="optimizer-ranking"><header class="ni-workspace-section-heading"><h2>Alternativas da otimização</h2></header>${table(['Posição', 'Alternativa', 'Custo total', 'CDs ativos', 'Score', 'Risco', 'Ação'], ranked.rows, 'Nenhuma alternativa elegível.')}<details class="ni-workspace-advanced"><summary>Avaliar seleção manual</summary><div class="ni-results-decision">${ranked.select}${ranked.action}</div></details></section>`
    : '';
  const blocked =
    ['blocked', 'failed', 'not_recommended'].includes(
      decision.recommendation?.recommendation_status
    ) || decision.final_qa?.final_qa_status === 'failed';
  const alert = blocked
    ? `<section class="ni-workspace-alert ni-workspace-alert--negative" role="status"><strong>${escapeHtml(businessLabel(decision.recommendation?.recommendation_status || decision.final_qa?.final_qa_status))}</strong><p>Consulte Dados e metodologia para ver as ressalvas que impedem uma decisão segura.</p><a class="ni-text-link" href="#/network/trust/overview" data-route="#/network/trust/overview">Ver decisão e confiabilidade →</a></section>`
    : '';
  const exportFiles = decision.export_package?.files || [];
  const actions = `<details class="ni-workspace-secondary-analytics"><summary>Salvar, exportar e verificar</summary><div class="ni-actions">${state.data?.selected_scenario && result ? '<button type="button" class="ni-button secondary" data-action="save-current-scenario" data-testid="scenario-save">Salvar cenário</button><button type="button" class="ni-button secondary" data-action="export-current-scenario" data-testid="scenario-export">Exportar cenário JSON</button>' : ''}${exportFiles.length ? '<button type="button" class="ni-button secondary" data-action="open-export">Abrir pacote de entrega</button>' : ''}<a class="ni-button secondary" href="#/network/trust/validation" data-route="#/network/trust/validation">Ver verificações</a></div></details>`;
  const summary = `<section class="ni-results-summary"><div class="ni-results-decision"><div><span class="ni-results-kind">${kind}</span><h2>${escapeHtml(scenario.scenario_name || 'Cenário avaliado')}</h2><p>Comparado com ${escapeHtml(baseline.name)}</p></div><div class="ni-results-impact"><span>${taxUnavailable ? 'Economia logística' : 'Economia ante a referência'}</span><strong>${saving == null ? '—' : escapeHtml(formatBRL(saving, true))}</strong><small>${savingPct == null ? '—' : escapeHtml(formatPct(savingPct))}</small></div></div><div class="ni-workspace-kpis ni-results-metrics">${kpi(taxUnavailable ? 'Custo logístico' : 'Custo total', total == null ? '—' : formatBRL(total, true), '', 'result-total')}${kpi('Referência', referenceTotal == null ? '—' : formatBRL(referenceTotal, true))}${kpi('CDs ativos', activeCdCount == null ? '—' : formatNumber(activeCdCount))}${kpi('Estado', businessLabel(result.calculation_status || result.simulation_status || state.meta?.status))}</div></section>`;
  const trustLink = `<p class="ni-results-trust-link"><span>Confiabilidade e decisão</span><a class="ni-text-link" href="#/network/trust/overview" data-route="#/network/trust/overview">Ver dados, ressalvas e método →</a></p>`;
  return `<section class="ni-workspace ni-workspace-page ni-results" data-testid="page-results-summary"><header class="ni-page-heading"><h1>Resultados</h1></header>${sectionTabs('results', state.ui?.route)}${summary}${blocked ? alert : ''}<section class="ni-workspace-panel ni-results-reference"><h2>Custos e comparação</h2>${table(['Componente', 'Resultado', 'Referência', 'Diferença'], rows)}</section>${ranking}${trustLink}${actions}</section>`;
}

export function comparisonCandidates(state) {
  const decision = selectDecision(state);
  const baseline = baselineValues(state);
  const comparison = decision.comparison?.comparison || [];
  const candidates =
    state.data?.optimizer?.best_scenarios || state.data?.optimizer?.scored_scenarios || [];
  const byId = new Map();
  if (baseline.id && baseline.costs.total_with_tax != null) {
    byId.set(baseline.id, {
      scenario_id: baseline.id,
      scenario_name: 'Referência',
      total_with_tax: baseline.costs.total_with_tax,
      active_cds_count: baseline.model.active_cds?.length,
      status: 'baseline',
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
      active_cds_count: row.scenario?.changes?.active_cds?.length ?? row.active_cds?.length,
      risk_level: row.quality?.risk_level,
    });
  }
  const selected = decision.scenario;
  if (selected?.scenario_id && !byId.has(selected.scenario_id)) {
    byId.set(selected.scenario_id, {
      scenario_id: selected.scenario_id,
      scenario_name: selected.scenario_name,
      total_with_tax: decision.result?.total_with_tax,
      active_cds_count: selected.changes?.active_cds?.length,
      risk_level: decision.quality?.risk_level,
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
  const candidates = rows.filter((row) => row.scenario_id !== baseline.id);
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
    ['Risco', (row) => escapeHtml(businessLabel(row.risk_level || row.quality?.risk_level))],
    [
      'Robustez',
      (row) => {
        const value = row.robustness_score ?? row.robustness?.robustness_score;
        return value == null ? '—' : `${escapeHtml(formatNumber(value, 0))}/100`;
      },
    ],
    [
      'Cobertura fiscal',
      (row) => {
        const value =
          row.complete_fiscal_coverage_ratio ??
          row.tax_coverage?.complete_fiscal_coverage_ratio ??
          row.result?.tax_results?.tax_coverage?.complete_fiscal_coverage_ratio;
        return value == null
          ? '—'
          : escapeHtml(formatPct(Number(value) > 1 ? Number(value) : Number(value) * 100));
      },
    ],
  ];
  const body = rows.length
    ? `<div class="ni-workspace-matrix-wrap"><table class="ni-workspace-matrix"><thead><tr><th scope="col">Indicador</th>${headings}</tr></thead><tbody>${metrics.map(([label, render]) => `<tr><th scope="row">${label}</th>${rows.map((row) => `<td class="${row.scenario_id === activeId ? 'is-selected' : ''}">${render(row)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="ni-comparison-cards">${rows.map((row) => `<article class="ni-comparison-card${row.scenario_id === activeId ? ' is-selected' : ''}"><h2>${escapeHtml(row.scenario_id === baseline.id ? 'Referência' : row.scenario_name || 'Alternativa')}</h2><dl>${metrics.map(([label, render]) => `<div><dt>${label}</dt><dd>${render(row)}</dd></div>`).join('')}</dl></article>`).join('')}</div>`
    : emptyState('Execute uma simulação ou otimização para comparar alternativas.');
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
      ? `<section class="ni-workspace-panel ni-results-comparison-chart"><h2>Custo total por alternativa</h2><canvas id="niComparisonCostChart" class="ni-chart" role="img" aria-label="Gráfico de barras comparando o custo total da referência e das alternativas disponíveis"></canvas><p class="ni-note">A tabela abaixo mantém os valores exatos e os demais indicadores.</p></section>`
      : '';
  return `<section class="ni-workspace ni-workspace-page ni-results-comparison" data-testid="page-results-comparison"><header class="ni-page-heading"><h1>Comparação</h1></header>${sectionTabs('results', state.ui?.route)}${chart}<section class="ni-workspace-panel">${body}${selectActions ? `<div class="ni-actions">${selectActions}</div>` : ''}</section></section>`;
}

function renderTradeoffScatter(candidates) {
  const points = candidates
    .map((row, index) => ({
      position: index + 1,
      id: row.scenario_id,
      name: row.scenario_name || row.scenario_id,
      cost: row.result?.total_with_tax ?? row.total_with_tax,
      score: row.final_score,
    }))
    .filter(
      (point) =>
        point.id &&
        point.cost != null &&
        point.score != null &&
        Number.isFinite(Number(point.cost)) &&
        Number.isFinite(Number(point.score))
    )
    .map((point) => ({ ...point, cost: Number(point.cost), score: Number(point.score) }));
  if (!points.length) return emptyState('Não há alternativas com custo e score disponíveis.');
  const width = 640;
  const height = 330;
  const left = 84;
  const right = 20;
  const top = 24;
  const bottom = 58;
  const minX = Math.min(...points.map((point) => point.cost));
  const maxX = Math.max(...points.map((point) => point.cost));
  const minY = Math.min(...points.map((point) => point.score));
  const maxY = Math.max(...points.map((point) => point.score));
  const xRange = maxX - minX || Math.max(Math.abs(maxX) * 0.08, 1);
  const yRange = maxY - minY || 1;
  const x = (value) =>
    left + ((value - (minX - xRange * 0.06)) / (xRange * 1.12)) * (width - left - right);
  const y = (value) =>
    top + (1 - (value - (minY - yRange * 0.08)) / (yRange * 1.16)) * (height - top - bottom);
  const ticks = Array.from({ length: 5 }, (_, i) => {
    const cost = minX + ((maxX - minX) * i) / 4;
    const score = minY + ((maxY - minY) * i) / 4;
    return `<text class="ni-workspace-scatter-tick" x="${x(cost)}" y="${height - bottom + 20}" text-anchor="middle">${escapeHtml(formatBRL(cost, true))}</text><text class="ni-workspace-scatter-tick" x="${left - 12}" y="${y(score) + 4}" text-anchor="end">${escapeHtml(formatNumber(score, 1))}</text>`;
  }).join('');
  const circles = points
    .map(
      (point) =>
        `<g class="ni-workspace-scatter-point"><title>${escapeHtml(point.name)} · ${escapeHtml(formatBRL(point.cost))} · Score ${escapeHtml(formatNumber(point.score, 2))}</title><circle cx="${x(point.cost)}" cy="${y(point.score)}" r="8"/><text x="${x(point.cost)}" y="${y(point.score) - 12}" text-anchor="middle">${point.position}</text></g>`
    )
    .join('');
  return `<svg class="ni-workspace-scatter" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="resultsTradeoffTitle"><title id="resultsTradeoffTitle">Custo total comparado ao score; números correspondem às alternativas da tabela</title><line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}"/><line x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}"/>${ticks}${circles}<text x="${(left + width - right) / 2}" y="${height - 10}" text-anchor="middle">Custo total (R$)</text><text transform="translate(18 ${(top + height - bottom) / 2}) rotate(-90)" text-anchor="middle">Score</text></svg>`;
}

export function renderResultsTradeoffs(state) {
  const optimizer = state.data?.optimizer;
  const candidates = optimizer?.scored_scenarios?.length
    ? optimizer.scored_scenarios
    : optimizer?.best_scenarios || [];
  const selected = state.data?.selected_scenario?.scenario_id;
  const rows = candidates.map(
    (row, index) =>
      `<tr><td>${formatNumber(index + 1)}</td><th scope="row">${escapeHtml(row.scenario_name || `Alternativa ${index + 1}`)}</th><td>${row.result?.total_with_tax == null ? '—' : escapeHtml(formatBRL(row.result.total_with_tax, true))}</td><td>${row.final_score == null ? '—' : escapeHtml(formatNumber(row.final_score, 2))}</td><td>${escapeHtml(businessLabel(row.quality?.risk_level))}</td><td>${row.scenario_id && row.scenario_id !== selected ? `<button type="button" class="ni-button secondary" data-action="select-compared-scenario" data-scenario-id="${escapeHtml(row.scenario_id)}">Selecionar</button>` : row.scenario_id === selected ? 'Selecionada' : '—'}</td></tr>`
  );
  return `<section class="ni-workspace ni-workspace-page ni-results-tradeoffs" data-testid="page-results-tradeoffs"><header class="ni-page-heading"><h1>Alternativas e compromissos</h1></header>${sectionTabs('results', state.ui?.route)}${optimizer ? `<section class="ni-workspace-panel"><h2>Custo total e score</h2>${renderTradeoffScatter(candidates)}</section>${table(['Posição', 'Alternativa', 'Custo total', 'Score', 'Risco', 'Ação'], rows, 'Nenhuma alternativa disponível.')}` : emptyState('Execute uma otimização para comparar os compromissos entre as alternativas.')}</section>`;
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
      ? `<p class="ni-workspace-alert ni-workspace-alert--positive">${formatNumber(risk.stress?.summary?.cases_positive ?? validStress.length)} de ${formatNumber(validStress.length)} casos válidos mantiveram economia.</p>`
      : `<p class="ni-note">Casos de estresse indisponíveis.</p>`;
  const noRisk = !monteCarlo.summary && !risk.stress && !risk.robustness;
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
    return `${emptyState(decision.result ? 'Calcule o risco com as premissas abaixo.' : 'Execute uma simulação ou otimização para consultar a análise de risco.')}${decision.result ? controls : ''}`;
  }
  const kpis = `<div class="ni-workspace-kpis">${kpi('Probabilidade de economia', summary.probability_saving_positive == null ? '—' : formatPct(summary.probability_saving_positive * 100))}${kpi('Robustez', risk.robustness?.robustness_score == null ? '—' : `${formatNumber(risk.robustness.robustness_score, 0)}/100`)}${kpi('Economia · P10', summary.p10_saving_pct == null ? '—' : formatPct(summary.p10_saving_pct))}${kpi('Economia · mediana', summary.median_saving_pct == null ? '—' : formatPct(summary.median_saving_pct))}</div>`;
  const stressTable = advanced
    ? table(
        ['Caso', 'Custo total', 'Economia', 'Estado', 'Uso'],
        stress.map(
          (row) =>
            `<tr><td>${escapeHtml(row.case_name || '—')}</td><td>${row.total_with_tax == null ? '—' : escapeHtml(formatBRL(row.total_with_tax, true))}</td><td>${row.saving_pct == null ? '—' : escapeHtml(formatPct(row.saving_pct))}</td><td>${escapeHtml(businessLabel(row.status))}</td><td>${escapeHtml(businessLabel(row.decision_use || row.data_quality_status))}</td></tr>`
        ),
        'Resultados de estresse indisponíveis.'
      )
    : '';
  const metadata = advanced
    ? `<details class="ni-workspace-secondary-analytics"><summary>Detalhes do cálculo</summary><dl class="ni-workspace-metadata"><div><dt>Iterações válidas</dt><dd>${escapeHtml(formatNumber(summary.iterations_valid ?? summary.iterations))}</dd></div><div><dt>Perfil</dt><dd>${escapeHtml(businessLabel(summary.profile || monteCarlo.config?.profile))}</dd></div><div><dt>Fonte da incerteza</dt><dd>${escapeHtml(businessLabel(monteCarlo.uncertainty_source || summary.uncertainty_source))}</dd></div><div><dt>Uso</dt><dd>${escapeHtml(businessLabel(monteCarlo.decision_use || summary.decision_use))}</dd></div></dl></details>`
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
  return `<section class="ni-workspace ni-workspace-page ni-results-risk" data-testid="page-results-risk"><header class="ni-page-heading"><h1>Resultados · Risco</h1>${scenario ? `<p>${escapeHtml(scenario.scenario_name || 'Cenário analisado')}</p>` : ''}</header>${sectionTabs('results', state.ui?.route)}${renderRiskAnalysis(state, advanced)}${advanced ? '' : '<a class="ni-button secondary" href="#/network/results/risk/advanced" data-route="#/network/results/risk/advanced">Ver análise detalhada</a>'}</section>`;
}
