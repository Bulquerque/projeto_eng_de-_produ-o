import {
  resolveTaxModeForRegime,
  resolveTaxRegime,
  taxRegimeLabel,
  getTaxReformConfig,
} from '../tax-reform-config.js';
import { buildFiscalFlows } from './fiscal-flow-builder.js';
import { auditTaxFlowCoverage } from './tax-quality-gate.js';
import { calculateCurrentTax } from './current-tax-engine.js';
import { calculateReformTax } from './reform-tax-engine.js';
import { combineTaxResults } from './transition-tax-engine.js';
import { safeNumber } from '../common.js';

function normalizeInput(arg1, arg2, arg3) {
  if (
    arg1 &&
    typeof arg1 === 'object' &&
    ('baselineBundle' in arg1 ||
      'scenario' in arg1 ||
      'rebuiltFlows' in arg1 ||
      'baseTaxBlock' in arg1)
  ) {
    return {
      baselineBundle: arg1.baselineBundle || null,
      scenario: arg1.scenario || null,
      rebuiltFlows: arg1.rebuiltFlows || arg1.flows || [],
      baseTaxBlock: arg1.baseTaxBlock || arg1.base_tax_block || {},
      demandMultiplier: safeNumber(arg1.demandMultiplier ?? arg1.demand_multiplier, 1),
      taxMode: arg1.taxMode ?? arg1.tax_mode ?? null,
      taxRegime: arg1.taxRegime ?? arg1.tax_regime ?? null,
      parameters: arg1.parameters || null,
      config: arg1.config || getTaxReformConfig(),
    };
  }

  return {
    baselineBundle: null,
    scenario: null,
    rebuiltFlows: [],
    baseTaxBlock: arg1 || {},
    demandMultiplier: safeNumber(arg2, 1),
    taxMode: arg3 || null,
    taxRegime: null,
    parameters: null,
    config: getTaxReformConfig(),
  };
}

function buildAuditTrace({
  parameterVersion,
  qualityReport,
  regimeId,
  sourceVersion = 'official_reform_sources',
}) {
  return {
    parameter_version: parameterVersion,
    source_version: sourceVersion,
    tax_parameter_hash: `${regimeId}:${parameterVersion}`,
    data_quality_score: qualityReport?.data_quality_score ?? 0,
    precision_mode: qualityReport?.precision_mode || 'top_down_fallback',
  };
}

export function runTaxCalculation(arg1, arg2, arg3) {
  const input = normalizeInput(arg1, arg2, arg3);
  const config = input.config || getTaxReformConfig();
  const regimeId = resolveTaxRegime({
    taxMode: input.taxMode,
    taxRegime: input.taxRegime,
    year: input.scenario?.changes?.tax_year,
    config,
  });
  const regimeLabel = taxRegimeLabel(regimeId, config);
  const taxMode = resolveTaxModeForRegime(regimeId, config);
  const fiscal = buildFiscalFlows({
    baselineBundle: input.baselineBundle,
    scenario: input.scenario,
    rebuiltFlows: input.rebuiltFlows,
  });
  const quality = auditTaxFlowCoverage(fiscal.fiscal_flows);
  const precisionMode = quality.precision_mode;
  const calculationMode = quality.blocked ? 'top_down_fallback' : precisionMode;
  const baseTax = input.baseTaxBlock || {};
  const disabled = regimeId === 'disabled' || input.taxMode === 'disabled';
  const sourceContext = input.baselineBundle?.complements || null;

  if (disabled) {
    return {
      tax_regime: regimeId,
      regime_label: regimeLabel,
      tax_mode: 'disabled',
      calculation_mode: 'top_down_fallback',
      precision_mode: precisionMode,
      total_tax: 0,
      total_tax_impact: 0,
      total_current_tax: 0,
      total_reform_tax: 0,
      cbs_total: 0,
      ibs_total: 0,
      selective_tax_total: 0,
      credits_total: 0,
      tax_delta_vs_baseline: -safeNumber(baseTax.total_tax_impact, 0),
      tax_breakdown_by_component: {
        current_tax: 0,
        cbs_total: 0,
        ibs_total: 0,
        selective_tax_total: 0,
        credits_total: 0,
      },
      tax_breakdown_by_destination_uf: {},
      tax_breakdown_by_fiscal_category: {},
      flow_breakdown: [],
      warnings: [...quality.warnings, ...(fiscal.warnings || [])],
      explanation: { summary: 'Camada tributária desligada.' },
      audit_trace: buildAuditTrace({
        parameterVersion: '2026-05',
        qualityReport: quality,
        regimeId,
        sourceVersion: sourceContext?.package_name || 'official_reform_sources',
      }),
      metadata: {
        regime_id: regimeId,
        regime_label: regimeLabel,
        ui_mode: taxMode,
        calculation_mode: 'top_down_fallback',
        precision_mode: precisionMode,
        source_context: sourceContext,
      },
      source_context: sourceContext,
    };
  }

  const currentResult = calculateCurrentTax({
    fiscalFlows: fiscal.fiscal_flows,
    baseTaxBlock: baseTax,
    demandMultiplier: input.demandMultiplier,
    baselineBundle: input.baselineBundle,
  });
  const reformResult = calculateReformTax({
    fiscalFlows: fiscal.fiscal_flows,
    taxRegime: regimeId,
    demandMultiplier: input.demandMultiplier,
    parameters: input.parameters,
  });
  const combined =
    regimeId === 'current'
      ? currentResult
      : combineTaxResults({
          currentResult,
          reformResult,
          regime: config.regimes?.[regimeId] || {},
        });

  const totalTax = safeNumber(combined.total_tax, safeNumber(baseTax.total_tax_impact, 0));
  return {
    tax_regime: regimeId,
    regime_label: regimeLabel,
    tax_mode: taxMode,
    calculation_mode: calculationMode,
    precision_mode: precisionMode,
    total_tax: totalTax,
    total_tax_impact: totalTax,
    total_current_tax: safeNumber(combined.total_current_tax, currentResult.total_current_tax),
    total_reform_tax: safeNumber(combined.total_reform_tax, reformResult.total_reform_tax),
    cbs_total: safeNumber(combined.cbs_total, reformResult.cbs_total),
    ibs_total: safeNumber(combined.ibs_total, reformResult.ibs_total),
    selective_tax_total: safeNumber(combined.selective_tax_total, reformResult.selective_tax_total),
    credits_total: safeNumber(combined.credits_total, reformResult.credits_total),
    tax_delta_vs_baseline: totalTax - safeNumber(baseTax.total_tax_impact, 0),
    tax_breakdown_by_component: combined.tax_breakdown_by_component || {
      current_tax: currentResult.total_current_tax,
      cbs_total: reformResult.cbs_total,
      ibs_total: reformResult.ibs_total,
      selective_tax_total: reformResult.selective_tax_total,
      credits_total: reformResult.credits_total,
    },
    tax_breakdown_by_destination_uf: combined.tax_breakdown_by_destination_uf || {},
    tax_breakdown_by_fiscal_category: combined.tax_breakdown_by_fiscal_category || {},
    flow_breakdown: combined.flow_breakdown || [],
    warnings: [...(fiscal.warnings || []), ...(quality.warnings || [])],
    explanation: {
      summary: `Regime ${regimeLabel} calculado em modo ${calculationMode}.`,
      calculation_mode: calculationMode,
      precision_mode: precisionMode,
    },
    audit_trace: buildAuditTrace({
      parameterVersion: '2026-05',
      qualityReport: quality,
      regimeId,
      sourceVersion: sourceContext?.package_name || 'official_reform_sources',
    }),
    metadata: {
      regime_id: regimeId,
      regime_label: regimeLabel,
      ui_mode: taxMode,
      calculation_mode: calculationMode,
      precision_mode: precisionMode,
      source: 'tax-orchestrator',
      source_context: sourceContext,
    },
    mode: taxMode,
    breakdown: {
      current_component: safeNumber(combined.total_current_tax, currentResult.total_current_tax),
      cbs_component: safeNumber(combined.cbs_total, reformResult.cbs_total),
      ibs_component: safeNumber(combined.ibs_total, reformResult.ibs_total),
      selective_tax: safeNumber(combined.selective_tax_total, reformResult.selective_tax_total),
      credits: safeNumber(combined.credits_total, reformResult.credits_total),
      baseline_reference_tax: safeNumber(baseTax.total_tax_impact, 0),
    },
    source_context: sourceContext,
  };
}
