import { escapeHtml, formatBRL, formatNumber, formatPct } from '../core/common.js';
import {
  buildScenarioSummary,
  formatInventoryDaysDisplay,
  formatMultiplierDisplay,
} from '../core/scenario-summary.js';

function formatOptionalBRL(value, compact = false) {
  return value === null || value === undefined || value === '' ? '—' : formatBRL(value, compact);
}

function formatOptionalPct(value, digits = 1) {
  return value === null || value === undefined || value === '' ? '—' : formatPct(value, digits);
}

function table(rows) {
  return `<table><thead><tr><th>Indicador</th><th>Valor</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row[0])}</td><td>${escapeHtml(row[1])}</td></tr>`).join('')}</tbody></table>`;
}

export function renderFinalSituationTableHtml({
  companyLabel,
  baselineId,
  selected,
  comparison,
  robustness,
  recommendationLabel,
}) {
  const comp = comparison || {};
  if (!selected) {
    return table([
      ['Empresa', companyLabel],
      ['Baseline', baselineId || '—'],
      ['Cenário selecionado', '— (nenhum cenário elegível)'],
      ['Status do cálculo tributário', 'bloqueado'],
      ['Cobertura fiscal dos fluxos de entrada', '—'],
      ['Total', '—'],
      ['Total baseline', formatOptionalBRL(comp.baseline_total, true)],
      ['Total final', '—'],
      ['Saving absoluto', '—'],
      ['Saving percentual', '—'],
      ['Robustez', '—'],
      ['Suporte da evidência', '—'],
      ['Risco', '—'],
      ['Recomendação', recommendationLabel],
    ]);
  }
  const quality = selected?.quality || {};
  const summary = buildScenarioSummary({
    scenario: selected?.scenario,
    result: selected?.result || selected,
    quality,
    baselineTotal: comp.baseline_total,
  });
  return table([
    ['Empresa', companyLabel],
    ['Baseline', baselineId || '—'],
    ['Cenário selecionado', selected?.scenario_name || selected?.scenario_id || '—'],
    ['CDs', String(summary.active_cds_count)],
    ['Frete', formatMultiplierDisplay(summary.freight_multiplier)],
    ['Demanda', formatMultiplierDisplay(summary.demand_multiplier)],
    ['Estoque', formatInventoryDaysDisplay(summary.inventory_days)],
    ['Regime tributário', summary.tax_regime_label],
    ['Transferência', formatBRL(summary.transfer_cost, true)],
    ['Tributo', formatBRL(summary.tax_impact, true)],
    ['Status do cálculo tributário', selected?.result?.tax_results?.calculation_mode || '—'],
    ['Qualidade dos dados', selected?.result?.data_quality?.status || '—'],
    ['Uso permitido', selected?.result?.data_quality?.decision_use || 'decision_support'],
    ['Estudo próprio tributário', selected?.result?.tax_results?.tax_study?.study_id || '—'],
    [
      'Cobertura fiscal dos fluxos de entrada',
      selected?.result?.tax_results?.tax_coverage?.input_coverage_ratio == null
        ? '—'
        : formatPct(selected.result.tax_results.tax_coverage.input_coverage_ratio * 100),
    ],
    ['Total', formatBRL(summary.total_with_tax, true)],
    ['Total baseline', formatOptionalBRL(comp.baseline_total, true)],
    ['Total final', formatOptionalBRL(comp.scenario_total, true)],
    ['Saving absoluto', formatOptionalBRL(comp.saving_abs, true)],
    ['Saving percentual', formatOptionalPct(comp.saving_pct)],
    [
      robustness?.certified_robustness_score != null ? 'Robustez' : 'Robustez condicional',
      `${formatNumber(robustness?.robustness_score, 0)}/100`,
    ],
    [
      'Certificação da robustez',
      robustness?.certified_robustness_score != null
        ? 'disponível no escopo modelado'
        : 'não certificada — interpretação exploratória',
    ],
    [
      'Suporte da evidência',
      `${formatNumber(selected?.result?.evidence?.evidence_score, 0)}/100 · ${selected?.result?.evidence?.evidence_status || '—'}`,
    ],
    ['Risco', quality.risk_level || '—'],
    ['Recomendação', recommendationLabel],
  ]);
}
