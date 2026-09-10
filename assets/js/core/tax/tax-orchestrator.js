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
import { isCanonicalBaselineScenario } from '../baseline-contract.js';
import { buildTaxPeriodMetadata } from './tax-period-contract.js';

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
  periodMetadata = null,
  taxStudy = null,
  decisionUse = null,
}) {
  return {
    parameter_version: parameterVersion,
    source_version: sourceVersion,
    tax_parameter_hash: `${regimeId}:${parameterVersion}`,
    data_quality_score: qualityReport?.data_quality_score ?? 0,
    precision_mode: qualityReport?.precision_mode || 'top_down_fallback',
    validation_scope: 'parametric_model_reconciliation',
    official_fiscal_validation: false,
    tax_period_contract: periodMetadata,
    decision_use: decisionUse,
    tax_study: taxStudy,
    limitation: 'Resultado parametrizado e reconciliado; não constitui validação fiscal oficial.',
  };
}

function buildTaxScopeMetadata({ calculationMode, precisionMode, sourceContext, periodMetadata }) {
  return {
    calculation_mode: calculationMode,
    precision_mode: precisionMode,
    validation_scope: 'parametric_model_reconciliation',
    official_fiscal_validation: false,
    source_classification: sourceContext?.package_name
      ? 'official_reference_parameters'
      : 'internal_reference_or_fallback',
    tax_period_contract: periodMetadata,
    coverage_status: null,
    decision_use: null,
    scope_note:
      'Aplica parâmetros disponíveis e reconcilia o resultado; não substitui validação fiscal oficial.',
  };
}

function buildTaxStudyMetadata({
  regimeId,
  parameterVersion,
  sourceContext,
  qualityReport = null,
  taxInputMatchSummary = null,
}) {
  const complementAvailable = sourceContext?.available !== false && Boolean(sourceContext);
  const validationChecklist = Array.isArray(sourceContext?.validation_checklist)
    ? sourceContext.validation_checklist
    : [];
  const legalReview = validationChecklist.find((item) => item?.test === 'legal_tax_review');
  const pendingItems = validationChecklist
    .filter((item) => item?.status && item.status !== 'pass')
    .map((item) => item.test || item.name)
    .filter(Boolean);
  const sources = Array.isArray(sourceContext?.source_summary)
    ? sourceContext.source_summary.map((source) => ({
        source_ref: source.source_file || source.key || null,
        source_type: source.source_type || null,
        source_confidence: source.source_confidence || null,
        role: source.label || null,
        notes: source.notes || null,
      }))
    : [];
  const assumptions = Array.isArray(sourceContext?.tax_assumptions)
    ? sourceContext.tax_assumptions.map((assumption) => ({
        assumption_id: assumption.assumption_id || null,
        description: assumption.description || null,
        source_ref: assumption.source_ref || null,
        confidence: assumption.source_confidence || null,
      }))
    : [];
  const validationStatus = complementAvailable
    ? legalReview?.status === 'pending' || pendingItems.length
      ? 'registered_validation_pending'
      : 'registered'
    : 'not_available';
  return {
    study_id: 'estudo_proprio_tributacao_visagio_v1',
    study_type: 'parametric_internal_tax_study',
    status: validationStatus,
    scope: {
      tax_scope: sourceContext?.tax_manifest?.tax_scope || 'logistics_network_simulation',
      regimes: sourceContext?.tax_manifest?.main_scenarios || [regimeId],
      flow_grain: 'fluxo com UF destino válida e receita explícita',
      included_flow_count: qualityReport?.eligible_flow_count ?? null,
      excluded_flow_count: qualityReport?.uncovered_flow_count ?? null,
    },
    regime_id: regimeId,
    parameter_version: parameterVersion,
    source_context: sourceContext?.package_name || null,
    sources,
    assumptions,
    coverage: {
      input_flow_count: qualityReport?.input_flow_count ?? null,
      eligible_flow_count: qualityReport?.eligible_flow_count ?? null,
      input_coverage_ratio: qualityReport?.input_coverage_ratio ?? null,
      destination_coverage_ratio: qualityReport?.destination_coverage_ratio ?? null,
      origin_coverage_ratio: qualityReport?.origin_coverage_ratio ?? null,
      revenue_coverage_ratio: qualityReport?.revenue_coverage_ratio ?? null,
      excluded_missing_revenue_count: qualityReport?.excluded_missing_revenue_count ?? null,
      missing_origin_uf_count: qualityReport?.missing_origin_uf_count ?? null,
      complete_fiscal_flow_count: qualityReport?.flows_with_complete_fiscal_data ?? null,
      complete_fiscal_coverage_ratio: qualityReport?.complete_fiscal_coverage_ratio ?? null,
      proxy_flow_count: qualityReport?.proxy_flow_count ?? null,
      observed_flow_count: taxInputMatchSummary?.observed_flow_count ?? null,
      destination_proxy_flow_count: taxInputMatchSummary?.destination_proxy ?? null,
      fallback_flow_count: taxInputMatchSummary?.fallback_flow_count ?? null,
    },
    version: {
      parameter_version: parameterVersion,
      source_version: sourceContext?.package_name || null,
      tax_parameter_hash: `${regimeId}:${parameterVersion}`,
    },
    validation: {
      status: validationStatus,
      legal_tax_review: legalReview?.status || 'not_available',
      official_fiscal_validation: false,
      pending_items: pendingItems,
    },
    official_fiscal_validation: false,
    limitation:
      'O estudo próprio complementa a leitura do modelo, mas não substitui a validação tributária da empresa por documentos, NCM, CFOP, CST, origem, destino e período.',
    next_validation:
      'Revisar os fluxos sem origem ou classificação completa com a documentação fiscal própria antes de decisão executiva.',
  };
}

function isCanonicalBaselineInput(input) {
  return isCanonicalBaselineScenario({
    companyId: input.scenario?.company_id || input.baselineBundle?.model?.company_id,
    scenario: input.scenario,
    baselineBundle: input.baselineBundle,
  });
}

function resolveFiscalCategoryRules(config, regimeId) {
  const regimeRules = config.regimes?.[regimeId]?.category_rules;
  const raw =
    regimeRules && Object.keys(regimeRules).length ? regimeRules : config.category_rules || null;
  if (!raw) return null;
  if (raw.categories) return raw;
  return {
    default_category: config.default_category || 'default_goods',
    categories: raw,
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
    fiscalCategoryRules: resolveFiscalCategoryRules(config, regimeId),
  });
  const quality = auditTaxFlowCoverage(fiscal.fiscal_flows, fiscal.quality_report);
  const precisionMode = quality.precision_mode;
  const calculationMode = precisionMode;
  const baseTax = input.baseTaxBlock || {};
  const disabled = regimeId === 'disabled' || input.taxMode === 'disabled';
  const sourceContext = input.baselineBundle?.complements || null;
  const periodMetadata = buildTaxPeriodMetadata({
    regimeId,
    regime: config.regimes?.[regimeId] || {},
    scenario: input.scenario,
    sourceContext,
  });
  const periodWarnings = [
    periodMetadata.selected_period?.source_status === 'timeline_row_unavailable'
      ? 'Período tributário selecionado não foi localizado no cronograma oficial carregado.'
      : null,
    periodMetadata.model_weights?.status === 'model_parameter_differs_from_timeline'
      ? 'Os pesos do cálculo diferem dos pesos do cronograma oficial porque representam mistura de resultados do modelo, não a participação legal ICMS/ISS versus IBS.'
      : null,
    regimeId !== 'current' &&
    periodMetadata.reform_rate_provenance?.status === 'source_rate_not_defined_model_parameter'
      ? 'As taxas numéricas da reforma são parâmetros do modelo; o pacote oficial carregado fornece cronograma, não uma tabela completa de alíquotas efetivas por operação.'
      : null,
  ].filter(Boolean);
  const parameterVersion = input.parameters?.parameter_version || '2026-05';
  const taxStudy = buildTaxStudyMetadata({
    regimeId,
    parameterVersion,
    sourceContext,
    qualityReport: quality,
  });
  const decisionUse = quality.coverage_limited ? 'exploratory_only' : 'decision_support';
  const scopeMetadata = {
    ...buildTaxScopeMetadata({
      calculationMode,
      precisionMode,
      sourceContext,
      periodMetadata,
    }),
    coverage_status: quality.coverage_status,
    decision_use: decisionUse,
    tax_study: taxStudy,
  };

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
      tax_coverage: {
        ...quality,
        coverage_pct: quality.coverage_pct ?? quality.coverage_destination_uf * 100,
      },
      decision_use: decisionUse,
      tax_study: taxStudy,
      tax_reconciliation: isCanonicalBaselineInput(input)
        ? baseTax.tax_reconciliation ||
          input.baselineBundle?.tax_results?.tax_reconciliation ||
          null
        : null,
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
      warnings: [...quality.warnings, ...(fiscal.warnings || []), ...periodWarnings],
      explanation: { summary: 'Camada tributária desligada.' },
      audit_trace: buildAuditTrace({
        parameterVersion,
        qualityReport: quality,
        regimeId,
        sourceVersion: sourceContext?.package_name || 'official_reform_sources',
        periodMetadata,
        taxStudy,
        decisionUse,
      }),
      metadata: {
        regime_id: regimeId,
        regime_label: regimeLabel,
        ui_mode: taxMode,
        calculation_mode: 'top_down_fallback',
        precision_mode: precisionMode,
        source_context: sourceContext,
        tax_period_contract: periodMetadata,
        ...scopeMetadata,
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
    regimeDefinition: config.regimes?.[regimeId] || null,
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
  const finalTaxStudy = buildTaxStudyMetadata({
    regimeId,
    parameterVersion,
    sourceContext,
    qualityReport: quality,
    taxInputMatchSummary: combined.tax_input_match_summary || currentResult.tax_input_match_summary,
  });
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
    tax_coverage: {
      ...quality,
      coverage_pct: quality.coverage_pct ?? quality.coverage_destination_uf * 100,
    },
    decision_use: decisionUse,
    tax_study: finalTaxStudy,
    tax_reconciliation: isCanonicalBaselineInput(input)
      ? baseTax.tax_reconciliation || input.baselineBundle?.tax_results?.tax_reconciliation || null
      : null,
    tax_input_match_summary:
      combined.tax_input_match_summary || currentResult.tax_input_match_summary,
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
    warnings: [...(fiscal.warnings || []), ...(quality.warnings || []), ...periodWarnings],
    explanation: {
      summary: `Regime ${regimeLabel} calculado em modo ${calculationMode}.`,
      calculation_mode: calculationMode,
      precision_mode: precisionMode,
    },
    audit_trace: buildAuditTrace({
      parameterVersion,
      qualityReport: quality,
      regimeId,
      sourceVersion: sourceContext?.package_name || 'official_reform_sources',
      periodMetadata,
      taxStudy: finalTaxStudy,
      decisionUse,
    }),
    metadata: {
      regime_id: regimeId,
      regime_label: regimeLabel,
      ui_mode: taxMode,
      calculation_mode: calculationMode,
      precision_mode: precisionMode,
      source: 'tax-orchestrator',
      source_context: sourceContext,
      tax_period_contract: periodMetadata,
      ...scopeMetadata,
      tax_study: finalTaxStudy,
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
