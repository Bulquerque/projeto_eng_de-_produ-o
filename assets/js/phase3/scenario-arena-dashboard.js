import { $, escapeHtml, formatBRL, formatNumber, formatPct, metric } from '../core/common.js';
import { renderScenarioMonteCarlo } from './scenario-arena/monte-carlo-view.js';
import {
  renderComponentDeltas as renderComponentDeltasView,
  renderComparisonTable,
  renderLibraryComparisonTable as renderLibraryComparisonTableView,
  renderScenarioExecutiveTable as renderScenarioExecutiveTableView,
} from './scenario-arena/comparison-view.js';
import { buildLibraryComparisonRows } from './scenario-arena/library-comparison.js';
import { loadScenarioLibrary } from './scenario-library.js';
import { buildScenarioFromForm } from './scenario-builder.js';
import { validateScenario } from './scenario-validator.js';
import { runScenario } from './scenario-simulator.js';
import { compareScenarios, componentDelta } from './scenario-comparator.js';
import { evaluateScenarioQuality } from './scenario-quality-check.js';
import { explainScenarioChanges } from './scenario-change-explainer.js';
import {
  loadSavedScenarios,
  saveScenario,
  deleteScenario,
  clearCompanyScenarios,
} from './scenario-persistence.js';
import {
  downloadScenarioJson,
  parseImportedScenario,
  validateImportedScenario,
} from './scenario-import-export.js';
import { buildMonteCarloConfig, runMonteCarloSimulation } from './monte-carlo-engine.js';
import { appendSharedDebugEntry } from '../core/debug-tools.js';
import { buildScenarioSummary } from '../core/scenario-summary.js';
import { calculateSaving, MODEL_DEFAULTS } from '../core/model-configuration.js';
import {
  getTaxRegimeDefinition,
  resolveTaxRegime,
  resolveTaxModeForRegime,
  taxRegimeLabel,
} from '../core/tax-reform-config.js';
import { renderScenarioComparisonChart } from './charts.js';

const EMPTY_STATE = {
  validation: 'Ainda não validado.',
  result: 'Simule um cenário para ver os resultados.',
  comparison: 'Nenhuma comparação ainda.',
  delta: 'Simule um cenário para ver os deltas.',
  quality: 'Sem qualidade calculada.',
  explanation: 'Simule um cenário para gerar explicação.',
  saved: 'Nenhum cenário salvo para esta empresa.',
};

const DEFAULT_FORM_VALUES = {
  scenario_name: 'Cenário customizado',
  freight_multiplier: 1,
  demand_multiplier: 1,
  inventory_days: MODEL_DEFAULTS.inventory_days,
  wacc: MODEL_DEFAULTS.reference_wacc,
  tax_mode: 'current',
  reallocation_rule: 'nearest_available_cd',
};

const COST_LABELS = {
  transfer_cost: 'Transferência',
  distribution_cost: 'Distribuição',
  storage_cost: 'Armazenagem',
  inventory_cost: 'Estoque',
  tax_impact: 'Tributo',
  total_with_tax: 'Total com tributo',
};

function readMonteCarloConfig() {
  return buildMonteCarloConfig({
    iterations: Number($('phase3MonteCarloIterations')?.value || 300),
    seed: Number($('phase3MonteCarloSeed')?.value || 42),
    profile: $('phase3MonteCarloProfile')?.value || 'balanced',
    scatterDriver: $('phase3MonteCarloDriver')?.value || 'freight_multiplier',
  });
}

function applyMonteCarloConfig(config = {}) {
  if ($('phase3MonteCarloIterations'))
    $('phase3MonteCarloIterations').value = config.iterations ?? 300;
  if ($('phase3MonteCarloSeed')) $('phase3MonteCarloSeed').value = config.seed ?? 42;
  if ($('phase3MonteCarloProfile'))
    $('phase3MonteCarloProfile').value = config.profile || 'balanced';
  if ($('phase3MonteCarloDriver'))
    $('phase3MonteCarloDriver').value = config.scatter_driver || 'freight_multiplier';
  state.monteCarloConfig = buildMonteCarloConfig({
    ...config,
    historicalData: config.historicalData || config.historical_data || null,
  });
}

const state = {
  companyId: 'empresa1',
  library: null,
  currentScenario: null,
  currentResult: null,
  comparison: null,
  quality: null,
  explanation: null,
  monteCarlo: null,
  monteCarloConfig: buildMonteCarloConfig(),
  logs: [],
  isLoading: false,
};

function setHtml(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html;
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function setValue(id, value) {
  const el = $(id);
  if (el) el.value = value;
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function renderEmpty(id, message) {
  setHtml(id, emptyState(message));
}

function renderCards(id, cards) {
  setHtml(id, cards.join(''));
}

function riskLabel(level) {
  const normalized = String(level || '').toLowerCase();
  if (normalized === 'low' || normalized === 'baixo') return 'baixo';
  if (normalized === 'medium' || normalized === 'medio' || normalized === 'médio') return 'médio';
  if (normalized === 'high' || normalized === 'alto') return 'alto';
  return level || '—';
}

function scenarioTaxRegime(scenario) {
  return resolveTaxRegime({
    taxMode: scenario?.changes?.tax_mode,
    taxRegime: scenario?.changes?.tax_regime,
    year: scenario?.changes?.tax_year,
  });
}

function scenarioTaxMode(scenario) {
  return scenario?.changes?.tax_mode || resolveTaxModeForRegime(scenarioTaxRegime(scenario));
}

function qualityStatusClass(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return 'status-neutral';
  if (value >= 85) return 'status-ok';
  if (value >= 65) return 'status-warn';
  return 'status-error';
}

function log(msg, data = null) {
  state.logs.push(
    `[${new Date().toLocaleTimeString('pt-BR')}] ${msg}${data ? `: ${JSON.stringify(data)}` : ''}`
  );
  appendSharedDebugEntry({
    phase: 'phase3',
    module: 'scenario-arena',
    level: 'info',
    event: msg,
    detail: data || {},
  });
  const el = $('phase3DebugConsole');
  if (el) el.textContent = state.logs.slice(-30).join('\n');
}

function logError(msg, error, data = null) {
  state.logs.push(
    `[${new Date().toLocaleTimeString('pt-BR')}] [erro] ${msg}: ${error?.message || error}`
  );
  appendSharedDebugEntry({
    phase: 'phase3',
    module: 'scenario-arena',
    level: 'error',
    event: msg,
    detail: data || {},
    error,
  });
  const el = $('phase3DebugConsole');
  if (el) el.textContent = state.logs.slice(-30).join('\n');
}

function resetAnalysisPanels() {
  state.currentScenario = null;
  state.currentResult = null;
  state.comparison = null;
  state.quality = null;
  state.explanation = null;
  state.monteCarlo = null;
  renderEmpty('scenarioValidationPanel', EMPTY_STATE.validation);
  renderEmpty('scenarioResultCards', EMPTY_STATE.result);
  renderEmpty('scenarioExecutiveTable', EMPTY_STATE.result);
  renderScenarioComparisonChart(null, null);
  renderEmpty('comparisonTable', EMPTY_STATE.comparison);
  renderEmpty('scenarioLibraryComparisonTable', EMPTY_STATE.comparison);
  renderEmpty('componentDeltaPanel', EMPTY_STATE.delta);
  renderEmpty('qualityPanel', EMPTY_STATE.quality);
  renderEmpty('changeExplainer', EMPTY_STATE.explanation);
  renderMonteCarlo();
}

function scenarioFormValues() {
  return {
    scenario_name: $('scenarioName').value,
    active_cds: [...document.querySelectorAll('[data-cd-check]:checked')].map(
      (input) => input.value
    ),
    freight_multiplier: Number($('freightMultiplier').value),
    demand_multiplier: Number($('demandMultiplier').value),
    inventory_days: Number($('inventoryDays').value),
    wacc: Number($('waccValue').value),
    tax_mode: $('taxMode').value,
    reallocation_rule: $('reallocationRule').value,
  };
}

function renderTaxAssumptions() {
  const selectedMode = $('taxMode')?.value || DEFAULT_FORM_VALUES.tax_mode;
  const regime = getTaxRegimeDefinition({ taxMode: selectedMode });
  if (!regime) {
    renderEmpty(
      'taxAssumptionsPanel',
      'Regime tributário não encontrado na configuração carregada.'
    );
    return;
  }

  setHtml(
    'taxAssumptionsPanel',
    `<div class="alert-box neutral">
      <strong>${escapeHtml(regime.label || regime.regime_id)}</strong>
      <p class="small-note">Ano: ${escapeHtml(regime.year_label || regime.year || '—')} · Modo: ${escapeHtml(regime.calculation_mode || '—')}</p>
      <dl class="tax-assumption-grid">
        <div><dt>Peso sistema atual</dt><dd>${formatPct(Number(regime.current_weight || 0) * 100, 1)}</dd></div>
        <div><dt>Peso IBS</dt><dd>${formatPct(Number(regime.ibs_weight || 0) * 100, 1)}</dd></div>
        <div><dt>CBS</dt><dd>${formatPct(Number(regime.cbs_rate || 0) * 100, 2)}</dd></div>
        <div><dt>IBS</dt><dd>${formatPct(Number(regime.ibs_rate || 0) * 100, 2)}</dd></div>
        <div><dt>Seletivo</dt><dd>${formatPct(Number(regime.selective_rate || 0) * 100, 2)}</dd></div>
        <div><dt>Crédito ref.</dt><dd>${formatPct(Number(regime.credit_rate || 0) * 100, 2)}</dd></div>
      </dl>
    </div>`
  );
}

function renderCompanyTabs() {
  document.querySelectorAll('[data-company]').forEach((btn) => {
    const active = btn.dataset.company === state.companyId;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function renderBaseline() {
  const baseline = state.library.baselineBundle;
  const costs = baseline.costs.costs;

  setText('phase3CompanyLabel', state.companyId === 'empresa1' ? 'Empresa 1' : 'Empresa 2');
  renderCards('baselineCards', [
    metric('Baseline', baseline.model.scenario_id, baseline.model.baseline_status),
    metric(
      'CDs ativos',
      formatNumber((baseline.model.active_cds || []).length),
      (baseline.model.active_cds || []).slice(0, 4).join(' · ')
    ),
    metric('Origens', formatNumber((baseline.model.origins || []).length), 'detectadas'),
    metric('Destinos', formatNumber((baseline.model.destinations || []).length), 'cobertura'),
    metric('Fluxos', formatNumber(baseline.flows.length), 'baseline'),
    metric('Total com tributo', formatBRL(costs.total_with_tax, true), 'referência do baseline'),
    metric('Base Fit', baseline.base_fit.base_fit_score ?? 'pendente', baseline.base_fit.status),
  ]);
  renderBaselineFinanceTable();
}

function renderBaselineFinanceTable() {
  const costs = state.library?.baselineBundle?.costs?.costs || {};
  const rows = [
    'transfer_cost',
    'distribution_cost',
    'storage_cost',
    'inventory_cost',
    'tax_impact',
    'total_with_tax',
  ]
    .map(
      (key) =>
        `<tr><td>${escapeHtml(COST_LABELS[key] || key)}</td><td>${formatBRL(costs[key], true)}</td></tr>`
    )
    .join('');
  setHtml(
    'baselineFinanceTable',
    `<table><thead><tr><th>Componente</th><th>Valor baseline</th></tr></thead><tbody>${rows}</tbody></table>`
  );
}

function renderCdChecks() {
  const cds = state.library.baselineBundle.model.active_cds || [];
  setHtml(
    'cdSelector',
    cds
      .map(
        (cd) =>
          `<label class="chip-check"><input type="checkbox" data-cd-check value="${escapeHtml(cd)}" checked><span>${escapeHtml(cd)}</span></label>`
      )
      .join('')
  );
}

function renderLibraryWarnings() {
  const existing = $('libraryWarningBanner');
  if (existing) existing.remove();

  const warnings = state.library.warnings || [];
  if (!warnings.length) return;

  const banner = document.createElement('div');
  banner.id = 'libraryWarningBanner';
  banner.innerHTML = warnings
    .map(
      (w) =>
        `<div class="alert-box warn"><strong>Aviso de biblioteca</strong><p>${escapeHtml(w.message)}</p></div>`
    )
    .join('');
  $('baselineCards').before(banner);
}

function renderScenarioLibrary() {
  const list = state.library.scenarios || [];
  setHtml(
    'scenarioLibrary',
    list
      .map(
        (s) =>
          `<button type="button" class="scenario-card" data-load-scenario="${escapeHtml(s.scenario_id)}"><strong>${escapeHtml(s.scenario_name)}</strong><span>${escapeHtml(s.scenario_type)} · ${escapeHtml(s.metadata?.source || 'local')}${s.monte_carlo?.summary ? ` · MC ${formatPct(s.monte_carlo.summary.probability_saving_positive * 100, 0)}` : ''}</span></button>`
      )
      .join('')
  );
}

function loadScenarioToForm(scenario) {
  setValue('scenarioName', scenario.scenario_name || DEFAULT_FORM_VALUES.scenario_name);

  const active = new Set(scenario.changes?.active_cds || []);
  document.querySelectorAll('[data-cd-check]').forEach((input) => {
    input.checked = active.has(input.value);
  });

  $('freightMultiplier').value =
    scenario.changes?.freight_multiplier ?? DEFAULT_FORM_VALUES.freight_multiplier;
  $('demandMultiplier').value =
    scenario.changes?.demand_multiplier ?? DEFAULT_FORM_VALUES.demand_multiplier;
  $('inventoryDays').value = scenario.changes?.inventory_days ?? DEFAULT_FORM_VALUES.inventory_days;
  $('waccValue').value = scenario.changes?.wacc ?? DEFAULT_FORM_VALUES.wacc;
  $('taxMode').value = scenarioTaxMode(scenario) || DEFAULT_FORM_VALUES.tax_mode;
  $('reallocationRule').value =
    scenario.changes?.reallocation_rule || DEFAULT_FORM_VALUES.reallocation_rule;
  renderTaxAssumptions();
  const mc = scenario.monte_carlo || scenario.analysis?.monte_carlo || null;
  if (mc?.config) applyMonteCarloConfig(mc.config);
  state.monteCarlo = mc?.summary ? { ...mc, samples: mc.samples || [] } : null;
  renderMonteCarlo();
  log('Cenário carregado no formulário', { scenario_id: scenario.scenario_id });
}

function renderValidation(validation) {
  const statusClass = validation.valid ? 'ok' : 'error';
  const title = validation.valid ? 'Cenário válido' : 'Cenário inválido';
  const summary = `${validation.errors.length} erro(s), ${validation.warnings.length} aviso(s).`;
  const items = [...validation.errors, ...validation.warnings]
    .map(
      (item) =>
        `<div class="alert-box ${item.severity === 'warning' ? 'warn' : 'error'}"><strong>${escapeHtml(item.code)}</strong><p>${escapeHtml(item.message)}</p></div>`
    )
    .join('');

  setHtml(
    'scenarioValidationPanel',
    `<div class="alert-box ${statusClass}"><strong>${title}</strong><p>${summary}</p></div>${items}`
  );
}

function renderResult() {
  const result = state.currentResult;
  if (!result) {
    renderEmpty('scenarioResultCards', EMPTY_STATE.result);
    renderEmpty('scenarioExecutiveTable', EMPTY_STATE.result);
    return;
  }

  const quality = state.quality;
  renderCards('scenarioResultCards', [
    metric('Cenário', result.scenario_name, result.simulation_status),
    metric(
      'Total com tributo',
      formatBRL(result.total_with_tax, true),
      'logística + tributo básico'
    ),
    metric(
      'Regime fiscal',
      result.tax_results?.regime_label || taxRegimeLabel(scenarioTaxRegime(result.scenario)),
      result.tax_results?.calculation_mode || '—'
    ),
    metric(
      'Quality Score',
      quality?.quality_score ?? '—',
      `risco ${riskLabel(quality?.risk_level)}`
    ),
    metric(
      'Nível de suporte da evidência',
      result.evidence?.evidence_score ?? '—',
      result.evidence?.evidence_status || 'não informado'
    ),
    metric(
      'Fluxos realocados',
      formatNumber(result.flow_summary?.reallocated_flows || 0),
      `de ${formatNumber(result.flow_summary?.total_flows || 0)} fluxos`
    ),
  ]);
  renderScenarioExecutiveTable();

  renderScenarioComparisonChart(state.library.baselineBundle.costs.costs, result.costs);
}

function renderScenarioExecutiveTable() {
  const result = state.currentResult;
  const baselineCosts = state.library?.baselineBundle?.costs?.costs || {};
  const savingResult = result
    ? calculateSaving({
        baselineTotal: baselineCosts.total_with_tax,
        scenarioTotal: result.total_with_tax,
      })
    : null;

  renderScenarioExecutiveTableView({
    result,
    quality: state.quality,
    baselineCosts,
    savingResult,
    emptyMessage: EMPTY_STATE.result,
  });
}

function renderComponentDeltas() {
  const deltas = state.currentResult
    ? componentDelta(state.library.baselineBundle, state.currentResult)
    : null;
  renderComponentDeltasView({ deltas, emptyMessage: EMPTY_STATE.delta });
}

function renderComparison() {
  if (!state.comparison) {
    renderComparisonTable(null, EMPTY_STATE.comparison);
    renderComponentDeltasView({ deltas: null, emptyMessage: EMPTY_STATE.delta });
    renderLibraryComparisonTable();
    return;
  }

  const rows = state.comparison.comparison.map((row) => ({
    ...buildScenarioSummary({
      scenario: {
        scenario_id: row.scenario_id,
        scenario_name: row.scenario_name,
        scenario_type: row.scenario_type,
        changes: {
          active_cds: Array.from({ length: row.active_cds_count }, () => null),
          freight_multiplier: row.freight_multiplier,
          demand_multiplier: row.demand_multiplier,
          inventory_days: row.inventory_days,
          tax_mode: row.tax_mode,
          tax_regime: row.tax_regime,
        },
      },
      result: {
        total_with_tax: row.total_with_tax,
        costs: {
          transfer_cost: row.transfer_cost,
          tax_impact: row.tax_impact,
        },
        tax_results: {
          tax_regime: row.tax_regime,
          regime_label: row.tax_regime_label,
          tax_source_label: row.tax_source_label,
        },
      },
      baselineTotal: state.comparison.comparison[0]?.total_with_tax || 0,
    }),
    rank_by_total_cost: row.rank_by_total_cost,
    status: row.status,
  }));
  renderComparisonTable(rows, EMPTY_STATE.comparison);

  renderComponentDeltas();
  renderLibraryComparisonTable();
}

function renderLibraryComparisonTable() {
  const rows = buildLibraryComparisonRows({
    companyId: state.companyId,
    library: state.library,
    currentResult: state.currentResult,
    quality: state.quality,
  });
  renderLibraryComparisonTableView(rows, EMPTY_STATE.comparison);
}

function renderQuality() {
  const quality = state.quality;
  if (!quality) {
    renderEmpty('qualityPanel', EMPTY_STATE.quality);
    return;
  }

  const alerts = quality.alerts.length
    ? quality.alerts
        .map(
          (alert) =>
            `<div class="alert-box ${alert.severity === 'error' ? 'error' : 'warn'}"><strong>${escapeHtml(alert.type)}</strong><p>${escapeHtml(alert.message)}</p></div>`
        )
        .join('')
    : '<div class="alert-box ok"><strong>Sem alertas relevantes</strong></div>';

  const tax = state.currentResult?.tax_results || {};
  const taxWarningsList = tax.warnings || [];
  const visibleTaxWarnings = taxWarningsList.slice(0, 8);
  const hiddenTaxWarnings = Math.max(0, taxWarningsList.length - visibleTaxWarnings.length);
  const taxWarnings =
    visibleTaxWarnings
      .map(
        (warning) =>
          `<div class="alert-box warn"><strong>${escapeHtml(warning.code || 'AVISO')}</strong><p>${escapeHtml(warning.message || '')}</p></div>`
      )
      .join('') +
    (hiddenTaxWarnings
      ? `<div class="alert-box warn"><strong>${hiddenTaxWarnings} avisos tributários adicionais</strong><p>Lista reduzida para manter a tela legível. O cálculo preserva os avisos completos em <code>tax_results.warnings</code>.</p></div>`
      : '');

  setHtml(
    'qualityPanel',
    `<div class="fit-score-card ${qualityStatusClass(quality.quality_score)}"><span class="metric-label">Quality Score</span><strong class="fit-score-value">${quality.quality_score}</strong><p>Risco: <b>${escapeHtml(riskLabel(quality.risk_level))}</b></p></div><div class="alert-box neutral"><strong>Regime fiscal</strong><p>${escapeHtml(tax.regime_label || taxRegimeLabel(scenarioTaxRegime(state.currentResult?.scenario)))}</p><p class="small-note">Modo de cálculo: ${escapeHtml(tax.calculation_mode || '—')} · Precisão: ${escapeHtml(tax.precision_mode || '—')}</p></div>${(() => {
      const evidence = state.currentResult?.evidence || {};
      const taxCoverage = tax.tax_coverage || {};
      return `<div class="alert-box ${evidence.evidence_status === 'high' ? 'ok' : evidence.evidence_status === 'medium' ? 'warn' : 'error'}"><strong>Evidência: ${escapeHtml(evidence.evidence_score == null ? '—' : `${evidence.evidence_score}/100`)} · ${escapeHtml(evidence.evidence_status || 'não informado')}</strong><p>Classificação fiscal completa: ${escapeHtml(taxCoverage.fiscal_classification_coverage == null ? '—' : `${(taxCoverage.fiscal_classification_coverage * 100).toFixed(1)}%`)}</p><p>${escapeHtml((evidence.blockers || []).join(' · ') || 'Sem bloqueadores registrados.')}</p></div>`;
    })()}${alerts}${taxWarnings}`
  );
}

function renderExplanation() {
  const explanation = state.explanation;
  if (!explanation) {
    renderEmpty('changeExplainer', EMPTY_STATE.explanation);
    return;
  }

  setHtml(
    'changeExplainer',
    `<h3>O que mudou</h3><ul>${explanation.change_summary.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><p><strong>${escapeHtml(explanation.result_summary)}</strong></p><p class="small-note">Drivers: ${escapeHtml(explanation.main_drivers.join(', '))}</p>`
  );
}

function renderMonteCarlo() {
  renderScenarioMonteCarlo(state);
}

function runMonteCarloForCurrentScenario({ rerender = true } = {}) {
  if (!state.library || !state.currentScenario || !state.currentResult) {
    state.monteCarlo = null;
    renderMonteCarlo();
    return null;
  }

  state.monteCarloConfig = readMonteCarloConfig();
  const mc = runMonteCarloSimulation({
    companyId: state.companyId,
    selectedScenario: state.currentScenario,
    baselineBundle: state.library.baselineBundle,
    deterministicResult: state.currentResult,
    iterations: state.monteCarloConfig.iterations,
    seed: state.monteCarloConfig.seed,
    config: state.monteCarloConfig,
  });
  state.monteCarlo = mc;
  if (mc.summary) {
    state.currentScenario = {
      ...state.currentScenario,
      monte_carlo: {
        config: mc.config,
        summary: mc.summary,
        generated_at: 'browser_runtime',
      },
    };
  } else {
    const { monte_carlo: _monte_carlo, ...rest } = state.currentScenario;
    state.currentScenario = rest;
  }
  if (rerender) renderMonteCarlo();
  return mc;
}

function renderSaved() {
  const saved = loadSavedScenarios(state.companyId);
  if (!saved.length) {
    renderEmpty('savedScenarios', EMPTY_STATE.saved);
    return;
  }

  setHtml(
    'savedScenarios',
    saved
      .map(
        (scenario) =>
          `<div class="saved-scenario-row"><button type="button" class="secondary-button small-button" data-load-saved="${escapeHtml(scenario.scenario_id)}">Carregar</button><strong>${escapeHtml(scenario.scenario_name)}</strong>${scenario.monte_carlo?.summary ? `<span class="status-chip status-ok">MC ${formatPct(scenario.monte_carlo.summary.probability_saving_positive * 100, 0)}</span>` : ''}<button type="button" class="ghost-danger small-button" data-delete-saved="${escapeHtml(scenario.scenario_id)}">Excluir</button></div>`
      )
      .join('')
  );
}

function setSimulateButtonState(enabled) {
  const btn = $('simulateScenario');
  if (!btn) return;
  btn.disabled = !enabled;
  btn.title = enabled ? '' : 'Carregue a empresa antes de simular.';
}

function setCompanyButtonsDisabled(disabled) {
  document.querySelectorAll('[data-company]').forEach((btn) => {
    btn.disabled = disabled;
    btn.style.opacity = disabled ? '0.5' : '';
    btn.title = disabled ? 'Aguarde o carregamento da empresa atual...' : '';
  });
}

function runCurrentScenario() {
  if (!state.library) {
    setHtml(
      'scenarioValidationPanel',
      '<div class="alert-box error"><strong>Empresa não carregada</strong><p>Selecione e desbloqueie a empresa antes de simular um cenário.</p></div>'
    );
    return;
  }

  const scenario = buildScenarioFromForm({
    companyId: state.companyId,
    baselineBundle: state.library.baselineBundle,
    formValues: scenarioFormValues(),
  });

  const validation = validateScenario({
    companyId: state.companyId,
    scenario,
    baselineBundle: state.library.baselineBundle,
  });

  renderValidation(validation);

  if (!validation.valid) {
    state.currentScenario = scenario;
    state.currentResult = null;
    state.comparison = null;
    state.quality = null;
    state.explanation = null;
    state.monteCarlo = null;
    renderResult();
    renderMonteCarlo();
    renderComparison();
    renderQuality();
    renderExplanation();
    return;
  }

  state.currentScenario = scenario;
  state.currentResult = runScenario({
    companyId: state.companyId,
    scenario,
    baselineBundle: state.library.baselineBundle,
  });
  state.quality = evaluateScenarioQuality({
    scenarioResult: state.currentResult,
    baselineBundle: state.library.baselineBundle,
  });
  state.comparison = compareScenarios({
    companyId: state.companyId,
    baselineBundle: state.library.baselineBundle,
    scenarioResults: [state.currentResult],
  });

  const comparisonRow = state.comparison.comparison.find(
    (row) => row.scenario_id === state.currentResult.scenario_id
  );
  state.explanation = explainScenarioChanges({
    baselineBundle: state.library.baselineBundle,
    scenario,
    comparisonRow,
    quality: state.quality,
  });
  runMonteCarloForCurrentScenario({ rerender: false });

  renderResult();
  renderMonteCarlo();
  renderComparison();
  renderQuality();
  renderExplanation();
  log('Cenário simulado', {
    scenario_id: scenario.scenario_id,
    total: state.currentResult.total_with_tax,
  });
}

function onImportScenarioFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  (async () => {
    try {
      const scenario = await parseImportedScenario(file);
      const validation = validateImportedScenario(state.companyId, scenario);
      if (!validation.valid) throw new Error(validation.error);

      const result = saveScenario(state.companyId, scenario);
      if (!result.saved) {
        log('Persistência local indisponível', {
          action: 'importScenario',
          companyId: state.companyId,
        });
      }
      renderSaved();
      loadScenarioToForm(scenario);
      log('Cenário importado', scenario.scenario_id);
    } catch (error) {
      alert(error.message);
    }
  })();
}

function onBodyClick(event) {
  const loadLibraryScenario = event.target.closest('[data-load-scenario]');
  if (loadLibraryScenario) {
    const scenario = state.library.scenarios.find(
      (item) => item.scenario_id === loadLibraryScenario.dataset.loadScenario
    );
    if (scenario) loadScenarioToForm(scenario);
  }

  const loadSavedScenario = event.target.closest('[data-load-saved]');
  if (loadSavedScenario) {
    const scenario = loadSavedScenarios(state.companyId).find(
      (item) => item.scenario_id === loadSavedScenario.dataset.loadSaved
    );
    if (scenario) loadScenarioToForm(scenario);
  }

  const deleteSavedScenario = event.target.closest('[data-delete-saved]');
  if (deleteSavedScenario) {
    const result = deleteScenario(state.companyId, deleteSavedScenario.dataset.deleteSaved);
    if (!result.deleted) {
      log('Persistência local indisponível', {
        action: 'deleteScenario',
        companyId: state.companyId,
      });
    }
    renderSaved();
  }
}

export async function loadCompany(companyId) {
  if (state.isLoading) {
    log('loadCompany ignorado — carregamento em andamento', { companyId });
    return;
  }
  state.isLoading = true;
  state.companyId = companyId;
  state.library = null; // reset explícito — impede reuso de dados da empresa anterior
  renderCompanyTabs();
  resetAnalysisPanels();
  setSimulateButtonState(false); // desabilita enquanto dados não estão prontos
  setCompanyButtonsDisabled(true);
  const loading = $('phase3Loading');
  if (loading) {
    loading.innerHTML = '<strong>Carregando cenários...</strong>';
    loading.classList.remove('hidden');
  }

  try {
    state.library = await loadScenarioLibrary(companyId);
    renderBaseline();
    renderLibraryWarnings();
    renderCdChecks();
    renderTaxAssumptions();
    renderScenarioLibrary();
    renderLibraryComparisonTable();
    renderSaved();
    renderResult();
    renderMonteCarlo();
    renderComparison();
    renderQuality();
    renderExplanation();
    setSimulateButtonState(true); // habilita apenas após dados carregados
    if (loading) loading.classList.add('hidden');
    log('Empresa carregada', {
      companyId,
      scenarios: state.library.scenarios.length,
      warnings: state.library.warnings.length,
    });
  } catch (error) {
    state.library = null; // garante estado nulo explícito em caso de falha
    setSimulateButtonState(false); // mantém botão desabilitado
    if (loading) {
      loading.innerHTML = `<div class="alert-box error"><strong>Erro ao carregar empresa</strong><p>${escapeHtml(error.message)}</p></div>`;
    }
    logError('loadCompany:error', error, { companyId });
  } finally {
    state.isLoading = false;
    setCompanyButtonsDisabled(false);
  }
}

export function setupPhase3() {
  document.querySelectorAll('[data-company]').forEach((btn) => {
    btn.addEventListener('click', () => loadCompany(btn.dataset.company));
  });

  $('simulateScenario')?.addEventListener('click', runCurrentScenario);
  [
    'phase3MonteCarloIterations',
    'phase3MonteCarloSeed',
    'phase3MonteCarloProfile',
    'phase3MonteCarloDriver',
  ].forEach((id) => {
    $(id)?.addEventListener('change', () => {
      state.monteCarloConfig = readMonteCarloConfig();
      if (state.currentScenario && state.currentResult) runMonteCarloForCurrentScenario();
    });
  });
  $('runMonteCarloScenario')?.addEventListener('click', () => runMonteCarloForCurrentScenario());
  $('taxMode')?.addEventListener('change', renderTaxAssumptions);
  $('saveScenario')?.addEventListener('click', () => {
    if (!state.currentScenario) return;
    const result = saveScenario(state.companyId, state.currentScenario);
    if (!result.saved) {
      log('Persistência local indisponível', {
        action: 'saveScenario',
        companyId: state.companyId,
      });
    }
    renderSaved();
    log('Cenário salvo', state.currentScenario.scenario_id);
  });
  $('exportScenario')?.addEventListener('click', () => {
    if (!state.currentScenario) return;
    downloadScenarioJson(state.currentScenario);
    log('Cenário exportado', state.currentScenario.scenario_id);
  });
  $('importScenarioFile')?.addEventListener('change', onImportScenarioFile);
  $('clearSavedScenarios')?.addEventListener('click', () => {
    const result = clearCompanyScenarios(state.companyId);
    if (!result.cleared) {
      log('Persistência local indisponível', {
        action: 'clearSavedScenarios',
        companyId: state.companyId,
      });
    }
    renderSaved();
  });
  document.body.addEventListener('click', onBodyClick);

  const loadCurrentCompanyOnRoute = () => {
    if (window.location.hash === '#/simulacao-otimizacao') {
      void loadCompany(state.companyId);
    }
  };
  window.addEventListener('hashchange', loadCurrentCompanyOnRoute);
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', loadCurrentCompanyOnRoute, { once: true });
  } else {
    loadCurrentCompanyOnRoute();
  }
}
