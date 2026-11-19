import { $, escapeHtml, formatBRL, formatNumber, formatPct, metric } from '../../core/common.js';

const COST_LABELS = {
  transfer_cost: 'Transferência',
  distribution_cost: 'Distribuição',
  storage_cost: 'Armazenagem',
  inventory_cost: 'Estoque',
  tax_impact: 'Tributo',
  total_with_tax: 'Total com tributo',
};

function setHtml(id, html) {
  const element = $(id);
  if (element) element.innerHTML = html;
}

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = value;
}

export function renderBaseline({ companyId, library }) {
  const baseline = library.baselineBundle;
  const costs = baseline.costs.costs;

  setText('phase3CompanyLabel', companyId === 'empresa1' ? 'Empresa 1' : 'Empresa 2');
  setHtml(
    'baselineCards',
    [
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
    ].join('')
  );
  renderBaselineFinanceTable(costs);
}

function renderBaselineFinanceTable(costs = {}) {
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

export function renderCdChecks(library) {
  const cds = library.baselineBundle.model.active_cds || [];
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

export function renderLibraryWarnings(library) {
  const existing = $('libraryWarningBanner');
  if (existing) existing.remove();

  const warnings = library.warnings || [];
  if (!warnings.length) return;

  const banner = document.createElement('div');
  banner.id = 'libraryWarningBanner';
  banner.innerHTML = warnings
    .map(
      (warning) =>
        `<div class="alert-box warn"><strong>Aviso de biblioteca</strong><p>${escapeHtml(warning.message)}</p></div>`
    )
    .join('');
  $('baselineCards').before(banner);
}

export function renderScenarioLibrary(library) {
  const scenarios = library.scenarios || [];
  setHtml(
    'scenarioLibrary',
    scenarios
      .map(
        (scenario) =>
          `<button type="button" class="scenario-card" data-load-scenario="${escapeHtml(scenario.scenario_id)}"><strong>${escapeHtml(scenario.scenario_name)}</strong><span>${escapeHtml(scenario.scenario_type)} · ${escapeHtml(scenario.metadata?.source || 'local')}${scenario.monte_carlo?.summary ? ` · MC ${formatPct(scenario.monte_carlo.summary.probability_saving_positive * 100, 0)}` : ''}</span></button>`
      )
      .join('')
  );
}
