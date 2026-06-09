import { escapeHtml, formatBRL, formatNumber, formatPct, metric } from '../shared/common.js';
import { resolveTaxRegime, taxRegimeLabel } from '../shared/tax-reform-config.js';
import { CANONICAL_OPTIMIZATION_POLICY } from '../shared/optimization-policy.js';
import {
  buildScenarioSummary,
  formatInventoryDaysDisplay,
  formatMultiplierDisplay,
} from '../shared/scenario-summary.js';

function row(label, value) {
  return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`;
}

export function buildBaselineCardsHtml({ bundle, companyId }) {
  const c = bundle?.costs?.costs || {};
  const label = companyId === 'empresa2' ? 'Empresa 2' : 'Empresa 1';
  return [
    metric('Baseline', bundle?.model?.scenario_id || '—', label),
    metric(
      'CDs ativos',
      formatNumber((bundle?.model?.active_cds || []).length),
      'base do diagnóstico'
    ),
    metric('Total baseline', formatBRL(c.total_with_tax, true), 'com tributo'),
    metric('Fluxos', formatNumber((bundle?.flows || []).length), 'base para candidatos'),
  ].join('');
}

export function buildOptimizerInputTableHtml({
  bundle,
  companyId,
  constraints,
  optimizerConfig,
  searchLog,
}) {
  const c = bundle?.costs?.costs || {};
  const rows = [
    ['Empresa', companyId === 'empresa2' ? 'Empresa 2' : 'Empresa 1'],
    ['Baseline usado', bundle?.model?.scenario_id || '—'],
    ['CDs ativos no baseline', formatNumber((bundle?.model?.active_cds || []).length)],
    ['Fluxos avaliados', formatNumber((bundle?.flows || []).length)],
    ['Total baseline', formatBRL(c.total_with_tax, true)],
    [
      'Regime fiscal fixo',
      taxRegimeLabel(
        resolveTaxRegime({
          taxMode: CANONICAL_OPTIMIZATION_POLICY.tax_mode,
          taxRegime: CANONICAL_OPTIMIZATION_POLICY.tax_regime,
        })
      ),
    ],
    ['Frete fixo', formatMultiplierDisplay(CANONICAL_OPTIMIZATION_POLICY.freight_multiplier)],
    ['Demanda fixa', formatMultiplierDisplay(CANONICAL_OPTIMIZATION_POLICY.demand_multiplier)],
    ['Estoque fixo', formatInventoryDaysDisplay(CANONICAL_OPTIMIZATION_POLICY.inventory_days)],
    ['Variável da busca', 'Apenas CDs ativos'],
    [
      'Malha permitida',
      `${formatNumber(constraints.min_active_cds)} a ${formatNumber(constraints.max_active_cds)} CDs`,
    ],
    ['Concentração máxima', formatPct(constraints.max_cd_volume_share * 100, 0)],
    ['Risco aceitável', constraints.max_risk_level],
    ['Estratégia', searchLog?.search_strategy || '—'],
    [
      'Cobertura do espaço',
      searchLog?.coverage_ratio != null ? formatPct(searchLog.coverage_ratio * 100, 1) : '—',
    ],
    [
      'Cenários avaliados',
      searchLog?.simulated_candidates !== undefined
        ? formatNumber(searchLog.simulated_candidates)
        : `até ${formatNumber(optimizerConfig.max_candidates)}`,
    ],
  ];

  return `<table><thead><tr><th>Insumo</th><th>Valor</th></tr></thead><tbody>${rows.map(([label, value]) => row(label, value)).join('')}</tbody></table>`;
}

export function buildRankingTableHtml(bestScenarios = []) {
  const rows = bestScenarios
    .slice(0, 8)
    .map((s) => {
      const summary = buildScenarioSummary({
        scenario: s.scenario,
        result: s.result,
        quality: s.quality,
        baselineTotal: Number(s.result?.baseline_total ?? 0),
      });
      return `<tr><td>${escapeHtml(summary.scenario_name || s.scenario_id)}</td><td>${Number(s.final_score).toFixed(1)}</td><td>${formatNumber(summary.active_cds_count)}</td><td>${escapeHtml(formatMultiplierDisplay(summary.freight_multiplier))}</td><td>${escapeHtml(formatMultiplierDisplay(summary.demand_multiplier))}</td><td>${escapeHtml(formatInventoryDaysDisplay(summary.inventory_days))}</td><td>${escapeHtml(summary.tax_regime_label)}</td><td>${formatBRL(summary.transfer_cost, true)}</td><td>${formatBRL(summary.tax_impact, true)}</td><td>${formatBRL(summary.total_with_tax, true)}</td><td>${escapeHtml(summary.risk_level || '—')}</td></tr>`;
    })
    .join('');
  return `<table><thead><tr><th>Cenário</th><th>Score</th><th>CDs</th><th>Frete</th><th>Demanda</th><th>Estoque</th><th>Regime tributário</th><th>Transferência</th><th>Tributo</th><th>Total</th><th>Risco</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function buildTradeoffTableHtml(frontier) {
  const points = frontier?.frontier_points || [];
  const rows = points
    .slice(0, 10)
    .map(
      (p) =>
        `<tr><td>${escapeHtml(p.scenario_name || p.scenario_id)}</td><td>${formatBRL(p.x_total_cost, true)}</td><td>${Number(p.y_quality_score).toFixed(1)}</td><td>${p.is_frontier_candidate ? 'sim' : 'não'}</td></tr>`
    )
    .join('');
  return `<table><thead><tr><th>Cenário</th><th>Custo</th><th>Qualidade</th><th>Fronteira</th></tr></thead><tbody>${rows}</tbody></table>`;
}
