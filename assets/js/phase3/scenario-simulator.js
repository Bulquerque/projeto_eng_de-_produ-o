import { validateScenario } from './scenario-validator.js';
import { rebuildScenarioFlows } from './scenario-flow-rebuilder.js';
import { runTaxCalculation } from '../core/tax/tax-orchestrator.js';
import { calculatePhysicalCosts } from './physical-cost-engine.js';
import { safeNumber } from '../core/common.js';
import { buildEvidenceReport } from '../core/evidence-quality-engine.js';
import {
  isCanonicalBaselineNetwork,
  isCanonicalBaselineScenario,
} from '../core/baseline-contract.js';
import {
  calculateLogisticsTotal,
  calculateTotalWithTax,
  MODEL_DEFAULTS,
} from '../core/model-configuration.js';
import { buildDataQualityAssessment } from '../core/analysis-quality.js';

// ── Tax ──────────────────────────────────────────────────────────────────────

function resolveTaxImpact({ scenario, baselineBundle, rebuilt, demandMultiplier }) {
  const c = scenario.changes || {};
  const taxMode = c.tax_mode || 'current';
  const baseTax = baselineBundle?.tax_results?.tax_results || baselineBundle?.costs?.costs || {};

  const sharedArgs = {
    baseTaxBlock: baseTax,
    flows: rebuilt.flows,
    scenario,
    baselineBundle,
    demandMultiplier,
  };

  if (taxMode === 'disabled') {
    return {
      taxImpact: 0,
      taxDetails: runTaxCalculation({ ...sharedArgs, taxMode, taxRegime: 'disabled' }),
    };
  }

  if (String(taxMode).startsWith('reform_') || c.tax_regime) {
    const details = runTaxCalculation({ ...sharedArgs, taxMode, taxRegime: c.tax_regime });
    return { taxImpact: safeNumber(details.total_tax_impact), taxDetails: details };
  }

  // Regime fiscal padrão do sistema atual.
  const details = runTaxCalculation({
    ...sharedArgs,
    taxMode: 'current',
    taxRegime: 'current',
  });
  const baseFallback = safeNumber(baseTax.total_tax_impact) * demandMultiplier;
  return { taxImpact: safeNumber(details.total_tax_impact, baseFallback), taxDetails: details };
}

function sumLogisticsCosts(costs = {}) {
  return calculateLogisticsTotal({
    transferCost: costs.transfer_cost,
    distributionCost: costs.distribution_cost,
    storageCost: costs.storage_cost,
    inventoryCost: costs.inventory_cost,
  });
}

function alignTaxDetailsToTotal(taxDetails = {}, targetTotal = 0) {
  const target = safeNumber(targetTotal);
  const source = safeNumber(taxDetails.total_tax_impact, target);
  const factor = source > 0 ? target / source : 0;
  const scale = (value) => safeNumber(value) * factor;
  const aligned = {
    ...taxDetails,
    total_tax: target,
    total_tax_impact: target,
    total_current_tax: scale(taxDetails.total_current_tax),
    total_reform_tax: scale(taxDetails.total_reform_tax),
    cbs_total: scale(taxDetails.cbs_total),
    ibs_total: scale(taxDetails.ibs_total),
    selective_tax_total: scale(taxDetails.selective_tax_total),
    credits_total: scale(taxDetails.credits_total),
  };
  if (!source) {
    aligned.total_current_tax = target;
    aligned.tax_breakdown_by_component = {
      ...(taxDetails.tax_breakdown_by_component || {}),
      current_tax: target,
    };
    aligned.breakdown = { ...(taxDetails.breakdown || {}), current_component: target };
  }
  if (Array.isArray(taxDetails.flow_breakdown)) {
    aligned.flow_breakdown = taxDetails.flow_breakdown.map((row) => ({
      ...row,
      current_tax: scale(row.current_tax),
      total_tax: scale(row.total_tax),
    }));
  }
  if (taxDetails.tax_breakdown_by_component) {
    aligned.tax_breakdown_by_component = Object.fromEntries(
      Object.entries(taxDetails.tax_breakdown_by_component).map(([key, value]) => [
        key,
        scale(value),
      ])
    );
  }
  if (taxDetails.breakdown) {
    aligned.breakdown = Object.fromEntries(
      Object.entries(taxDetails.breakdown).map(([key, value]) => [key, scale(value)])
    );
  }
  for (const key of ['tax_breakdown_by_destination_uf', 'tax_breakdown_by_fiscal_category']) {
    if (taxDetails[key]) {
      aligned[key] = Object.fromEntries(
        Object.entries(taxDetails[key]).map(([group, value]) => [group, scale(value)])
      );
    }
  }
  return aligned;
}

function applyCanonicalBaselineReference({ companyId, scenario, baselineBundle, costs }) {
  const baselineNetwork = isCanonicalBaselineNetwork({ companyId, scenario, baselineBundle });
  if (!baselineNetwork) return costs;
  const exactBaseline = isCanonicalBaselineScenario({ companyId, scenario, baselineBundle });

  const official = baselineBundle?.costs?.costs || {};
  const numericOr = (value, fallback) => safeNumber(value, safeNumber(fallback));
  const officialCosts = {
    transfer_cost: numericOr(official.transfer_cost, costs.transfer_cost),
    distribution_cost: numericOr(official.distribution_cost, costs.distribution_cost),
    storage_cost: numericOr(official.storage_cost, costs.storage_cost),
    inventory_cost: numericOr(official.inventory_cost, costs.inventory_cost),
    tax_impact: numericOr(official.tax_impact, costs.tax_impact),
  };
  const freightMultiplier = safeNumber(scenario.changes?.freight_multiplier, 1);
  const demandMultiplier = safeNumber(scenario.changes?.demand_multiplier, 1);
  const scaledCosts = {
    transfer_cost: officialCosts.transfer_cost * freightMultiplier * demandMultiplier,
    distribution_cost: officialCosts.distribution_cost * freightMultiplier * demandMultiplier,
    storage_cost: officialCosts.storage_cost * demandMultiplier,
    inventory_cost: exactBaseline ? officialCosts.inventory_cost : costs.inventory_cost,
    tax_impact: officialCosts.tax_impact * demandMultiplier,
  };
  const officialLogisticsCost = Number.isFinite(Number(official.total_logistics_cost))
    ? Number(official.total_logistics_cost)
    : sumLogisticsCosts(officialCosts);
  const officialTotalWithTax = Number.isFinite(Number(official.total_with_tax))
    ? Number(official.total_with_tax)
    : calculateTotalWithTax({
        logisticsCost: officialLogisticsCost,
        taxImpact: officialCosts.tax_impact,
      });

  const scaledLogisticsCost = sumLogisticsCosts(scaledCosts);
  const scaledTotalWithTax = calculateTotalWithTax({
    logisticsCost: scaledLogisticsCost,
    taxImpact: scaledCosts.tax_impact,
  });
  const anchoredCosts = {
    ...costs,
    ...scaledCosts,
    total_logistics_cost: exactBaseline ? officialLogisticsCost : scaledLogisticsCost,
    total_with_tax: exactBaseline ? officialTotalWithTax : scaledTotalWithTax,
    calculation_method: exactBaseline
      ? 'canonical_baseline_reference'
      : 'canonical_baseline_sensitivity_reference',
    flow_cost_detail: [],
    diagnostics: {
      ...(costs.diagnostics || {}),
      canonical_baseline_reference: true,
      canonical_baseline_sensitivity: !exactBaseline,
      canonical_sensitivity_drivers: {
        freight_multiplier: freightMultiplier,
        demand_multiplier: demandMultiplier,
        inventory_days: safeNumber(scenario.changes?.inventory_days, MODEL_DEFAULTS.inventory_days),
        wacc: safeNumber(scenario.changes?.wacc, MODEL_DEFAULTS.reference_wacc),
      },
      canonical_baseline_source:
        companyId === 'empresa2' ? 'phase2_scenario_totals' : 'phase2_runtime_recomputed',
      flow_detail_available: false,
    },
    physical_warnings: [
      ...(costs.physical_warnings || []),
      'Baseline canônico preservado como referência oficial da Fase 2; não é substituído pela estimativa física de cenário.',
    ],
  };

  if (!exactBaseline) {
    anchoredCosts.physical_warnings.push(
      'Sensibilidade escalar ancorada nos componentes do baseline canônico; frete, demanda, dias de estoque e WACC são aplicados sem reprocessar proxies físicos na mesma rede.'
    );
  }

  return anchoredCosts;
}

// ── Costs ─────────────────────────────────────────────────────────────────────

function calculateScenarioCosts({ companyId, scenario, baselineBundle, rebuilt }) {
  const dm = safeNumber(scenario.changes?.demand_multiplier, 1);
  const physical = calculatePhysicalCosts({ companyId, scenario, baselineBundle, rebuilt });
  const { taxImpact, taxDetails } = resolveTaxImpact({
    scenario,
    baselineBundle,
    rebuilt,
    demandMultiplier: dm,
  });

  const totalLogistics = calculateLogisticsTotal({
    transferCost: physical.transfer_cost,
    distributionCost: physical.distribution_cost,
    storageCost: physical.storage_cost,
    inventoryCost: physical.inventory_cost,
  });

  const anchored = applyCanonicalBaselineReference({
    companyId,
    scenario,
    baselineBundle,
    costs: {
      ...physical,
      tax_impact: taxImpact,
      total_logistics_cost: totalLogistics,
      total_with_tax: calculateTotalWithTax({ logisticsCost: totalLogistics, taxImpact }),
      tax_details: taxDetails,
      physical_warnings: physical.warnings,
      diagnostics: physical.diagnostics,
    },
  });
  return {
    ...anchored,
    tax_details: alignTaxDetailsToTotal(anchored.tax_details, anchored.tax_impact),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function runScenario({ companyId, scenario, baselineBundle }) {
  const validation = validateScenario({ companyId, scenario, baselineBundle });
  if (!validation.valid) {
    return {
      scenario_id: scenario?.scenario_id,
      company_id: companyId,
      simulation_status: 'invalid',
      flows: [],
      costs: {},
      tax_results: { total_tax_impact: 0 },
      total_with_tax: null,
      validation,
      warnings: validation.warnings,
      errors: validation.errors,
    };
  }

  const rebuilt = rebuildScenarioFlows({
    scenario,
    baselineFlows: baselineBundle.flows || [],
    distanceMatrix: baselineBundle.core_data?.distance_matrix,
  });

  const costs = calculateScenarioCosts({ companyId, scenario, baselineBundle, rebuilt });

  const td = costs.tax_details;
  const taxUsesProxy = Number(td?.tax_coverage?.proxy_flow_count || 0) > 0;
  const taxUsesFlowFallback = Number(td?.tax_input_match_summary?.fallback_flow_count || 0) > 0;
  const taxResults = {
    total_tax_impact: costs.tax_impact,
    tax_mode: td?.tax_mode || scenario.changes?.tax_mode || 'current',
    tax_regime: td?.tax_regime || scenario.changes?.tax_regime || 'current',
    regime_label: td?.regime_label,
    calculation_mode: td?.calculation_mode,
    precision_mode: td?.precision_mode,
    explanation: td?.explanation,
    breakdown: td?.breakdown,
    flow_breakdown: td?.flow_breakdown,
    tax_coverage: td?.tax_coverage,
    tax_reconciliation: td?.tax_reconciliation,
    tax_input_match_summary: td?.tax_input_match_summary,
    audit_trace: td?.audit_trace,
    metadata: td?.metadata,
    warnings: td?.warnings || [],
    decision_use: td?.decision_use || 'decision_support',
    tax_study: td?.tax_study || td?.metadata?.tax_study || null,
    source_classification: companyId === 'empresa1' ? 'shared_reference_proxy' : 'observed',
    calculation_method: 'parametric_recomputation',
    validation_scope: 'parametric_model_reconciliation',
    official_fiscal_validation: false,
    tax_source_classification:
      companyId === 'empresa1'
        ? 'shared_reference_proxy'
        : taxUsesProxy
          ? 'observed_tax_inputs_with_fiscal_proxy'
          : taxUsesFlowFallback
            ? 'observed_tax_inputs_with_flow_fallback'
            : 'observed_tax_inputs_reconciled',
    tax_source_label:
      companyId === 'empresa1'
        ? 'Proxy tributário — referência compartilhada'
        : taxUsesProxy
          ? 'Dados tributários observados — com proxy fiscal'
          : taxUsesFlowFallback
            ? 'Dados tributários observados — com fallback de associação'
            : 'Dados tributários observados — reconciliados',
  };
  const isCanonicalBaseline = isCanonicalBaselineScenario({
    companyId,
    scenario,
    baselineBundle,
  });
  const reconciliation = isCanonicalBaseline
    ? baselineBundle?.reconciliation || null
    : {
        overall: {
          status: 'pending',
          label: 'reconciliação específica do cenário pendente',
        },
      };

  const result = {
    scenario_id: scenario.scenario_id,
    scenario_name: scenario.scenario_name,
    company_id: companyId,
    simulation_status: rebuilt.errors?.length ? 'error' : 'success',
    calculation_status: rebuilt.errors?.length
      ? 'error'
      : td?.tax_coverage?.coverage_limited
        ? 'success_with_tax_limits'
        : 'success',
    data_quality: buildDataQualityAssessment({ taxResults, scenario }),
    flows: rebuilt.flows,
    flow_summary: rebuilt.flow_summary,
    costs,
    tax_results: taxResults,
    total_with_tax: costs.total_with_tax,
    calculation_method: costs.calculation_method,
    diagnostics: costs.diagnostics,
    reconciliation,
    validation,
    warnings: [
      ...(validation.warnings || []),
      ...(rebuilt.warnings || []),
      ...(costs.physical_warnings || []),
      ...(td?.warnings || []),
    ],
    errors: [...(rebuilt.errors || [])],
    scenario,
  };

  result.evidence = buildEvidenceReport({
    companyId,
    baselineBundle,
    scenarioResult: result,
    taxResults,
  });
  return result;
}
