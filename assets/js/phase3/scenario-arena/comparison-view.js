import { $, escapeHtml, formatBRL, formatNumber, formatPct } from '../../core/common.js';
import {
  formatInventoryDaysDisplay,
  formatMultiplierDisplay,
} from '../../core/scenario-summary.js';

const COST_LABELS = {
  transfer_cost: 'Transferência',
  distribution_cost: 'Distribuição',
  storage_cost: 'Armazenagem',
  inventory_cost: 'Estoque',
  tax_impact: 'Tributo',
  total_with_tax: 'Total com tributo',
};

export function renderScenarioExecutiveTable({
  result,
  quality,
  baselineCosts,
  savingResult,
  emptyMessage,
}) {
  if (!result) {
    setHtml('scenarioExecutiveTable', emptyState(emptyMessage));
    return;
  }

  const base = baselineCosts || {};
  const rows = [
    ['Baseline', formatBRL(base.total_with_tax, true), '—', 'referência'],
    [
      result.scenario_name,
      formatBRL(result.total_with_tax, true),
      formatBRL(savingResult.saving_abs, true),
      formatPct(savingResult.saving_pct, 2),
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

export function renderComponentDeltas({ deltas, emptyMessage }) {
  if (!deltas) {
    setHtml('componentDeltaPanel', emptyState(emptyMessage));
    return;
  }

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

export function renderComparisonTable(rows, emptyMessage) {
  if (!rows) {
    setHtml('comparisonTable', emptyState(emptyMessage));
    return;
  }

  setHtml(
    'comparisonTable',
    `<table><thead><tr><th>Cenário</th><th>CDs</th><th>Frete</th><th>Demanda</th><th>Estoque</th><th>Regime tributário</th><th>Fonte tributária</th><th>Transferência</th><th>Tributo</th><th>Total</th><th>Saving</th><th>Saving %</th><th>Rank</th><th>Status</th></tr></thead><tbody>${rows
      .map(
        (row) =>
          `<tr><td>${escapeHtml(row.scenario_name)}</td><td>${formatNumber(row.active_cds_count)}</td><td>${escapeHtml(formatMultiplierDisplay(row.freight_multiplier))}</td><td>${escapeHtml(formatMultiplierDisplay(row.demand_multiplier))}</td><td>${escapeHtml(formatInventoryDaysDisplay(row.inventory_days))}</td><td>${escapeHtml(row.tax_regime_label)}</td><td>${escapeHtml(row.tax_source_label || '—')}</td><td>${formatBRL(row.transfer_cost)}</td><td>${formatBRL(row.tax_impact)}</td><td>${formatBRL(row.total_with_tax)}</td><td class="${row.saving_abs >= 0 ? 'delta-positive' : 'delta-negative'}">${formatBRL(row.saving_abs)}</td><td>${formatPct(row.saving_pct, 2)}</td><td>${row.rank_by_total_cost}</td><td>${escapeHtml(row.status)}</td></tr>`
      )
      .join('')}</tbody></table>`
  );
}

export function renderLibraryComparisonTable(rows, emptyMessage) {
  if (!rows) {
    setHtml('scenarioLibraryComparisonTable', emptyState(emptyMessage));
    return;
  }

  const formatMultiplier = (value) =>
    `${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`;
  setHtml(
    'scenarioLibraryComparisonTable',
    `<table><thead><tr><th>Cenário</th><th>Tipo</th><th>CDs</th><th>Frete</th><th>Demanda</th><th>Estoque</th><th>Regime tributário</th><th>Fonte tributária</th><th>Transferência</th><th>Tributo</th><th>Total</th><th>Saving</th><th>Saving %</th><th>Quality</th><th>Risco</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.scenario_name)}</td><td>${escapeHtml(row.type || '—')}</td><td>${escapeHtml(String(row.active_cds_count ?? '—'))}</td><td>${escapeHtml(formatMultiplier(row.freight_multiplier))}</td><td>${escapeHtml(formatMultiplier(row.demand_multiplier))}</td><td>${escapeHtml(formatInventoryDaysDisplay(row.inventory_days))}</td><td>${escapeHtml(row.tax_regime_label || '—')}</td><td>${escapeHtml(row.tax_source_label || '—')}</td><td>${formatBRL(row.transfer_cost, true)}</td><td>${formatBRL(row.tax_impact, true)}</td><td>${formatBRL(row.total_with_tax, true)}</td><td class="${row.saving_abs >= 0 ? 'delta-positive' : 'delta-negative'}">${formatBRL(row.saving_abs, true)}</td><td>${formatPct(row.saving_pct, 2)}</td><td>${escapeHtml(row.quality_score == null ? '—' : String(row.quality_score))}</td><td>${escapeHtml(row.risk_level || '—')}</td></tr>`).join('')}</tbody></table>`
  );
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function setHtml(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html;
}
