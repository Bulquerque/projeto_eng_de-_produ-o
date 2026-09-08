import { validateScenario } from './scenario-validator.js';
import { rebuildScenarioFlows } from './scenario-flow-rebuilder.js';
import { runTaxCalculation } from '../core/tax/tax-orchestrator.js';
import { calculatePhysicalCosts } from './physical-cost-engine.js';
import { safeNumber } from '../core/common.js';
import {
  calculateLogisticsTotal,
  calculateTotalWithTax,
  MODEL_DEFAULTS,
} from '../core/model-configuration.js';

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

function sameSet(left = [], right = []) {
  const a = [...new Set((left || []).map(String))].sort();
  const b = [...new Set((right || []).map(String))].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function isCanonicalBaselineNetwork({ companyId, scenario, baselineBundle }) {
  const changes = scenario?.changes || {};
  const model = baselineBundle?.model || {};
  return (
    scenario?.company_id === companyId &&
    sameSet(changes.active_cds, model.active_cds) &&
    sameSet(changes.closed_cds, []) &&
    (changes.tax_mode || 'current') === 'current' &&
    (changes.tax_regime || 'current') === 'current'
  );
}

function isCanonicalBaselineScenario(scenario) {
  const changes = scenario?.changes || {};
  return (
    safeNumber(changes.freight_multiplier, 1) === 1 &&
    safeNumber(changes.demand_multiplier, 1) === 1 &&
    safeNumber(changes.inventory_days, MODEL_DEFAULTS.inventory_days) ===
      MODEL_DEFAULTS.inventory_days &&
    safeNumber(changes.wacc, MODEL_DEFAULTS.reference_wacc) === MODEL_DEFAULTS.reference_wacc
  );
}

function sumLogisticsCosts(costs = {}) {
  return calculateLogisticsTotal({
    transferCost: costs.transfer_cost,
    distributionCost: costs.distribution_cost,
    storageCost: costs.storage_cost,
    inventoryCost: costs.inventory_cost,
  });
}

function applyCanonicalBaselineReference({ companyId, scenario, baselineBundle, costs }) {
  const baselineNetwork = isCanonicalBaselineNetwork({ companyId, scenario, baselineBundle });
  if (!baselineNetwork) return costs;
  const exactBaseline = isCanonicalBaselineScenario(scenario);

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

  return applyCanonicalBaselineReference({
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
    metadata: td?.metadata,
    warnings: td?.warnings || [],
    tax_source_classification:
      companyId === 'empresa1'
        ? 'official_shared_tax_reference_proxy'
        : 'observed_tax_inputs_reconciled',
    tax_source_label:
      companyId === 'empresa1'
        ? 'Proxy tributário — referência compartilhada'
        : 'Dados tributários observados — reconciliados',
  };

  return {
    scenario_id: scenario.scenario_id,
    scenario_name: scenario.scenario_name,
    company_id: companyId,
    simulation_status: rebuilt.errors?.length ? 'error' : 'success',
    flows: rebuilt.flows,
    flow_summary: rebuilt.flow_summary,
    costs,
    tax_results: taxResults,
    total_with_tax: costs.total_with_tax,
    calculation_method: costs.calculation_method,
    diagnostics: costs.diagnostics,
    validation,
    warnings: [
      ...(validation.warnings || []),
      ...(rebuilt.warnings || []),
      ...(costs.physical_warnings || []),
    ],
    errors: [...(rebuilt.errors || [])],
    scenario,
  };
}
