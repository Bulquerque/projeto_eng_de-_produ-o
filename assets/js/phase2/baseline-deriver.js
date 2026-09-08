import { calculatePhysicalCosts } from '../phase3/physical-cost-engine.js';
import { buildBundleReconciliation } from '../core/reconciliation-engine.js';
import { runTaxCalculation } from '../core/tax/tax-orchestrator.js';
import { safeNumber } from '../core/common.js';
import { MODEL_DEFAULTS } from '../core/model-configuration.js';

function cloneValue(value) {
  if (value == null) return value;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function buildBaselineScenario(bundle, companyId) {
  const activeCds = Array.isArray(bundle?.model?.active_cds) ? bundle.model.active_cds : [];
  return {
    scenario_id: bundle?.model?.scenario_id || `${companyId}_baseline`,
    scenario_name: bundle?.model?.scenario_name || 'Baseline',
    company_id: companyId,
    scenario_type: 'baseline',
    changes: {
      active_cds: [...activeCds],
      closed_cds: [],
      freight_multiplier: 1,
      demand_multiplier: 1,
      inventory_days: MODEL_DEFAULTS.inventory_days,
      wacc: MODEL_DEFAULTS.reference_wacc,
      tax_mode: 'current',
      reallocation_rule: 'nearest_available_cd',
    },
  };
}

function buildCostBreakdown(physicalCosts, taxImpact) {
  const transferCost = safeNumber(physicalCosts?.transfer_cost);
  const distributionCost = safeNumber(physicalCosts?.distribution_cost);
  const storageCost = safeNumber(physicalCosts?.storage_cost);
  const inventoryCost = safeNumber(physicalCosts?.inventory_cost);
  const calculationMethod = physicalCosts?.calculation_method || 'recomputed';
  const isPhysicalDistanceMatrix = calculationMethod.startsWith('physical_distance_matrix');

  return [
    {
      metric: 'transfer_cost',
      value: transferCost,
      source: isPhysicalDistanceMatrix
        ? 'distance_matrix_recomputed_with_transfer_proxy'
        : 'heuristic_fallback_recomputed',
    },
    {
      metric: 'distribution_cost',
      value: distributionCost,
      source: isPhysicalDistanceMatrix
        ? 'distance_matrix_recomputed'
        : 'heuristic_fallback_recomputed',
    },
    {
      metric: 'storage_cost',
      value: storageCost,
      source: isPhysicalDistanceMatrix ? 'storage_proxy_recomputed' : 'storage_fallback_recomputed',
    },
    {
      metric: 'inventory_cost',
      value: inventoryCost,
      source: 'wacc_inventory_recomputed',
    },
    {
      metric: 'tax_impact',
      value: safeNumber(taxImpact),
      source: 'tax_reference_recomputed',
    },
  ];
}

function buildTaxCoverage(bundle, taxResult) {
  const totalFlows = Array.isArray(bundle?.flows) ? bundle.flows.length : 0;
  const flowsWithTaxData = Array.isArray(taxResult?.flow_breakdown)
    ? taxResult.flow_breakdown.length
    : 0;
  const flowsWithoutTaxData = Math.max(0, totalFlows - flowsWithTaxData);
  const coveragePct = totalFlows > 0 ? (flowsWithTaxData / totalFlows) * 100 : 0;
  return {
    flows_with_tax_data: flowsWithTaxData,
    flows_without_tax_data: flowsWithoutTaxData,
    coverage_pct: coveragePct,
  };
}

function buildDerivedTaxResults(taxResult, companyId) {
  const currentTax =
    taxResult?.total_current_tax ??
    taxResult?.breakdown?.current_component ??
    taxResult?.total_tax_impact ??
    taxResult?.total_tax;
  return {
    icms_estimated: safeNumber(currentTax),
    difal_estimated: safeNumber(taxResult?.total_reform_tax),
    total_tax_impact: safeNumber(taxResult?.total_tax_impact),
    tax_source_classification:
      companyId === 'empresa1'
        ? 'official_shared_tax_reference_proxy'
        : 'observed_tax_inputs_reconciled',
    tax_source_label:
      companyId === 'empresa1'
        ? 'Proxy tributário — referência compartilhada'
        : 'Dados tributários observados — reconciliados',
  };
}

function buildDerivedWarnings(...groups) {
  const flattened = groups
    .flat()
    .filter(Boolean)
    .map((item) => String(item?.message || item?.warning || item))
    .filter(Boolean);
  return [...new Set(flattened)];
}

function removeObsoleteEmpresa1Warnings(warnings = []) {
  const obsoletePatterns = [
    /transfer[eê]ncia e tributo n[aã]o s[aã]o inferidos/i,
    /custo de transfer[eê]ncia e tributo n[aã]o foram inferidos/i,
  ];
  return warnings.filter((warning) => {
    const text = String(warning || '');
    return !obsoletePatterns.some((pattern) => pattern.test(text));
  });
}

function refreshEmpresa1ModelMetadata(bundle) {
  const currentMetadata = cloneValue(bundle.model?.metadata) || {};
  bundle.model = {
    ...(bundle.model || {}),
    warnings: removeObsoleteEmpresa1Warnings(bundle.model?.warnings || []),
    metadata: {
      ...currentMetadata,
      methodology:
        'Baseline da Empresa 1 recalculado em runtime com matriz de distância, proxy quilométrico de transferência e referência tributária oficial. O pacote bruto é mantido em phase2_raw para auditoria.',
      derived_baseline: {
        active: true,
        preserves_raw_snapshot: true,
        transfer_source: 'distance_matrix_kilometric_transfer_proxy',
        tax_source: 'official_tax_reference_recomputed',
      },
    },
  };
}

export function recomputePhase2Baseline(bundle, companyId = bundle?.model?.company_id) {
  if (!bundle || companyId !== 'empresa1') return bundle;

  const rawSnapshot = {
    costs: cloneValue(bundle.costs || {}),
    tax_results: cloneValue(bundle.tax_results || {}),
  };

  bundle.phase2_raw = rawSnapshot;
  refreshEmpresa1ModelMetadata(bundle);

  const baselineScenario = buildBaselineScenario(bundle, companyId);
  const flows = Array.isArray(bundle.flows) ? bundle.flows : [];
  const calcBundle = {
    ...bundle,
    costs: rawSnapshot.costs,
    tax_results: rawSnapshot.tax_results,
  };

  const physicalCosts = calculatePhysicalCosts({
    companyId,
    scenario: baselineScenario,
    baselineBundle: calcBundle,
    rebuilt: { flows },
  });

  const taxResult = runTaxCalculation({
    baselineBundle: calcBundle,
    rebuiltFlows: flows,
    baseTaxBlock: rawSnapshot.tax_results?.tax_results || rawSnapshot.costs?.costs || {},
    demandMultiplier: 1,
    taxMode: 'current',
  });

  const derivedCosts = {
    ...(cloneValue(rawSnapshot.costs?.costs) || {}),
    transfer_cost: safeNumber(physicalCosts.transfer_cost),
    distribution_cost: safeNumber(physicalCosts.distribution_cost),
    storage_cost: safeNumber(physicalCosts.storage_cost),
    inventory_cost: safeNumber(physicalCosts.inventory_cost),
    tax_impact: safeNumber(taxResult.total_tax_impact),
  };
  derivedCosts.total_logistics_cost =
    derivedCosts.transfer_cost +
    derivedCosts.distribution_cost +
    derivedCosts.storage_cost +
    derivedCosts.inventory_cost;
  derivedCosts.total_with_tax = derivedCosts.total_logistics_cost + derivedCosts.tax_impact;

  bundle.costs = {
    ...rawSnapshot.costs,
    costs: derivedCosts,
    cost_breakdown: buildCostBreakdown(physicalCosts, taxResult.total_tax_impact),
    flow_cost_detail: cloneValue(physicalCosts.flow_cost_detail || []),
    diagnostics: cloneValue(physicalCosts.diagnostics || {}),
    warnings: buildDerivedWarnings(physicalCosts.warnings),
    errors: [],
  };

  const taxWarnings = buildDerivedWarnings(taxResult.warnings);
  bundle.tax_results = {
    ...rawSnapshot.tax_results,
    tax_results: buildDerivedTaxResults(taxResult, companyId),
    tax_coverage: buildTaxCoverage(bundle, taxResult),
    warnings: taxWarnings,
    errors: [],
  };

  bundle.reconciliation = buildBundleReconciliation(bundle);
  return bundle;
}
