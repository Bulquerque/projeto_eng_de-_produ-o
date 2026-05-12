import {escapeHtml, formatBRL, formatNumber, formatPct, metric} from '../shared/common.js';
import { resolveTaxRegime, taxRegimeLabel } from '../shared/tax-reform-config.js';

function row(label, value) {
  return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`;
}

export function buildBaselineCardsHtml({bundle, companyId}) {
  const c = bundle?.costs?.costs || {};
  const label = companyId === 'empresa2' ? 'Empresa 2' : 'Empresa 1';
  return [
    metric('Baseline', bundle?.model?.scenario_id || '—', label),
    metric('CDs ativos', formatNumber((bundle?.model?.active_cds || []).length), 'base da Fase 2'),
    metric('Total baseline', formatBRL(c.total_with_tax, true), 'com tributo'),
    metric('Fluxos', formatNumber((bundle?.flows || []).length), 'base para candidatos')
  ].join('');
}

export function buildOptimizerInputTableHtml({bundle, companyId, constraints, optimizerConfig, searchLog}) {
  const c = bundle?.costs?.costs || {};
  const rows = [
    ['Empresa', companyId === 'empresa2' ? 'Empresa 2' : 'Empresa 1'],
    ['Baseline usado', bundle?.model?.scenario_id || '—'],
    ['CDs ativos no baseline', formatNumber((bundle?.model?.active_cds || []).length)],
    ['Fluxos avaliados', formatNumber((bundle?.flows || []).length)],
    ['Total baseline', formatBRL(c.total_with_tax, true)],
    ['Regime fiscal base', taxRegimeLabel(resolveTaxRegime({ taxMode: optimizerConfig?.base_tax_mode, taxRegime: optimizerConfig?.base_tax_regime }))],
    ['Malha permitida', `${formatNumber(constraints.min_active_cds)} a ${formatNumber(constraints.max_active_cds)} CDs`],
    ['Concentração máxima', formatPct(constraints.max_cd_volume_share * 100, 0)],
    ['Risco aceitável', constraints.max_risk_level],
    ['Estratégia', searchLog?.search_strategy || '—'],
    ['Cobertura do espaço', searchLog?.coverage_ratio != null ? formatPct(searchLog.coverage_ratio * 100, 1) : '—'],
    ['Cenários avaliados', searchLog?.simulated_candidates !== undefined ? formatNumber(searchLog.simulated_candidates) : `até ${formatNumber(optimizerConfig.max_candidates)}`]
  ];

  return `<table><thead><tr><th>Insumo</th><th>Valor</th></tr></thead><tbody>${rows.map(([label, value]) => row(label, value)).join('')}</tbody></table>`;
}

export function buildRankingTableHtml(bestScenarios = []) {
  const rows = bestScenarios
    .slice(0, 8)
    .map(s => `<tr><td>${escapeHtml(s.scenario_name || s.scenario_id)}</td><td>${Number(s.final_score).toFixed(1)}</td><td>${escapeHtml(s.result?.tax_results?.regime_label || taxRegimeLabel(s.result?.tax_results?.tax_regime || s.scenario?.changes?.tax_regime || s.scenario?.changes?.tax_mode || 'legacy_current'))}</td><td>${formatBRL(s.result?.total_with_tax, true)}</td><td>${escapeHtml(s.quality?.risk_level || '—')}</td><td>${formatNumber((s.scenario?.changes?.active_cds || []).length)}</td></tr>`)
    .join('');
  return `<table><thead><tr><th>Cenário</th><th>Score</th><th>Regime</th><th>Total</th><th>Risco</th><th>CDs</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function buildTradeoffTableHtml(frontier) {
  const points = frontier?.frontier_points || [];
  const rows = points.slice(0, 10).map(p => `<tr><td>${escapeHtml(p.scenario_name || p.scenario_id)}</td><td>${formatBRL(p.x_total_cost, true)}</td><td>${Number(p.y_quality_score).toFixed(1)}</td><td>${p.is_frontier_candidate ? 'sim' : 'não'}</td></tr>`).join('');
  return `<table><thead><tr><th>Cenário</th><th>Custo</th><th>Qualidade</th><th>Fronteira</th></tr></thead><tbody>${rows}</tbody></table>`;
}
