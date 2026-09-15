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

export function renderScenarioBuild(state) {
  const base = selectBaseline(state)?.model || {};
  const draft = state.ui.scenario_draft || {};
  const changes = draft.changes || {};
  const active = changes.active_cds || base.active_cds || [];
  const saved = state.data.saved_scenarios || [];
  const savedIds = new Set(saved.map((scenario) => scenario.scenario_id));
  const library = selectScenarios(state).filter((scenario) => !savedIds.has(scenario.scenario_id));
  const currentScenario = selectActiveScenario(state);
  const hasCurrentResult = Boolean(currentScenario && state.data.scenario_result);
  const baselineTotal = selectBaseline(state)?.costs?.costs?.total_with_tax;
  const currentTotal =
    currentScenario?.result?.total_with_tax ??
    state.data.scenario_result?.total_with_tax ??
    baselineTotal;
  const currentComparison = selectDecision(state).comparison?.comparison?.find(
    (row) => row.scenario_id === currentScenario?.scenario_id
  );
  const currentSaving =
    selectDecision(state).comparison?.saving_pct ?? currentComparison?.saving_pct;
  const demoOnly = state.context.provider_kind === 'mock';
  const demoLock = demoOnly ? ' disabled' : '';
  const field = (value) => escapeHtml(value ?? '');
  const libraryRows = library.map(
    (scenario) =>
      `<tr><td>${escapeHtml(scenario.scenario_id)}</td><td>${escapeHtml(scenario.scenario_name || '—')}</td><td>${escapeHtml(scenario.scenario_type || '—')}</td><td><button type="button" class="ni-button secondary" data-action="load-scenario" data-scenario-id="${escapeHtml(scenario.scenario_id)}" data-testid="scenario-load-${escapeHtml(scenario.scenario_id)}">Carregar</button></td></tr>`
  );
  const savedRows = saved.map(
    (scenario) =>
      `<tr><td>${escapeHtml(scenario.scenario_id)}</td><td>${escapeHtml(scenario.scenario_name || '—')}</td><td><button type="button" class="ni-button secondary" data-action="load-scenario" data-scenario-id="${escapeHtml(scenario.scenario_id)}" data-testid="saved-scenario-load-${escapeHtml(scenario.scenario_id)}">Carregar</button> <button type="button" class="ni-button secondary" data-action="delete-saved-scenario" data-scenario-id="${escapeHtml(scenario.scenario_id)}" data-testid="saved-scenario-delete-${escapeHtml(scenario.scenario_id)}">Excluir</button></td></tr>`
  );
  return `<div class="ni-page-heading" data-testid="page-scenarios-build"><p class="ni-eyebrow">Scenarios · Build</p><h1>Construir cenário</h1><p>Os campos alimentam o builder e o simulator existentes. Amostras e cenários salvos continuam sujeitos aos contratos de Empresa e Evidence.</p>${demoOnly ? '<p class="ni-note">Empresa Falsa usa fixtures demonstrativas isoladas; os campos abaixo são somente leitura e não representam uma simulação empresarial.</p>' : ''}</div>${sectionTabs('scenarios', state.ui.route)}<section class="ni-preview-card" data-testid="scenario-preview"><div><p class="ni-eyebrow">Scenario preview</p><h2>${escapeHtml(currentScenario?.scenario_name || draft.scenario_name || 'Cenário manual')}</h2><p>${hasCurrentResult ? 'Resultado calculado pelo pipeline atual.' : 'Prévia baseada no baseline carregado; execute para atualizar custos, qualidade e evidências.'}</p></div><div class="ni-preview-metrics"><div class="ni-preview-metric"><span>Total</span><strong>${formatBRL(currentTotal, true)}</strong></div><div class="ni-preview-metric"><span>Saving</span><strong>${formatPct(currentSaving)}</strong></div><div class="ni-preview-metric"><span>CDs ativos</span><strong>${formatNumber(active.length)}</strong></div><div class="ni-preview-metric"><span>Status</span><strong>${hasCurrentResult ? 'calculado' : 'rascunho'}</strong></div></div></section><form id="niScenarioForm" class="ni-card ni-form" data-testid="scenario-form" novalidate><label>Nome<input name="scenario_name" value="${field(draft.scenario_name || 'Cenário manual')}" required${demoLock}></label><fieldset><legend>CDs ativos</legend><div class="ni-checkbox-grid">${active.map((cd) => `<label><input type="checkbox" name="active_cds" value="${escapeHtml(cd)}" checked${demoLock}>${escapeHtml(cd)}</label>`).join('')}</div></fieldset><div class="ni-form-grid"><label>Frete<input name="freight_multiplier" type="number" min="0.1" step="0.01" value="${field(changes.freight_multiplier ?? 1)}"${demoLock}></label><label>Demanda<input name="demand_multiplier" type="number" min="0.1" step="0.01" value="${field(changes.demand_multiplier ?? 1)}"${demoLock}></label><label>Dias de estoque<input name="inventory_days" type="number" min="0" step="1" value="${field(changes.inventory_days ?? 45)}"${demoLock}></label><label>WACC<input name="wacc" type="number" min="0" step="0.01" value="${field(changes.wacc ?? 0.15)}"${demoLock}></label><label>Modo tributário<select name="tax_mode"${demoLock}><option value="current"${(changes.tax_mode || 'current') === 'current' ? ' selected' : ''}>Atual</option><option value="disabled"${changes.tax_mode === 'disabled' ? ' selected' : ''}>Desligado</option></select></label></div><div class="ni-actions"><button type="submit" class="ni-button primary" data-testid="scenario-run">Simular cenário</button><button type="button" class="ni-button secondary" data-action="reset-scenario-draft">Repor baseline</button><button type="button" class="ni-button secondary" data-action="save-current-scenario" data-testid="scenario-save"${hasCurrentResult ? '' : ' disabled'}>Salvar atual</button><button type="button" class="ni-button secondary" data-action="export-current-scenario" data-testid="scenario-export"${hasCurrentResult ? '' : ' disabled'}>Exportar JSON</button><label class="ni-button secondary" for="networkScenarioImport">Importar JSON<input id="networkScenarioImport" type="file" accept="application/json,.json" hidden data-testid="scenario-import"></label></div></form><div class="ni-card" data-testid="scenario-library"><h2>Biblioteca atual</h2>${table(['ID', 'Nome', 'Tipo', 'Ação'], libraryRows, 'Nenhuma amostra carregada.')}</div><div class="ni-card" data-testid="saved-scenarios"><div class="ni-card-heading"><div><p class="ni-eyebrow">Persistência local por empresa</p><h2>Cenários salvos</h2></div><button type="button" class="ni-button secondary" data-action="clear-saved-scenarios" data-testid="scenario-clear-saved"${saved.length ? '' : ' disabled'}>Limpar salvos</button></div>${table(['ID', 'Nome', 'Ações'], savedRows, 'Nenhum cenário salvo nesta empresa.')}</div>`;
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
  return `<div class="ni-page-heading" data-testid="page-scenarios-result"><p class="ni-eyebrow">Scenarios · Result</p><h1>${escapeHtml(selected.scenario_name || selected.scenario_id)}</h1><p>${statusChip(result.calculation_status || result.simulation_status)} · ${escapeHtml(result.company_id)}</p></div>${sectionTabs('scenarios', state.ui.route)}<div class="ni-kpi-grid">${kpi('Total', formatBRL(result.total_with_tax, true))}${kpi('Saving', formatPct(savingPct))}${kpi('Qualidade', quality.quality_score == null ? '—' : `${quality.quality_score}/100`)}${kpi('Risco', quality.risk_level || '—')}</div><div class="ni-grid two">${card(
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
            `<tr><td>${escapeHtml(key)}</td><td>${escapeHtml(formatBRL(value))}</td></tr>`
        )
    )
  )}${card('Evidence', result.evidence ? `<p>${escapeHtml(result.evidence.evidence_status || '—')}</p><strong>${result.evidence.evidence_score == null ? '—' : `${result.evidence.evidence_score}/100`}</strong><ul class="ni-list">${(result.evidence.blockers || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : emptyState('Evidence ainda não disponível.'))}</div><div class="ni-actions"><a class="ni-button secondary" href="#/network/scenarios/compare" data-route="#/network/scenarios/compare">Comparar</a>${hasRisk ? '<a class="ni-button secondary" href="#/network/scenarios/risk" data-route="#/network/scenarios/risk">Abrir risco</a>' : '<button type="button" class="ni-button secondary" data-action="run-risk">Calcular risco</button>'}</div>`;
}

export function renderScenarioCompare(state) {
  const decision = selectDecision(state);
  const comparison = decision.comparison?.comparison || [];
  const baselineTotal = Number(selectBaseline(state)?.costs?.costs?.total_with_tax);
  const rowsById = new Map(comparison.map((row) => [row.scenario_id, row]));
  for (const candidate of decision.optimizer?.best_scenarios || []) {
    if (rowsById.has(candidate.scenario_id)) continue;
    const total = Number(candidate.result?.total_with_tax ?? candidate.total_with_tax);
    const savingAbs =
      Number.isFinite(baselineTotal) && Number.isFinite(total) ? baselineTotal - total : null;
    rowsById.set(candidate.scenario_id, {
      ...candidate,
      scenario_name: candidate.scenario_name || candidate.scenario?.scenario_name,
      total_with_tax: Number.isFinite(total) ? total : null,
      saving_abs: savingAbs,
      saving_pct:
        Number.isFinite(savingAbs) && baselineTotal ? (savingAbs / baselineTotal) * 100 : null,
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
  const rows = [...rowsById.values()];
  if (!rows.length)
    return `<div class="ni-page-heading" data-testid="page-scenarios-compare"><h1>Comparação</h1></div>${sectionTabs('scenarios', state.ui.route)}${emptyState('Nenhuma comparação disponível.')}`;
  return `<div class="ni-page-heading" data-testid="page-scenarios-compare"><p class="ni-eyebrow">Scenarios · Compare</p><h1>Comparação com baseline</h1></div>${sectionTabs('scenarios', state.ui.route)}<div class="ni-card">${table(
    ['Cenário', 'Total', 'Saving', 'Status', 'Ação'],
    rows.map(
      (row) =>
        `<tr><td>${escapeHtml(row.scenario_name || row.scenario_id)}</td><td>${escapeHtml(formatBRL(row.total_with_tax))}</td><td>${escapeHtml(formatPct(row.saving_pct))}</td><td>${statusChip(row.status, row.status || '—')}</td><td>${row.scenario_id && row.scenario_id !== selectBaseline(state)?.model?.scenario_id ? `<button type="button" class="ni-button secondary" data-action="select-compared-scenario" data-scenario-id="${escapeHtml(row.scenario_id)}">Selecionar</button>` : '<span class="ni-note">baseline</span>'}</td></tr>`
    )
  )}</div>`;
}

export function renderScenarioRisk(state, advanced = false) {
  const risk = selectDecision(state).risk;
  if (!risk.monte_carlo && !risk.stress)
    return `<div class="ni-page-heading" data-testid="page-scenarios-risk"><h1>Risco e sensibilidade</h1></div>${sectionTabs('scenarios', state.ui.route)}${emptyState('Execute a decisão ou selecione um cenário para calcular risco.')}`;
  const mc = risk.monte_carlo?.summary || {};
  const stressRows = (risk.stress?.stress_results || []).map(
    (row) =>
      `<tr><td>${escapeHtml(row.case_name || row.case_id)}</td><td>${escapeHtml(formatBRL(row.total_with_tax))}</td><td>${escapeHtml(formatPct(row.saving_pct))}</td><td>${escapeHtml(row.decision_use || row.data_quality_status || '—')}</td></tr>`
  );
  const config = risk.monte_carlo?.config || {};
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
  const controls = `<form class="ni-card ni-form" data-testid="risk-controls" id="niRiskForm" novalidate><div class="ni-form-grid"><label>Iterações<input type="number" name="iterations" min="50" max="5000" step="50" value="${escapeHtml(config.iterations || mc.iterations || 300)}"></label><label>Seed<input type="number" name="seed" step="1" value="${escapeHtml(config.seed ?? mc.seed ?? 42)}"></label><label>Perfil de incerteza>${select(
    'profile',
    [
      ['balanced', 'Equilibrado'],
      ['conservative', 'Conservador'],
      ['broad', 'Amplo'],
    ],
    config.profile || 'balanced'
  )}</label><label>Driver do scatter>${select('scatter_driver', driverOptions, config.scatter_driver || mc.scatter_driver || 'freight_multiplier')}</label><label>Perfil de stress>${select(
    'stress_profile',
    [
      ['standard', 'Padrão'],
      ['conservative', 'Conservador'],
    ],
    'standard'
  )}</label><label>Sensibilidade>${select('sensitivity_variable', variableOptions, risk.sensitivity?.most_sensitive_variable || 'freight_multiplier')}</label><label>Matriz X>${select('sensitivity_x', variableOptions, risk.sensitivity_matrix?.x_variable || 'freight_multiplier')}</label><label>Matriz Y>${select('sensitivity_y', variableOptions, risk.sensitivity_matrix?.y_variable || 'demand_multiplier')}</label></div><div class="ni-actions"><button type="submit" class="ni-button primary" data-testid="risk-run">Recalcular risco</button>${advanced ? '<a class="ni-button secondary" href="#/network/scenarios/risk" data-route="#/network/scenarios/risk">Voltar ao risco resumido</a>' : '<a class="ni-button secondary" href="#/network/scenarios/risk/advanced" data-route="#/network/scenarios/risk/advanced">Abrir risco avançado</a>'}</div></form>`;
  return `<div class="ni-page-heading" data-testid="page-scenarios-risk"><p class="ni-eyebrow">Scenarios · Risk</p><h1>${advanced ? 'Risco avançado' : 'Risco e sensibilidade'}</h1><p>Monte Carlo permanece como análise exploratória de incerteza paramétrica.</p></div>${sectionTabs('scenarios', state.ui.route)}${controls}<div class="ni-kpi-grid">${kpi('Probabilidade de saving', mc.probability_saving_positive == null ? '—' : formatPct(mc.probability_saving_positive * 100))}${kpi('p10', formatPct(mc.p10_saving_pct))}${kpi('Mediana', formatPct(mc.median_saving_pct))}${kpi('Robustez', risk.robustness?.robustness_score == null ? '—' : `${risk.robustness.robustness_score.toFixed(0)}/100`, risk.robustness?.robustness_interpretation || '')}</div><div class="ni-grid two"><div class="ni-card"><h2>Probabilidade e faixa</h2><canvas id="niRiskChart" class="ni-chart" role="img" aria-label="Faixa de incerteza do Monte Carlo"></canvas><canvas id="niRiskProbabilityChart" class="ni-chart" role="img" aria-label="Probabilidade de saving positivo"></canvas></div><div class="ni-card"><h2>Stress</h2>${table(['Caso', 'Total', 'Saving', 'Uso'], stressRows, 'Nenhum caso de stress disponível.')}</div></div><div class="ni-grid two"><div class="ni-card"><h2>Distribuição de saving</h2><canvas id="niRiskHistogramChart" class="ni-chart" role="img" aria-label="Histograma do Monte Carlo"></canvas></div><div class="ni-card"><h2>Curva percentílica do saving</h2><canvas id="niRiskCdfChart" class="ni-chart" role="img" aria-label="Curva acumulada do Monte Carlo"></canvas></div><div class="ni-card"><h2>Curva do custo total</h2><canvas id="niRiskTotalChart" class="ni-chart" role="img" aria-label="Curva do custo total do Monte Carlo"></canvas></div><div class="ni-card"><h2>Drivers</h2><canvas id="niRiskDriversChart" class="ni-chart" role="img" aria-label="Drivers mais influentes no Monte Carlo"></canvas></div><div class="ni-card"><h2>Driver × saving</h2><canvas id="niRiskScatterChart" class="ni-chart" role="img" aria-label="Relação entre driver e saving"></canvas></div></div><div class="ni-card"><h2>Sensibilidade</h2><canvas id="niSensitivityChart" class="ni-chart" role="img" aria-label="Sensibilidade do cenário"></canvas><p>Variável mais sensível: ${escapeHtml(risk.sensitivity?.most_sensitive_variable || '—')}</p></div>`;
}
