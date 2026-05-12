import { validateScenario } from './scenario-validator.js';
import { rebuildScenarioFlows } from './scenario-flow-rebuilder.js';
import { calculateReformTax } from '../shared/tax-reform-engine.js';
import { calculatePhysicalCosts } from './physical-cost-engine.js';

function n(v, d = 0) { const x = Number(v); return Number.isFinite(x) ? x : d; }

// ─────────────────────────────────────────────────────────────────────────────
// TAX CALCULATION
// ─────────────────────────────────────────────────────────────────────────────

function resolveTaxImpact({ scenario, baselineBundle, rebuilt, demandMultiplier }) {
  const c = scenario.changes || {};
  const baseTax = baselineBundle?.tax_results?.tax_results || baselineBundle?.costs?.costs || {};
  const taxMode = c.tax_mode || 'current';

  if (taxMode === 'disabled') {
    const details = calculateReformTax({
      baseTaxBlock: baseTax,
      flows: rebuilt.flows,
      scenario,
      baselineBundle,
      demandMultiplier,
      taxMode,
      taxRegime: c.tax_regime || 'disabled'
    });
    return { taxImpact: 0, taxDetails: details };
  }

  if (String(taxMode).startsWith('reform_') || c.tax_regime) {
    const reform = calculateReformTax({
      baseTaxBlock: baseTax,
      flows: rebuilt.flows,
      scenario,
      baselineBundle,
      demandMultiplier,
      taxMode,
      taxRegime: c.tax_regime
    });
    return { taxImpact: n(reform.total_tax_impact), taxDetails: reform };
  }

  // Default: legacy current regime
  const details = calculateReformTax({
    baseTaxBlock: baseTax,
    flows: rebuilt.flows,
    scenario,
    baselineBundle,
    demandMultiplier,
    taxMode: 'current',
    taxRegime: 'legacy_current'
  });
  const baseFallback = n(baseTax.total_tax_impact) * demandMultiplier;
  return {
    taxImpact: n(details.total_tax_impact, baseFallback),
    taxDetails: details
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COST CALCULATOR — bottom-up via physical-cost-engine
// ─────────────────────────────────────────────────────────────────────────────

function calculateScenarioCosts({ companyId, scenario, baselineBundle, rebuilt }) {
  const c = scenario.changes || {};
  const dm = n(c.demand_multiplier, 1);

  // Physical bottom-up freight & storage calculation
  const physical = calculatePhysicalCosts({ companyId, scenario, baselineBundle, rebuilt });

  const { taxImpact, taxDetails } = resolveTaxImpact({
    scenario,
    baselineBundle,
    rebuilt,
    demandMultiplier: dm
  });

  const totalLogistics =
    n(physical.transfer_cost) +
    n(physical.distribution_cost) +
    n(physical.storage_cost) +
    n(physical.inventory_cost);

  return {
    transfer_cost: physical.transfer_cost,
    distribution_cost: physical.distribution_cost,
    storage_cost: physical.storage_cost,
    inventory_cost: physical.inventory_cost,
    tax_impact: taxImpact,
    total_logistics_cost: totalLogistics,
    total_with_tax: totalLogistics + taxImpact,
    tax_details: taxDetails,
    // Audit metadata
    calculation_method: physical.calculation_method,
    physical_warnings: physical.warnings,
    flow_cost_detail: physical.flow_cost_detail
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

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
      errors: validation.errors
    };
  }

  const rebuilt = rebuildScenarioFlows({
    scenario,
    baselineFlows: baselineBundle.flows || [],
    distanceMatrix: baselineBundle.core_data?.distance_matrix
  });

  const costs = calculateScenarioCosts({ companyId, scenario, baselineBundle, rebuilt });

  const taxResults = {
    total_tax_impact: costs.tax_impact,
    tax_mode: costs.tax_details?.tax_mode || scenario.changes?.tax_mode || 'current',
    tax_regime: costs.tax_details?.tax_regime || scenario.changes?.tax_regime || 'legacy_current',
    regime_label: costs.tax_details?.regime_label,
    calculation_mode: costs.tax_details?.calculation_mode,
    precision_mode: costs.tax_details?.precision_mode,
    explanation: costs.tax_details?.explanation,
    breakdown: costs.tax_details?.breakdown,
    flow_breakdown: costs.tax_details?.flow_breakdown,
    metadata: costs.tax_details?.metadata,
    warnings: costs.tax_details?.warnings || []
  };

  const warnings = [
    ...(validation.warnings || []),
    ...(rebuilt.warnings || []),
    ...(costs.physical_warnings || [])
  ];
  const errors = [...(rebuilt.errors || [])];

  return {
    scenario_id: scenario.scenario_id,
    scenario_name: scenario.scenario_name,
    company_id: companyId,
    simulation_status: errors.length ? 'error' : 'success',
    flows: rebuilt.flows,
    flow_summary: rebuilt.flow_summary,
    costs,
    tax_results: taxResults,
    total_with_tax: costs.total_with_tax,
    calculation_method: costs.calculation_method,
    validation,
    warnings,
    errors,
    scenario
  };
}
