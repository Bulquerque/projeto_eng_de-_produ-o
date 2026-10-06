import {
  selectActiveScenario,
  selectBaseline,
  selectDecision,
  selectScenarios,
} from '../selectors/business-selectors.js';
import {
  card,
  emptyState,
  escapeHtml,
  formatBRL,
  formatNumber,
  formatPct,
  kpi,
  sectionTabs,
  statusChip,
  table,
} from '../view-helpers.js';
import { calculateSaving, MODEL_DEFAULTS } from '../../core/model-configuration.js';
import {
  resolveTaxModeForRegime,
  resolveTaxRegime,
  taxRegimeLabel,
} from '../../core/tax-reform-config.js';

function finiteValue(value) {
  const number = Number(value);
  return value != null && Number.isFinite(number) ? number : null;
}

const COST_LABELS = {
  transfer_cost: 'Transferência',
  distribution_cost: 'Distribuição',
  storage_cost: 'Armazenagem',
  inventory_cost: 'Estoque',
  tax_impact: 'Impacto tributário',
  total_with_tax: 'Total com tributos',
};

const STATUS_LABELS = {
  success: 'Calculado',
  succeeded: 'Calculado',
  passed: 'Aprovado',
  failed: 'Falhou',
  blocked: 'Bloqueado',
  warning: 'Atenção',
  baseline: 'Baseline',
  better_than_baseline: 'Melhor que o baseline',
  worse_than_baseline: 'Pior que o baseline',
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
};

function statusLabel(value) {
  return STATUS_LABELS[String(value || '').toLowerCase()] || value || '—';
}

export function renderScenarioBuild(state) {
  const base = selectBaseline(state)?.model || {};
  const currentScenario = selectActiveScenario(state);
  const draft = state.ui.scenario_draft || currentScenario || {};
  const changes = draft.changes || {};
  const inventoryDays =
    changes.inventory_days ?? base.inventory_days ?? MODEL_DEFAULTS.inventory_days;
  const wacc = changes.wacc ?? base.wacc ?? base.reference_wacc ?? MODEL_DEFAULTS.reference_wacc;
  const eligibleCds = [
    ...new Set(
      [
        ...(Array.isArray(base.eligible_cds) ? base.eligible_cds : []),
        ...(Array.isArray(base.active_cds) ? base.active_cds : []),
        ...(Array.isArray(selectBaseline(state)?.flows)
          ? selectBaseline(state)
              .flows.map((flow) => flow.cd ?? flow.cd_id)
              .filter(Boolean)
          : []),
      ].map(String)
    ),
  ];
  const active = Array.isArray(changes.active_cds) ? changes.active_cds : base.active_cds || [];
  const activeCdSet = new Set(active.map(String));
  const saved = state.data.saved_scenarios || [];
  const savedIds = new Set(saved.map((scenario) => scenario.scenario_id));
  const library = selectScenarios(state).filter((scenario) => !savedIds.has(scenario.scenario_id));
  const lastCalculatedResult = state.data.scenario_result || currentScenario?.result || null;
  const hasCurrentResult = Boolean(lastCalculatedResult);
  const draftDirty = Boolean(state.ui.scenario_draft_dirty);
  const lastCalculatedScenarioId =
    lastCalculatedResult?.scenario_id ||
    state.context?.selected_scenario_id ||
    currentScenario?.scenario_id;
  const currentTotal =
    lastCalculatedResult?.total_with_tax ?? lastCalculatedResult?.costs?.total_with_tax;
  const currentComparison = selectDecision(state).comparison?.comparison?.find(
    (row) => row.scenario_id === lastCalculatedScenarioId
  );
  const currentSaving =
    currentComparison?.saving_pct ??
    (selectDecision(state).comparison?.comparison?.length === 1
      ? selectDecision(state).comparison?.saving_pct
      : null);
  const lastCalculatedScenario =
    selectScenarios(state).find((scenario) => scenario.scenario_id === lastCalculatedScenarioId) ||
    currentScenario;
  const previewName =
    draft.scenario_name || lastCalculatedScenario?.scenario_name || 'Cenário manual';
  const demoOnly = state.context.provider_kind === 'mock';
  const demoLock = demoOnly ? ' disabled' : '';
  const field = (value) => escapeHtml(value ?? '');
  const taxYear = changes.tax_year == null ? null : Number(changes.tax_year);
  const taxRegime = resolveTaxRegime({
    taxMode: changes.tax_mode,
    taxRegime: changes.tax_regime,
    year: taxYear,
  });
  const taxMode = changes.tax_mode || resolveTaxModeForRegime(taxRegime);
  const taxYearInput = Number.isInteger(taxYear)
    ? `<input type="hidden" name="tax_year" value="${escapeHtml(taxYear)}">`
    : '';
  const taxModeSelect = `<label>Modo tributário<select name="tax_mode"${demoLock}><option value="current"${taxMode === 'current' ? ' selected' : ''}>Atual</option><option value="disabled"${taxMode === 'disabled' ? ' selected' : ''}>Desligado</option>${taxMode !== 'current' && taxMode !== 'disabled' ? `<option value="${escapeHtml(taxMode)}" selected>${escapeHtml(taxRegimeLabel(taxRegime))}</option>` : ''}</select></label>`;
  const libraryRows = library.map(
    (scenario) =>
      `<tr><td>${escapeHtml(scenario.scenario_id)}</td><td>${escapeHtml(scenario.scenario_name || '—')}</td><td>${escapeHtml(scenario.scenario_type || '—')}</td><td><button type="button" class="ni-button secondary" data-action="load-scenario" data-scenario-id="${escapeHtml(scenario.scenario_id)}" data-testid="scenario-load-${escapeHtml(scenario.scenario_id)}">Carregar</button></td></tr>`
  );
  const savedRows = saved.map(
    (scenario) =>
      `<tr><td>${escapeHtml(scenario.scenario_id)}</td><td>${escapeHtml(scenario.scenario_name || '—')}</td><td><button type="button" class="ni-button secondary" data-action="load-scenario" data-scenario-id="${escapeHtml(scenario.scenario_id)}" data-testid="saved-scenario-load-${escapeHtml(scenario.scenario_id)}">Carregar</button> <button type="button" class="ni-button secondary" data-action="delete-saved-scenario" data-scenario-id="${escapeHtml(scenario.scenario_id)}" data-testid="saved-scenario-delete-${escapeHtml(scenario.scenario_id)}">Excluir</button></td></tr>`
  );
  return `<div class="ni-page-heading" data-testid="page-scenarios-build"><p class="ni-eyebrow">Cenários · Construção</p><h1>Construir cenário</h1></div><section class="ni-preview-card" data-testid="scenario-preview"><div><p class="ni-eyebrow">Rascunho</p><h2>${escapeHtml(previewName)}</h2><p data-testid="scenario-draft-status" role="status">${draftDirty ? `Alterações pendentes. Exibindo o último resultado calculado${lastCalculatedScenario ? ` para ${escapeHtml(lastCalculatedScenario.scenario_name || lastCalculatedScenario.scenario_id)}` : ''}.` : hasCurrentResult ? `Último resultado: ${escapeHtml(lastCalculatedScenario?.scenario_name || lastCalculatedScenario?.scenario_id || 'cenário selecionado')}.` : 'Ainda não há resultado calculado.'}</p></div><div class="ni-preview-metrics"><div class="ni-preview-metric"><span>Total calculado</span><strong>${currentTotal == null ? '—' : formatBRL(currentTotal, true)}</strong></div><div class="ni-preview-metric"><span>Saving calculado</span><strong>${currentSaving == null ? '—' : formatPct(currentSaving)}</strong></div><div class="ni-preview-metric"><span>CDs no rascunho</span><strong>${formatNumber(active.length)}</strong></div></div></section><form id="niScenarioForm" class="ni-card ni-form" data-testid="scenario-form" novalidate>${taxYearInput}<label>Nome<input name="scenario_name" value="${field(draft.scenario_name || currentScenario?.scenario_name || 'Cenário manual')}" required${demoLock}></label><div class="ni-form-grid"><label>Multiplicador de frete<input name="freight_multiplier" type="number" min="0.1" step="0.01" value="${field(changes.freight_multiplier ?? 1)}"${demoLock}></label><label>Multiplicador de demanda<input name="demand_multiplier" type="number" min="0.1" step="0.01" value="${field(changes.demand_multiplier ?? 1)}"${demoLock}></label></div><details><summary>Centros de distribuição</summary><fieldset><legend>CDs ativos</legend><p>Selecione os CDs do rascunho.</p><div class="ni-checkbox-grid">${eligibleCds.map((cd) => `<label><input type="checkbox" name="active_cds" value="${escapeHtml(cd)}"${activeCdSet.has(cd) ? ' checked' : ''}${demoLock}>${escapeHtml(cd)}</label>`).join('') || '<p>Nenhum CD elegível foi informado pelo baseline.</p>'}</div></fieldset></details><details><summary>Parâmetros de estoque e tributos</summary><div class="ni-form-grid"><label>Dias de estoque<input name="inventory_days" type="number" min="0" step="1" value="${field(changes.inventory_days ?? inventoryDays)}"${demoLock}></label><label>WACC<input name="wacc" type="number" min="0" step="0.01" value="${field(changes.wacc ?? wacc)}"${demoLock}></label>${taxModeSelect}</div></details><div class="ni-actions"><button type="submit" class="ni-button primary" data-testid="scenario-run">${demoOnly ? 'Exibir resultado' : 'Simular cenário'}</button><button type="button" class="ni-button secondary" data-action="reset-scenario-draft">Repor baseline</button>${hasCurrentResult && !draftDirty ? '<a class="ni-button secondary" href="#/network/results/summary" data-route="#/network/results/summary">Ver resultados</a>' : ''}</div><details><summary>Salvar, exportar ou importar</summary><div class="ni-actions"><button type="button" class="ni-button secondary" data-action="save-current-scenario" data-testid="scenario-save"${hasCurrentResult && !draftDirty ? '' : ' disabled'}>Salvar último resultado</button><button type="button" class="ni-button secondary" data-action="export-current-scenario" data-testid="scenario-export"${hasCurrentResult && !draftDirty ? '' : ' disabled'}>Exportar último resultado</button><label class="ni-button secondary" for="networkScenarioImport">Importar JSON<input id="networkScenarioImport" type="file" accept="application/json,.json" hidden data-testid="scenario-import"></label></div></details></form><details class="ni-card" data-testid="scenario-library"><summary>Biblioteca de cenários</summary>${table(['ID', 'Nome', 'Tipo', 'Ação'], libraryRows, 'Nenhuma amostra carregada.')}</details><details class="ni-card" data-testid="saved-scenarios"><summary>Cenários salvos por empresa</summary><div class="ni-actions"><button type="button" class="ni-button secondary" data-action="clear-saved-scenarios" data-testid="scenario-clear-saved"${saved.length ? '' : ' disabled'}>Limpar salvos</button></div>${table(['ID', 'Nome', 'Ações'], savedRows, 'Nenhum cenário salvo nesta empresa.')}</details>`;
}

export function renderScenarioResult(state) {
  const decision = selectDecision(state);
  const selected = selectActiveScenario(state);
  const result = decision.result;
  if (!selected || !result)
    return `<div class="ni-page-heading" data-testid="page-scenarios-result"><h1>Resultado do cenário</h1></div>${sectionTabs('scenarios', state.ui.route)}${emptyState('Execute uma simulação antes de abrir esta página.')}`;
  const quality = selected.quality || state.data.scenario_quality || result.quality || {};
  const comparisonRow = decision.comparison?.comparison?.find(
    (row) => row.scenario_id === selected.scenario_id
  );
  const savingPct = decision.comparison?.saving_pct ?? comparisonRow?.saving_pct;
  const hasRisk = Boolean(decision.risk.monte_carlo || decision.risk.stress);
  return `<div class="ni-page-heading" data-testid="page-scenarios-result"><p class="ni-eyebrow">Cenários · Resultado</p><h1>${escapeHtml(selected.scenario_name || selected.scenario_id)}</h1><p>${statusChip(result.calculation_status || result.simulation_status, statusLabel(result.calculation_status || result.simulation_status))} · ${escapeHtml(result.company_id)}</p></div>${sectionTabs('scenarios', state.ui.route)}<div class="ni-kpi-grid">${kpi('Total', formatBRL(result.total_with_tax, true))}${kpi('Saving', formatPct(savingPct))}${kpi('Qualidade', quality.quality_score == null ? '—' : `${quality.quality_score}/100`)}${kpi('Risco', statusLabel(quality.risk_level))}</div><div class="ni-grid two">${card(
    'Custos',
    table(
      ['Componente', 'Valor'],
      Object.entries(result.costs || {})
        .filter(([key]) =>
          [
            'transfer_cost',
            'distribution_cost',
            'storage_cost',
            'inventory_cost',
            'tax_impact',
            'total_with_tax',
          ].includes(key)
        )
        .map(
          ([key, value]) =>
            `<tr><td>${escapeHtml(COST_LABELS[key] || key)}</td><td>${escapeHtml(formatBRL(value))}</td></tr>`
        )
    )
  )}${card('Evidence', result.evidence ? `<p>${escapeHtml(result.evidence.evidence_status || '—')}</p><strong>${result.evidence.evidence_score == null ? '—' : `${result.evidence.evidence_score}/100`}</strong><ul class="ni-list">${(result.evidence.blockers || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : emptyState('Evidence ainda não disponível.'))}</div><div class="ni-actions"><a class="ni-button secondary" href="#/network/scenarios/compare" data-route="#/network/scenarios/compare">Comparar</a>${hasRisk ? '<a class="ni-button secondary" href="#/network/scenarios/risk" data-route="#/network/scenarios/risk">Abrir risco</a>' : '<button type="button" class="ni-button secondary" data-action="run-risk">Calcular risco</button>'}</div>`;
}

export function renderScenarioCompare(state) {
  const decision = selectDecision(state);
  const comparison = decision.comparison?.comparison || [];
  const baseline = selectBaseline(state);
  const baselineModel = baseline?.model || {};
  const baselineTotal = finiteValue(baseline?.costs?.costs?.total_with_tax);
  const baselineId = baselineModel.scenario_id || (baseline ? 'baseline' : null);
  const selectedScenarioId = selectActiveScenario(state)?.scenario_id;
  const rowsById = new Map();

  if (baseline && Number.isFinite(baselineTotal)) {
    rowsById.set(baselineId || 'baseline', {
      scenario_id: baselineId || 'baseline',
      scenario_name: 'Baseline',
      total_with_tax: baselineTotal,
      saving_abs: 0,
      saving_pct: 0,
      active_cds_count: baselineModel.active_cds?.length,
      status: 'baseline',
    });
  }

  for (const row of comparison) {
    if (row.scenario_id) rowsById.set(row.scenario_id, row);
  }

  const companyId = state.context?.company_id;
  const scenarioById = new Map(
    selectScenarios(state)
      .filter((scenario) => scenario.company_id === companyId)
      .map((scenario) => [scenario.scenario_id, scenario])
  );
  const candidates = new Map();
  for (const scenario of scenarioById.values()) candidates.set(scenario.scenario_id, scenario);
  for (const candidate of decision.optimizer?.best_scenarios || []) {
    if (candidate.company_id && candidate.company_id !== companyId) continue;
    const registered = scenarioById.get(candidate.scenario_id);
    if (!candidate.scenario_id || rowsById.has(candidate.scenario_id)) continue;
    const candidateResult = candidate.result;
    const candidateResultAllowed =
      candidateResult && (!candidateResult.company_id || candidateResult.company_id === companyId);
    const result = candidateResultAllowed ? candidateResult : registered?.result;
    if (result?.company_id && result.company_id !== companyId) continue;
    candidates.set(candidate.scenario_id, {
      ...registered,
      ...candidate,
      result,
      scenario: candidate.scenario || registered,
      scenario_name: candidate.scenario_name || registered?.scenario_name,
      quality: candidate.quality || registered?.quality,
    });
  }
  for (const candidate of candidates.values()) {
    if (!candidate.scenario_id || rowsById.has(candidate.scenario_id)) continue;
    const total = finiteValue(
      candidate.result?.total_with_tax ??
        candidate.result?.costs?.total_with_tax ??
        candidate.total_with_tax
    );
    const providedSavingAbs = finiteValue(candidate.saving_abs ?? candidate.result?.saving_abs);
    const saving =
      providedSavingAbs != null || total == null || baselineTotal == null
        ? null
        : calculateSaving({ baselineTotal, scenarioTotal: total });
    const savingAbs = providedSavingAbs ?? saving?.saving_abs ?? null;
    const savingPct =
      finiteValue(candidate.saving_pct ?? candidate.result?.saving_pct) ??
      saving?.saving_pct ??
      null;
    rowsById.set(candidate.scenario_id, {
      ...candidate,
      scenario_name:
        candidate.scenario_name ||
        candidate.scenario?.scenario_name ||
        candidate.result?.scenario_name,
      total_with_tax: total,
      saving_abs: savingAbs,
      saving_pct: savingPct,
      active_cds_count:
        candidate.active_cds_count ??
        candidate.scenario?.changes?.active_cds?.length ??
        candidate.changes?.active_cds?.length ??
        null,
      status:
        savingAbs == null
          ? 'unknown'
          : savingAbs > 0
            ? 'better_than_baseline'
            : savingAbs < 0
              ? 'worse_than_baseline'
              : 'baseline',
    });
  }
  const allRows = [...rowsById.values()];
  if (!allRows.length)
    return `<section class="ni-workspace-page ni-workspace-scenarios ni-workspace-compare"><header class="ni-page-heading ni-workspace-header" data-testid="page-scenarios-compare"><p class="ni-eyebrow">07 · Cenários · Comparar</p><h1>Comparação de cenários</h1><p>Compare os resultados disponíveis com o baseline e selecione um cenário para continuar a análise.</p></header><div class="ni-workspace-tabs">${sectionTabs('scenarios', state.ui.route)}</div><div class="ni-workspace-empty">${emptyState('Nenhuma comparação disponível.')}</div></section>`;

  const alternatives = allRows.filter(
    (row) =>
      row.scenario_id !== baselineId && (row.total_with_tax != null || row.saving_abs != null)
  );
  const storedComparedIds = Array.isArray(state.ui?.compared_scenario_ids)
    ? state.ui.compared_scenario_ids
    : null;
  const defaultComparedIds = [
    ...(selectedScenarioId && selectedScenarioId !== baselineId ? [selectedScenarioId] : []),
    ...alternatives.map((row) => row.scenario_id),
  ]
    .filter((id, index, all) => all.indexOf(id) === index)
    .slice(0, 4);
  const comparedIds = new Set((storedComparedIds ?? defaultComparedIds).slice(0, 4));
  const rows = allRows.filter(
    (row) => row.scenario_id === baselineId || comparedIds.has(row.scenario_id)
  );
  const compareChoices = `<details data-testid="comparison-choice-details"><summary>Selecionar alternativas (${comparedIds.size} selecionadas)</summary><fieldset class="ni-workspace-compare-choices"><legend>Alternativas a comparar</legend><p>O baseline permanece como referência. Selecione até quatro cenários com resultado disponível.</p><div>${alternatives.map((row) => `<label><input type="checkbox" data-compare-scenario value="${escapeHtml(row.scenario_id)}"${comparedIds.has(row.scenario_id) ? ' checked' : ''}><span>${escapeHtml(row.scenario_name || row.scenario_id)}</span></label>`).join('')}</div></fieldset></details>`;
  const renderScore = (value) => (value == null ? '—' : `${escapeHtml(formatNumber(value))}/100`);
  const metricRows = [
    {
      label: 'Custo total (R$)',
      render: (row) =>
        row.total_with_tax == null ? '—' : escapeHtml(formatBRL(row.total_with_tax, true)),
    },
    {
      label: 'Economia vs baseline',
      render: (row) => (row.saving_pct == null ? '—' : escapeHtml(formatPct(row.saving_pct))),
    },
    {
      label: 'Número de CDs',
      render: (row) =>
        row.active_cds_count == null ? '—' : escapeHtml(formatNumber(row.active_cds_count)),
    },
    {
      label: 'Risco',
      render: (row) => {
        const riskLevel = row.risk_level || row.quality?.risk_level;
        const label = { low: 'Baixo', medium: 'Médio', high: 'Alto' }[riskLevel] || riskLevel;
        return riskLevel == null || riskLevel === '' ? '—' : statusChip(riskLevel, label);
      },
    },
    {
      label: 'Evidências',
      render: (row) => renderScore(row.evidence_score ?? row.result?.evidence?.evidence_score),
    },
    {
      label: 'Robustez',
      render: (row) => renderScore(row.robustness_score ?? row.robustness?.robustness_score),
    },
    {
      label: 'Cobertura fiscal',
      render: (row) => {
        const coverage =
          row.complete_fiscal_coverage_ratio ??
          row.tax_coverage?.complete_fiscal_coverage_ratio ??
          row.result?.tax_results?.tax_coverage?.complete_fiscal_coverage_ratio;
        return coverage == null
          ? '—'
          : escapeHtml(formatPct(Number(coverage) > 1 ? Number(coverage) : Number(coverage) * 100));
      },
    },
    {
      label: 'Nível de serviço',
      render: (row) => {
        const serviceLevel = row.service_level ?? row.service_level_pct;
        return serviceLevel == null
          ? '—'
          : escapeHtml(
              typeof serviceLevel === 'number' ? formatNumber(serviceLevel) : serviceLevel
            );
      },
    },
  ];
  const headerCells = rows
    .map((row) => {
      const isSelected = row.scenario_id === selectedScenarioId;
      const isBaseline = row.scenario_id === baselineId;
      const badge = isBaseline
        ? '<span class="ni-workspace-badge ni-workspace-badge--baseline">Referência</span>'
        : isSelected
          ? '<span class="ni-workspace-badge ni-workspace-badge--selected">Selecionado</span>'
          : row.rank_by_total_cost === 1
            ? '<span class="ni-workspace-badge ni-workspace-badge--best">Menor custo</span>'
            : '';
      const selectButton =
        !isBaseline && !isSelected
          ? `<button type="button" class="ni-button secondary" data-action="select-compared-scenario" data-scenario-id="${escapeHtml(row.scenario_id)}" aria-label="Selecionar cenário ${escapeHtml(row.scenario_name || row.scenario_id)}">Selecionar</button>`
          : '';
      return `<th scope="col" class="ni-workspace-scenario-heading${isSelected ? ' is-selected' : ''}${isBaseline ? ' is-baseline' : ''}"><span class="ni-workspace-scenario-name">${escapeHtml(isBaseline ? 'Baseline' : row.scenario_name || row.scenario_id || 'Cenário')}</span><small>${escapeHtml(row.scenario_id || '—')}</small>${badge}${selectButton}</th>`;
    })
    .join('');
  const bodyRows = metricRows
    .map(
      (metric) =>
        `<tr><th scope="row">${escapeHtml(metric.label)}</th>${rows
          .map((row) => {
            const isSelected = row.scenario_id === selectedScenarioId;
            const isBaseline = row.scenario_id === baselineId;
            return `<td class="ni-workspace-matrix-cell${isSelected ? ' is-selected' : ''}${isBaseline ? ' is-baseline' : ''}">${metric.render(row)}</td>`;
          })
          .join('')}</tr>`
    )
    .join('');
  const hasSavingChart = rows.some((row) => finiteValue(row.saving_abs) != null);
  const selectedRow = rows.find((row) => row.scenario_id === selectedScenarioId);
  const selectedCosts =
    selectActiveScenario(state)?.result?.costs || selectedRow?.result?.costs || selectedRow || {};
  const baselineCosts = baseline?.costs?.costs || {};
  const componentKeys = [
    'transfer_cost',
    'distribution_cost',
    'storage_cost',
    'inventory_cost',
    'tax_impact',
  ];
  const hasComponentChart = componentKeys.some(
    (key) => finiteValue(selectedCosts[key]) != null && finiteValue(baselineCosts[key]) != null
  );

  return `<section class="ni-workspace-page ni-workspace-scenarios ni-workspace-compare"><header class="ni-page-heading ni-workspace-header" data-testid="page-scenarios-compare"><div class="ni-workspace-header-copy"><p class="ni-eyebrow">07 · Cenários · Comparar</p><h1>Comparação de cenários</h1><p>Compare resultados calculados e escolha qual cenário seguirá para a avaliação de risco.</p></div><aside class="ni-workspace-header-context" aria-label="Resumo da comparação"><span>Alternativas selecionadas</span><strong>${formatNumber(rows.filter((row) => row.scenario_id !== baselineId).length)}</strong></aside></header><div class="ni-workspace-tabs">${sectionTabs('scenarios', state.ui.route)}</div>${compareChoices}<section class="ni-workspace-grid ni-workspace-decision-charts" aria-label="Saving por cenário e variação dos custos">${hasSavingChart ? '<article class="ni-card ni-workspace-panel ni-workspace-chart-panel"><canvas id="niDecisionScenarioSavingsChart" class="ni-chart" role="img" aria-label="Saving calculado de cada cenário em relação ao baseline"></canvas></article>' : '<article class="ni-card ni-workspace-panel"><p class="ni-note" role="status">Sem saving calculado disponível para comparar.</p></article>'}${hasComponentChart ? '<article class="ni-card ni-workspace-panel ni-workspace-chart-panel"><canvas id="niDecisionComponentDeltaChart" class="ni-chart" role="img" aria-label="Variação calculada por componente versus baseline"></canvas></article>' : '<article class="ni-card ni-workspace-panel"><p class="ni-note" role="status">Sem componentes de custo compatíveis entre cenário e baseline.</p></article>'}</section><section class="ni-card ni-workspace-panel ni-workspace-comparison-panel" aria-labelledby="niComparisonTitle"><header class="ni-workspace-panel-heading"><div><p class="ni-eyebrow">Comparação lado a lado</p><h2 id="niComparisonTitle">Métricas do cenário</h2></div><span class="ni-workspace-legend"><i class="ni-workspace-legend-swatch"></i> Cenário ativo</span></header><div class="ni-workspace-matrix-wrap"><table class="ni-workspace-matrix"><thead><tr><th scope="col">Métrica</th>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div></section></section>`;
}

export function renderScenarioRisk(state, advanced = false) {
  const risk = selectDecision(state).risk;
  if (!risk.monte_carlo && !risk.stress)
    return `<section class="ni-workspace-page ni-workspace-scenarios ni-workspace-risk ${advanced ? 'ni-workspace-risk-advanced' : 'ni-workspace-risk-summary'}"><header class="ni-page-heading ni-workspace-header" data-testid="page-scenarios-risk"><p class="ni-eyebrow">08 · Cenários · Risco & sensibilidade</p><h1>${advanced ? 'Risco avançado' : 'Risco e sensibilidade'}</h1><p>Explore a incerteza dos resultados e os limites observados nos testes de stress.</p></header><div class="ni-workspace-tabs">${sectionTabs('scenarios', state.ui.route)}</div><div class="ni-workspace-empty">${emptyState('Execute a decisão ou selecione um cenário para calcular risco.')}</div></section>`;
  const mc = risk.monte_carlo?.summary || {};
  const selectedScenario = selectActiveScenario(state);
  const robustness = risk.robustness || {};
  const stressResults = risk.stress?.stress_results || [];
  const validStressResults = stressResults.filter(
    (row) =>
      finiteValue(row.saving_pct) != null &&
      (row.status === 'success' ||
        (row.status == null && finiteValue(row.total_with_tax) != null && !row.errors?.length))
  );
  const adverseStress = validStressResults
    .filter((row) => row.scenario_still_better_than_baseline === false)
    .sort((a, b) => Number(a.saving_pct) - Number(b.saving_pct))[0];
  const positiveStressCount =
    risk.stress?.summary?.cases_positive ??
    validStressResults.filter((row) => row.scenario_still_better_than_baseline === true).length;
  const blockedStressCount =
    risk.stress?.summary?.cases_blocked ??
    stressResults.filter((row) => !validStressResults.includes(row)).length;
  const stressRows = (risk.stress?.stress_results || []).map(
    (row) =>
      `<tr><td>${escapeHtml(row.case_name || row.case_id || 'Caso')}</td><td>${row.total_with_tax == null ? '—' : escapeHtml(formatBRL(row.total_with_tax, true))}</td><td>${row.saving_pct == null ? '—' : escapeHtml(formatPct(row.saving_pct))}</td><td>${statusChip(row.status, statusLabel(row.status))}</td><td>${escapeHtml(row.decision_use || row.data_quality_status || '—')}</td></tr>`
  );
  const config = { ...(risk.monte_carlo?.config || {}), ...(state.ui?.risk_config || {}) };
  const stressProfile =
    config.stress_profile ||
    risk.stress?.stress_profile ||
    risk.stress?.config?.profile ||
    'standard';
  const select = (name, options, selected) =>
    `<select name="${name}">${options.map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`).join('')}</select>`;
  const driverOptions = [
    ['freight_multiplier', 'Frete'],
    ['demand_multiplier', 'Demanda'],
    ['inventory_days', 'Dias de estoque'],
    ['wacc', 'WACC'],
    ['tax_multiplier', 'Tributo'],
  ];
  const variableOptions = [
    ['freight_multiplier', 'Frete'],
    ['demand_multiplier', 'Demanda'],
    ['inventory_days', 'Dias de estoque'],
    ['wacc', 'WACC'],
  ];
  const controls = `<details class="ni-workspace-risk-settings"><summary>Configurações da simulação</summary><section class="ni-workspace-controls-panel"><header class="ni-workspace-panel-heading"><div><p class="ni-eyebrow">Configuração da análise</p><h2>Parâmetros da simulação</h2><p>Os parâmetros abaixo ajustam a análise exploratória e os testes de stress.</p></div></header><form class="ni-card ni-form ni-workspace-controls" data-testid="risk-controls" id="niRiskForm" novalidate><div class="ni-form-grid ni-workspace-form-grid"><label>Iterações<input type="number" name="iterations" min="50" max="5000" step="50" value="${escapeHtml(config.iterations || mc.iterations || 300)}"></label><label>Seed<input type="number" name="seed" step="1" value="${escapeHtml(config.seed ?? mc.seed ?? 42)}"></label><label>Perfil de incerteza${select(
    'profile',
    [
      ['balanced', 'Equilibrado'],
      ['conservative', 'Conservador'],
      ['broad', 'Amplo'],
    ],
    config.profile || 'balanced'
  )}</label><label>Variável da dispersão${select('scatter_driver', driverOptions, config.scatter_driver || mc.scatter_driver || 'freight_multiplier')}</label><label>Perfil de stress${select(
    'stress_profile',
    [
      ['standard', 'Padrão'],
      ['conservative', 'Conservador'],
    ],
    stressProfile
  )}</label><label>Sensibilidade${select('sensitivity_variable', variableOptions, risk.sensitivity?.most_sensitive_variable || 'freight_multiplier')}</label><label>Matriz X${select('sensitivity_x', variableOptions, risk.sensitivity_matrix?.x_variable || 'freight_multiplier')}</label><label>Matriz Y${select('sensitivity_y', variableOptions, risk.sensitivity_matrix?.y_variable || 'demand_multiplier')}</label></div><div class="ni-actions"><button type="submit" class="ni-button primary" data-testid="risk-run">Recalcular risco</button>${advanced ? '<a class="ni-button secondary" href="#/network/scenarios/risk" data-route="#/network/scenarios/risk">Voltar ao risco resumido</a>' : '<a class="ni-button secondary" href="#/network/scenarios/risk/advanced" data-route="#/network/scenarios/risk/advanced">Abrir risco avançado</a>'}</div></form></section></details>`;

  const chartPanel = (title, canvasId, ariaLabel, className = '', available = true) =>
    `<article class="ni-card ni-workspace-panel ni-workspace-chart-panel ${className}">${available ? `<canvas id="${canvasId}" class="ni-chart" role="img" aria-label="${escapeHtml(ariaLabel)}"></canvas>` : `<p class="ni-note" role="status" style="margin:8px 0">${escapeHtml(title)}: sem dados válidos nesta execução.</p>`}</article>`;
  const stressOverview = adverseStress
    ? `<article class="ni-workspace-alert ni-workspace-alert--negative"><p class="ni-eyebrow">Atenção · teste de stress</p><h2>Saving negativo em um cenário avaliado</h2><p>${escapeHtml(adverseStress.case_name || adverseStress.case_id || 'Caso de stress')} · saving de ${escapeHtml(formatPct(adverseStress.saving_pct))}.</p><small>${escapeHtml(adverseStress.decision_use || adverseStress.data_quality_status || 'Uso a validar conforme a cobertura dos dados.')}</small></article>`
    : validStressResults.length
      ? `<article class="ni-workspace-alert ni-workspace-alert--positive"><p class="ni-eyebrow">Leitura dos testes</p><h2>${formatNumber(positiveStressCount)} de ${formatNumber(validStressResults.length)} casos mantiveram saving</h2><p>Resultado limitado aos casos de stress válidos que foram calculados para este cenário.</p></article>`
      : `<article class="ni-workspace-alert ni-workspace-alert--neutral"><p class="ni-eyebrow">Leitura dos testes</p><h2>Sem casos válidos para resumir</h2><p>${formatNumber(blockedStressCount)} caso(s) bloqueado(s) ou sem resultado válido.</p></article>`;
  const robustnessAlerts = (robustness.alerts || []).map(
    (alert) => `<li>${escapeHtml(alert)}</li>`
  );
  const stressTable = table(
    ['Caso', 'Total com tributo', 'Saving', 'Estado', 'Uso'],
    stressRows,
    'Nenhum caso de stress disponível.'
  );
  const validIterations = mc.iterations_valid ?? mc.iterations;
  const requestedIterations =
    mc.iterations_requested ?? risk.monte_carlo?.config?.iterations ?? mc.iterations;
  const probabilityInterpretation =
    mc.probability_interpretation === 'condicional_ao_historico_disponivel_e_ao_modelo'
      ? 'A probabilidade é condicional ao histórico disponível e ao modelo.'
      : risk.monte_carlo?.uncertainty_source || mc.uncertainty_source
        ? 'A probabilidade é condicional às premissas paramétricas e ao modelo.'
        : '';
  const totalPercentileSourceNote =
    mc.total_percentile_source === 'derived_from_saving_fixture'
      ? 'A curva monetária foi derivada dos percentis de saving da fixture e do baseline calculado; não é uma medição independente.'
      : '';
  const chartDescriptions = `<p class="ni-workspace-footnote">Monte Carlo exploratório · ${escapeHtml(formatNumber(validIterations))}/${escapeHtml(formatNumber(requestedIterations))} iterações válidas/solicitadas.</p><details class="ni-chart-method" data-testid="risk-methodology"><summary>Como interpretar probabilidades e percentis</summary><p class="ni-note">A simulação é exploratória e não constitui previsão. ${probabilityInterpretation} O percentil descreve a distribuição produzida pelas premissas e pelo modelo; não representa garantia nem frequência futura observada. Mais iterações reduzem o erro numérico, mas não medem a representatividade do histórico nem a incerteza estrutural do modelo.${totalPercentileSourceNote ? ` ${totalPercentileSourceNote}` : ''}</p></details>`;
  const hasHistogram = (mc.histogram || []).some(
    (bin) => finiteValue(bin.count) != null && finiteValue(bin.count) > 0
  );
  const hasDrivers = (mc.driver_importance || []).some(
    (row) => finiteValue(row.correlation) != null
  );
  const hasStressChart = validStressResults.some((row) => finiteValue(row.saving_pct) != null);
  const hasTotalPercentiles = (mc.total_percentile_curve || []).some(
    (point) => finiteValue(point.value) != null
  );
  const hasScatter = (risk.monte_carlo?.samples || []).some(
    (sample) => finiteValue(sample.saving_pct) != null
  );
  const hasProbability = finiteValue(mc.probability_saving_positive) != null;
  const hasSensitivity = (risk.sensitivity?.sensitivity_results || []).some(
    (row) => finiteValue(row.value) != null && finiteValue(row.saving_pct) != null
  );
  const hasMatrix = (risk.sensitivity_matrix?.matrix_results || []).some(
    (row) =>
      finiteValue(row.x_value) != null &&
      finiteValue(row.y_value) != null &&
      finiteValue(row.saving_pct) != null
  );
  const summaryCharts = `<section class="ni-workspace-grid ni-workspace-risk-primary" aria-label="Resumo gráfico do risco">${chartPanel('Distribuição do saving', 'niRiskHistogramChart', 'Histograma do Monte Carlo', 'ni-workspace-chart-panel--featured', hasHistogram)}${chartPanel('Principais drivers de risco', 'niRiskDriversChart', 'Drivers mais influentes no Monte Carlo', '', hasDrivers)}${chartPanel('Saving nos testes de stress', 'niDecisionStressChart', 'Saving calculado para cada caso de stress', '', hasStressChart)}</section>`;
  const advancedCharts = `<section class="ni-workspace-grid ni-workspace-risk-advanced-grid" aria-label="Análise avançada de incerteza">
    ${chartPanel('Histograma do saving', 'niRiskHistogramChart', 'Histograma do Monte Carlo', 'ni-workspace-chart-panel--featured', hasHistogram)}
    ${chartPanel('Saving nos testes de stress', 'niDecisionStressChart', 'Saving calculado para cada caso de stress', '', hasStressChart)}
    ${chartPanel('Importância dos drivers', 'niRiskDriversChart', 'Drivers mais influentes no Monte Carlo', '', hasDrivers)}
    ${chartPanel('Sensibilidade 1D', 'niSensitivityChart', 'Sensibilidade do cenário', '', hasSensitivity)}
    <section class="ni-card ni-workspace-panel ni-workspace-matrix-panel"><header class="ni-workspace-panel-heading"><div><p class="ni-eyebrow">Sensibilidade 2D</p><h2>Saving por combinação de variáveis</h2><p>${escapeHtml(risk.sensitivity_matrix?.y_variable || 'Eixo Y')} × ${escapeHtml(risk.sensitivity_matrix?.x_variable || 'Eixo X')}</p></div></header>${hasMatrix ? renderSensitivityMatrix(risk.sensitivity_matrix) : '<p class="ni-note" role="status">Sem dados válidos para a matriz nesta execução.</p>'}</section>
  </section>
  <details class="ni-workspace-secondary-analytics"><summary>Distribuições complementares</summary><section class="ni-workspace-grid">
    ${chartPanel('Custo total por percentil', 'niRiskTotalChart', 'Curva do custo total do Monte Carlo', '', hasTotalPercentiles)}
    ${chartPanel('Driver × saving', 'niRiskScatterChart', 'Relação entre driver e saving', '', hasScatter)}
    ${chartPanel('Probabilidade de saving', 'niRiskProbabilityChart', 'Probabilidade de saving positivo', '', hasProbability)}
  </section></details>`;
  const metadata = `<dl class="ni-workspace-metadata"><div><dt>Iterações válidas</dt><dd>${escapeHtml(formatNumber(mc.iterations_valid ?? mc.iterations))}</dd></div><div><dt>Perfil</dt><dd>${escapeHtml(mc.profile || config.profile || '—')}</dd></div><div><dt>Seed</dt><dd>${escapeHtml(formatNumber(mc.seed ?? config.seed))}</dd></div><div><dt>Uso</dt><dd>${escapeHtml(risk.monte_carlo?.decision_use || mc.decision_use || '—')}</dd></div><div><dt>Origem da incerteza</dt><dd>${escapeHtml(risk.monte_carlo?.uncertainty_source || mc.uncertainty_source || '—')}</dd></div><div><dt>Amostra histórica efetiva</dt><dd>${escapeHtml(formatNumber(mc.effective_historical_sample_size ?? mc.historical_unique_joint_support))}</dd></div><div><dt>Erro padrão de P(saving &gt; 0)</dt><dd>${mc.monte_carlo_probability_positive_standard_error == null ? '—' : escapeHtml(formatPct(mc.monte_carlo_probability_positive_standard_error * 100))}</dd></div><div><dt>Casos de stress bloqueados</dt><dd>${escapeHtml(formatNumber(blockedStressCount))}</dd></div></dl>`;
  const riskBand = mc.risk_band || robustness.robustness_status || '—';
  const pageTitle = advanced ? 'Risco avançado' : 'Risco e sensibilidade';
  const pageDescription = advanced
    ? 'Explore as distribuições, os drivers e os efeitos das variáveis do cenário.'
    : 'Avalie a robustez do cenário e o impacto da incerteza nos resultados.';
  const kpis = `<section class="ni-workspace-kpis" aria-label="Indicadores de risco">${kpi('P(saving > 0)', mc.probability_saving_positive == null ? '—' : formatPct(mc.probability_saving_positive * 100))}${kpi('Robustez', robustness.robustness_score == null ? '—' : `${robustness.robustness_score.toFixed(0)}/100`, robustness.robustness_interpretation || 'classificação do cenário')}${kpi('Saving · P10', mc.p10_saving_pct == null ? '—' : formatPct(mc.p10_saving_pct))}${kpi('Saving · P50', mc.median_saving_pct == null ? '—' : formatPct(mc.median_saving_pct))}</section>`;
  const header = `<header class="ni-page-heading ni-workspace-header" data-testid="page-scenarios-risk"><div class="ni-workspace-header-copy"><p class="ni-eyebrow">${advanced ? '09' : '08'} · Cenários · Risco & sensibilidade</p><h1>${pageTitle}</h1><p>${pageDescription}</p></div><aside class="ni-workspace-header-context" aria-label="Cenário e faixa de risco"><span>Cenário analisado</span><strong>${escapeHtml(selectedScenario?.scenario_name || selectedScenario?.scenario_id || 'Cenário ativo')}</strong><small>${statusChip(riskBand, riskBand === '—' ? 'aguardando classificação' : `Faixa ${riskBand}`)}</small></aside></header>`;

  if (advanced) {
    return `<section class="ni-workspace-page ni-workspace-scenarios ni-workspace-risk ni-workspace-risk-advanced">${header}<div class="ni-workspace-tabs">${sectionTabs('scenarios', state.ui.route)}</div>${controls}${kpis}<section class="ni-workspace-insights">${stressOverview}${robustnessAlerts.length ? `<article class="ni-workspace-alert ni-workspace-alert--neutral"><p class="ni-eyebrow">Limites e ressalvas</p><ul>${robustnessAlerts.join('')}</ul></article>` : ''}</section>${advancedCharts}${chartDescriptions}<details class="ni-workspace-secondary-analytics"><summary>Resultados detalhados de stress (${formatNumber(stressRows.length)} casos)</summary><section class="ni-card ni-workspace-panel ni-workspace-stress-panel">${stressTable}</section></details><section class="ni-card ni-workspace-panel ni-workspace-metadata-panel"><header class="ni-workspace-panel-heading"><div><p class="ni-eyebrow">Rastreabilidade</p><h2>Metadados da simulação</h2></div></header>${metadata}</section></section>`;
  }

  return `<section class="ni-workspace-page ni-workspace-scenarios ni-workspace-risk ni-workspace-risk-summary">${header}<div class="ni-workspace-tabs">${sectionTabs('scenarios', state.ui.route)}</div>${kpis}<section class="ni-workspace-insights">${stressOverview}</section>${summaryCharts}${chartDescriptions}<div class="ni-workspace-risk-more"><p>Consulte distribuições, sensibilidades e parâmetros da simulação.</p><a class="ni-button secondary" href="#/network/scenarios/risk/advanced" data-route="#/network/scenarios/risk/advanced">Abrir análise avançada</a></div></section>`;
}

function renderSensitivityMatrix(matrix = {}) {
  matrix = matrix || {};
  const results = matrix.matrix_results || [];
  const xValues = matrix.x_values || [...new Set(results.map((row) => row.x_value))];
  const yValues = matrix.y_values || [...new Set(results.map((row) => row.y_value))];
  if (!results.length || !xValues.length || !yValues.length) {
    return emptyState('Matriz de sensibilidade ainda não calculada.');
  }

  const resultByCoordinate = new Map(
    results.map((row) => [`${String(row.x_value)}::${String(row.y_value)}`, row])
  );
  const validSavingValues = results
    .map((row) => finiteValue(row.saving_pct))
    .filter((value) => value != null);
  if (!validSavingValues.length) {
    return emptyState('Sem valores de saving válidos nesta matriz.');
  }
  const maxSaving = Math.max(...validSavingValues.map(Math.abs));
  const headers = xValues
    .map((value) => `<th scope="col">${escapeHtml(formatNumber(value, 2))}</th>`)
    .join('');
  const rows = yValues
    .map((yValue) => {
      const cells = xValues
        .map((xValue) => {
          const result = resultByCoordinate.get(`${String(xValue)}::${String(yValue)}`);
          const value = finiteValue(result?.saving_pct);
          if (value == null) {
            return '<td class="ni-workspace-heat-cell is-unavailable">—</td>';
          }
          const saving = value;
          const band = saving > 0 ? 'positive' : saving < 0 ? 'negative' : 'neutral';
          const intensity = maxSaving > 0 ? Math.abs(saving) / maxSaving : 0;
          const alpha = (0.12 + intensity * 0.38).toFixed(2);
          const background =
            band === 'positive'
              ? `rgba(0, 161, 137, ${alpha})`
              : band === 'negative'
                ? `rgba(180, 35, 24, ${alpha})`
                : '#e8efec';
          const color =
            band === 'positive' ? '#064e43' : band === 'negative' ? '#7f1d1d' : '#526a68';
          return `<td class="ni-workspace-heat-cell is-${band}" style="background-color:${background};color:${color}" title="Saving ${escapeHtml(formatPct(saving))}; total ${escapeHtml(formatBRL(result.total_with_tax, true))}">${escapeHtml(formatPct(saving))}</td>`;
        })
        .join('');
      return `<tr><th scope="row">${escapeHtml(formatNumber(yValue, 2))}</th>${cells}</tr>`;
    })
    .join('');

  return `<div class="ni-workspace-heatmap-wrap"><table class="ni-workspace-heatmap"><caption>Saving percentual por valor dos fatores X e Y</caption><thead><tr><th scope="col">${escapeHtml(matrix.y_variable || 'Y')} ↓ / ${escapeHtml(matrix.x_variable || 'X')} →</th>${headers}</tr></thead><tbody>${rows}</tbody></table><p class="ni-workspace-footnote">A intensidade da cor acompanha a magnitude do saving (verde positivo, vermelho negativo); valores ausentes aparecem como —.</p></div>`;
}
