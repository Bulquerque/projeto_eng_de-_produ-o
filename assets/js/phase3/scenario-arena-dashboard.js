import { $, escapeHtml, formatBRL, formatNumber, formatPct, metric } from '../shared/common.js';
import { loadScenarioLibrary } from './scenario-library.js';
import { buildScenarioFromForm } from './scenario-builder.js';
import { validateScenario } from './scenario-validator.js';
import { runScenario } from './scenario-simulator.js';
import {
  buildComparableBaselineResult,
  compareScenarios,
  componentDelta,
} from './scenario-comparator.js';
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
import { appendSharedDebugEntry } from '../shared/debug-tools.js';
import {
  buildScenarioSummary,
  formatInventoryDaysDisplay,
  formatMultiplierDisplay,
} from '../shared/scenario-summary.js';
import {
  getTaxRegimeDefinition,
  resolveTaxRegime,
  resolveTaxModeForRegime,
  taxRegimeLabel,
} from '../shared/tax-reform-config.js';
import {
  renderScenarioComparisonChart,
  renderMonteCarloHistogram,
  renderMonteCarloPercentileCurve,
  renderMonteCarloScatter,
  renderMonteCarloRiskDonut,
  renderMonteCarloTotalCurve,
  renderMonteCarloDriverImportance,
} from './charts.js';

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
  inventory_days: 45,
  wacc: 0.15,
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

const MONTE_CARLO_DRIVER_LABELS = {
  freight_multiplier: 'Frete',
  demand_multiplier: 'Demanda',
  inventory_days: 'Dias de estoque',
  wacc: 'WACC',
  tax_multiplier: 'Tributo',
};

function monteCarloProfileLabel(profile) {
  return (
    {
      conservative: 'Conservador',
      balanced: 'Equilibrado',
      broad: 'Amplo',
    }[profile] || 'Equilibrado'
  );
}

function monteCarloDriverLabel(driver) {
  return MONTE_CARLO_DRIVER_LABELS[driver] || driver || '—';
}

function monteCarloInterpretation(summary) {
  if (!summary) return 'Rode o cenário para visualizar a leitura probabilística.';
  if (summary.risk_band === 'high') {
    return 'A distribuição indica risco relevante de perda de saving. Vale revisar premissas e drivers mais voláteis.';
  }
  if (summary.risk_band === 'medium') {
    return 'O cenário mantém saving na maior parte das amostras, mas ainda existe dispersão que merece atenção.';
  }
  return 'O cenário mostra estabilidade razoável nas amostras e sustentação probabilística para a decisão.';
}

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
  state.monteCarloConfig = buildMonteCarloConfig(config);
}

const state = {
  companyId: 'empresa1',
  library: null,
  currentScenario: null,
  currentResult: null,
  comparisonBaseline: null,
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
  state.comparisonBaseline = null;
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
        <div><dt>Peso sistema atual</dt><dd>${formatPct(Number(regime.legacy_weight || 0) * 100, 1)}</dd></div>
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
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
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
      'Fluxos realocados',
      formatNumber(result.flow_summary?.reallocated_flows || 0),
      `de ${formatNumber(result.flow_summary?.total_flows || 0)} fluxos`
    ),
  ]);
  renderScenarioExecutiveTable();

  renderScenarioComparisonChart(state.library.baselineBundle.costs.costs, result.costs);
}

function renderScenarioExecutiveTable() {
  if (!state.currentResult) {
    renderEmpty('scenarioExecutiveTable', EMPTY_STATE.result);
    return;
  }
  const base = state.library?.baselineBundle?.costs?.costs || {};
  const result = state.currentResult;
  const quality = state.quality;
  const saving = Number(base.total_with_tax || 0) - Number(result.total_with_tax || 0);
  const savingPct = base.total_with_tax ? (saving / Number(base.total_with_tax)) * 100 : 0;
  const rows = [
    ['Baseline', formatBRL(base.total_with_tax, true), '—', 'referência'],
    [
      result.scenario_name,
      formatBRL(result.total_with_tax, true),
      formatBRL(saving, true),
      formatPct(savingPct, 2),
    ],
    [
      'Quality Score',
      quality?.quality_score ?? '—',
      'vs ideal',
      quality?.quality_score !== undefined ? `${Number(quality.quality_score) - 100}` : '—',
    ],
  ];
  setHtml(
    'scenarioExecutiveTable',
    `<table class="executive-table-premium"><thead><tr><th>Item</th><th>Total/Score</th><th>Delta Absoluto</th><th>Delta %</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${escapeHtml(r[0])}</td><td>${escapeHtml(r[1])}</td><td>${escapeHtml(r[2])}</td><td class="${String(r[3]).includes('-') ? 'delta-negative' : String(r[3]).includes('%') ? 'delta-positive' : ''}">${escapeHtml(r[3])}</td></tr>`).join('')}</tbody></table>`
  );
}

function renderComponentDeltas() {
  if (!state.currentResult) {
    renderEmpty('componentDeltaPanel', EMPTY_STATE.delta);
    return;
  }

  const deltas = componentDelta(
    state.library.baselineBundle,
    state.currentResult,
    state.comparisonBaseline
  );
  setHtml(
    'componentDeltaPanel',
    deltas
      .map(
        (delta) =>
          `<div class="breakdown-row"><div><strong>${escapeHtml(COST_LABELS[delta.metric] || delta.metric)}</strong><span>${formatPct(delta.baseline ? (delta.delta / delta.baseline) * 100 : 0, 2)} vs baseline</span></div><div class="breakdown-bar"><span style="width:${Math.min(100, (Math.abs(delta.delta) / Math.max(1, Math.abs(delta.baseline))) * 100)}%"></span></div><b class="${delta.delta <= 0 ? 'delta-positive' : 'delta-negative'}">${formatBRL(delta.delta)}</b></div>`
      )
      .join('')
  );
}

function renderComparison() {
  if (!state.comparison) {
    renderEmpty('comparisonTable', EMPTY_STATE.comparison);
    renderEmpty('componentDeltaPanel', EMPTY_STATE.delta);
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
        },
      },
      baselineTotal: state.comparison.comparison[0]?.total_with_tax || 0,
    }),
    rank_by_total_cost: row.rank_by_total_cost,
    status: row.status,
  }));
  setHtml(
    'comparisonTable',
    `<table><thead><tr><th>Cenário</th><th>CDs</th><th>Frete</th><th>Demanda</th><th>Estoque</th><th>Regime tributário</th><th>Transferência</th><th>Tributo</th><th>Total</th><th>Saving</th><th>Saving %</th><th>Rank</th><th>Status</th></tr></thead><tbody>${rows
      .map(
        (row) =>
          `<tr><td>${escapeHtml(row.scenario_name)}</td><td>${formatNumber(row.active_cds_count)}</td><td>${escapeHtml(formatMultiplierDisplay(row.freight_multiplier))}</td><td>${escapeHtml(formatMultiplierDisplay(row.demand_multiplier))}</td><td>${escapeHtml(formatInventoryDaysDisplay(row.inventory_days))}</td><td>${escapeHtml(row.tax_regime_label)}</td><td>${formatBRL(row.transfer_cost)}</td><td>${formatBRL(row.tax_impact)}</td><td>${formatBRL(row.total_with_tax)}</td><td class="${row.saving_abs >= 0 ? 'delta-positive' : 'delta-negative'}">${formatBRL(row.saving_abs)}</td><td>${formatPct(row.saving_pct, 2)}</td><td>${row.rank_by_total_cost}</td><td>${escapeHtml(row.status)}</td></tr>`
      )
      .join('')}</tbody></table>`
  );

  renderComponentDeltas();
  renderLibraryComparisonTable();
}

function renderLibraryComparisonTable() {
  if (!state.library) {
    renderEmpty('scenarioLibraryComparisonTable', EMPTY_STATE.comparison);
    return;
  }
  const formatMultiplier = (value) =>
    `${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`;
  const isHiddenScenario = (scenario) =>
    /apenas\s+malha/i.test(String(scenario?.scenario_name || scenario?.name || '')) ||
    /apenas\s+malha/i.test(String(scenario?.scenario_id || ''));
  const baselineTotal = Number(state.library.baselineBundle.costs.costs.total_with_tax || 0);
  const rows = [
    {
      ...buildScenarioSummary({
        scenario: {
          scenario_id: 'baseline',
          scenario_name: 'Baseline',
          scenario_type: 'referência',
          changes: {
            active_cds: state.library.baselineBundle.model?.active_cds || [],
            freight_multiplier: 1,
            demand_multiplier: 1,
            inventory_days: 45,
            tax_mode: 'current',
          },
        },
        result: {
          total_with_tax: baselineTotal,
          costs: state.library.baselineBundle.costs.costs || {},
          tax_results: state.library.baselineBundle.tax_results?.tax_results || {},
        },
        baselineTotal,
      }),
      type: 'referência',
    },
  ];
  const libraryRows = (state.library.scenarios || [])
    .filter((scenario) => !isHiddenScenario(scenario))
    .slice(0, 8)
    .map((scenario) => {
      const result = runScenario({
        companyId: state.companyId,
        scenario,
        baselineBundle: state.library.baselineBundle,
      });
      const quality = evaluateScenarioQuality({
        scenarioResult: result,
        baselineBundle: state.library.baselineBundle,
      });
      return {
        ...buildScenarioSummary({
          scenario,
          result,
          quality,
          baselineTotal,
        }),
        type: scenario.scenario_type || 'biblioteca',
      };
    });
  const current =
    state.currentResult && !isHiddenScenario(state.currentResult.scenario || state.currentResult)
      ? [
          {
            ...buildScenarioSummary({
              scenario: state.currentResult.scenario,
              result: state.currentResult,
              quality: state.quality,
              baselineTotal,
            }),
            scenario_name: `${state.currentResult.scenario_name} (atual)`,
            type: 'customizado',
          },
        ]
      : [];
  setHtml(
    'scenarioLibraryComparisonTable',
    `<table><thead><tr><th>Cenário</th><th>Tipo</th><th>CDs</th><th>Frete</th><th>Demanda</th><th>Estoque</th><th>Regime tributário</th><th>Transferência</th><th>Tributo</th><th>Total</th><th>Saving</th><th>Saving %</th><th>Quality</th><th>Risco</th></tr></thead><tbody>${[...rows, ...current, ...libraryRows].map((row) => `<tr><td>${escapeHtml(row.scenario_name)}</td><td>${escapeHtml(row.type || '—')}</td><td>${escapeHtml(String(row.active_cds_count ?? '—'))}</td><td>${escapeHtml(formatMultiplier(row.freight_multiplier))}</td><td>${escapeHtml(formatMultiplier(row.demand_multiplier))}</td><td>${escapeHtml(formatInventoryDaysDisplay(row.inventory_days))}</td><td>${escapeHtml(row.tax_regime_label || '—')}</td><td>${formatBRL(row.transfer_cost, true)}</td><td>${formatBRL(row.tax_impact, true)}</td><td>${formatBRL(row.total_with_tax, true)}</td><td class="${row.saving_abs >= 0 ? 'delta-positive' : 'delta-negative'}">${formatBRL(row.saving_abs, true)}</td><td>${formatPct(row.saving_pct, 2)}</td><td>${escapeHtml(row.quality_score == null ? '—' : String(row.quality_score))}</td><td>${escapeHtml(row.risk_level || '—')}</td></tr>`).join('')}</tbody></table>`
  );
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

  const costs = state.currentResult?.costs || {};
  const fallback = costs.fallback_usage || {};
  const fallbackItems = [];
  if (fallback.cross_company_transfer_proxy_flows > 0) {
    fallbackItems.push(
      `Proxy cruzada de transferência: ${formatNumber(fallback.cross_company_transfer_proxy_flows, 0)} fluxo(s), ${formatPct(fallback.cross_company_transfer_proxy_volume_share_pct || 0, 1)} do peso e ${formatPct(fallback.cross_company_transfer_proxy_cost_share_pct || 0, 1)} do custo físico.`
    );
  }
  if (fallback.missing_transfer_distance_flows > 0) {
    fallbackItems.push(
      `Fallback de distância: ${formatNumber(fallback.missing_transfer_distance_flows, 0)} fluxo(s), ${formatPct(fallback.missing_transfer_distance_cost_share_pct || 0, 1)} do custo físico.`
    );
  }
  if (fallback.revenue_pct_fallback_cost_brl > 0) {
    fallbackItems.push(
      `Fallback de 2,5% da receita: ${formatPct(fallback.revenue_pct_fallback_revenue_share_pct || 0, 1)} da receita coberta e ${formatPct(fallback.revenue_pct_fallback_cost_share_pct || 0, 1)} do custo físico.`
    );
  }
  if (fallback.storage_proxy_used) {
    fallbackItems.push(
      `Armazenagem proporcional: ${formatPct(fallback.storage_proxy_cost_share_pct || 0, 1)} do custo físico.`
    );
  }
  const fallbackSummary = `<div class="alert-box neutral"><strong>Cobertura de premissas e fallbacks</strong><p>Estoque: ${escapeHtml(costs.inventory_calculation_mode || 'days_wacc_only')} · pooling por CDs: ${costs.inventory_pooling_effect_included ? 'incluído' : 'não incluído'}.</p>${fallbackItems.length ? `<ul>${fallbackItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p>Nenhum fallback operacional dinâmico acionado.</p>'}</div>`;

  setHtml(
    'qualityPanel',
    `<div class="fit-score-card ${qualityStatusClass(quality.quality_score)}"><span class="metric-label">Quality Score</span><strong class="fit-score-value">${quality.quality_score}</strong><p>Risco: <b>${escapeHtml(riskLabel(quality.risk_level))}</b></p></div><div class="alert-box neutral"><strong>Regime fiscal</strong><p>${escapeHtml(tax.regime_label || taxRegimeLabel(scenarioTaxRegime(state.currentResult?.scenario)))}</p><p class="small-note">Modo de cálculo: ${escapeHtml(tax.calculation_mode || '—')} · Precisão: ${escapeHtml(tax.precision_mode || '—')}</p></div>${fallbackSummary}${alerts}${taxWarnings}`
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

function renderMonteCarloSummaryCards() {
  const summary = state.monteCarlo?.summary;
  const el = $('monteCarloSummaryCards');
  const tableEl = $('monteCarloSummaryTable');
  if (!summary) {
    if (el) el.innerHTML = '';
    if (tableEl)
      tableEl.innerHTML =
        '<div class="empty-state">Rode o cenário para visualizar a distribuição probabilística.</div>';
    return;
  }

  const driverLabel = monteCarloDriverLabel(summary.most_sensitive_driver);
  const driverCorrelation = Number(summary.most_sensitive_driver_correlation || 0);
  if (el) {
    el.innerHTML = [
      metric(
        'Prob. saving positivo',
        formatPct(summary.probability_saving_positive * 100, 1),
        `risco ${summary.risk_band}`
      ),
      metric(
        'Prob. saving negativo',
        formatPct(summary.probability_saving_loss * 100, 1),
        'cenário abaixo do baseline'
      ),
      metric(
        'Saving mediano',
        formatPct(summary.median_saving_pct, 1),
        `p10 ${formatPct(summary.p10_saving_pct, 1)} · p90 ${formatPct(summary.p90_saving_pct, 1)}`
      ),
      metric('Desvio saving', formatPct(summary.stddev_saving_pct, 1), 'dispersão entre amostras'),
      metric(
        'Custo mediano',
        formatBRL(summary.median_total_with_tax, true),
        `p10 ${formatBRL(summary.p10_total_with_tax, true)} · p90 ${formatBRL(summary.p90_total_with_tax, true)}`
      ),
      metric(
        'Custo esperado',
        formatBRL(summary.mean_total_with_tax, true),
        `desvio ${formatBRL(summary.stddev_total_with_tax, true)}`
      ),
      metric(
        'Driver mais influente',
        driverLabel,
        `${driverCorrelation >= 0 ? '+' : ''}${driverCorrelation.toFixed(2)} de correlação`
      ),
      metric(
        'Percentil do cenário',
        `${Number(summary.deterministic_percentile_saving_pct || 0).toFixed(0)}º`,
        'posição do cenário base na distribuição'
      ),
      metric('Iterações', formatNumber(summary.iterations, 0), `seed ${summary.seed}`),
    ].join('');
  }

  if (tableEl) {
    tableEl.innerHTML = `
      <table class="executive-table-premium">
        <thead><tr><th>Indicador</th><th>Valor</th></tr></thead>
        <tbody>
          <tr><td>Perfil</td><td>${escapeHtml(monteCarloProfileLabel(summary.profile))}</td></tr>
          <tr><td>Leitura executiva</td><td>${escapeHtml(monteCarloInterpretation(summary))}</td></tr>
          <tr><td>Prob. saving positivo</td><td>${formatPct(summary.probability_saving_positive * 100, 1)}</td></tr>
          <tr><td>Prob. saving negativo</td><td>${formatPct(summary.probability_saving_loss * 100, 1)}</td></tr>
          <tr><td>Saving p10 / p50 / p90</td><td>${formatPct(summary.p10_saving_pct, 1)} · ${formatPct(summary.median_saving_pct, 1)} · ${formatPct(summary.p90_saving_pct, 1)}</td></tr>
          <tr><td>Total p10 / p50 / p90</td><td>${formatBRL(summary.p10_total_with_tax, true)} · ${formatBRL(summary.median_total_with_tax, true)} · ${formatBRL(summary.p90_total_with_tax, true)}</td></tr>
          <tr><td>Driver mais influente</td><td>${escapeHtml(driverLabel)} (${driverCorrelation >= 0 ? '+' : ''}${driverCorrelation.toFixed(2)})</td></tr>
        </tbody>
      </table>
    `;
  }
}

function renderMonteCarlo() {
  renderMonteCarloSummaryCards();
  const summary = state.monteCarlo?.summary;
  renderMonteCarloHistogram(summary?.histogram);
  renderMonteCarloPercentileCurve(summary?.percentile_curve);
  renderMonteCarloTotalCurve(summary?.total_percentile_curve);
  renderMonteCarloRiskDonut(summary);
  renderMonteCarloDriverImportance(
    (summary?.driver_importance || []).map((item) => ({
      ...item,
      label: monteCarloDriverLabel(item.driver),
    }))
  );
  renderMonteCarloScatter(
    state.monteCarlo?.samples || [],
    summary?.scatter_driver || state.monteCarloConfig?.scatter_driver || 'freight_multiplier',
    monteCarloDriverLabel(
      summary?.scatter_driver || state.monteCarloConfig?.scatter_driver || 'freight_multiplier'
    )
  );
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
    baselineResult: state.comparisonBaseline,
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
    state.comparisonBaseline = null;
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
  state.comparisonBaseline = buildComparableBaselineResult({
    companyId: state.companyId,
    baselineBundle: state.library.baselineBundle,
    scenario,
  });
  state.currentResult = {
    ...state.currentResult,
    baseline_total: state.comparisonBaseline.total_with_tax,
    comparison_basis: 'same_tax_regime',
  };
  state.quality = evaluateScenarioQuality({
    scenarioResult: state.currentResult,
    baselineBundle: state.library.baselineBundle,
  });
  state.comparison = compareScenarios({
    companyId: state.companyId,
    baselineBundle: state.library.baselineBundle,
    baselineResult: state.comparisonBaseline,
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
}
