import { validateScenario } from './scenario-validator.js';
import { rebuildScenarioFlows } from './scenario-flow-rebuilder.js';
import { calculateReformTax } from '../shared/tax-reform-engine.js';
import { calculatePhysicalCosts } from './physical-cost-engine.js';

function toNum(v, d = 0) {
  if (v === null || v === undefined || v === '') return d;
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

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
      taxDetails: calculateReformTax({ ...sharedArgs, taxMode, taxRegime: 'disabled' }),
    };
  }

  if (String(taxMode).startsWith('reform_') || c.tax_regime) {
    const details = calculateReformTax({ ...sharedArgs, taxMode, taxRegime: c.tax_regime });
    return { taxImpact: toNum(details.total_tax_impact), taxDetails: details };
  }

  // Default: legacy current regime
  const details = calculateReformTax({
    ...sharedArgs,
    taxMode: 'current',
    taxRegime: 'legacy_current',
  });
  const baseFallback = toNum(baseTax.total_tax_impact) * demandMultiplier;
  return { taxImpact: toNum(details.total_tax_impact, baseFallback), taxDetails: details };
}

// ── Costs ─────────────────────────────────────────────────────────────────────

function calculateScenarioCosts({ companyId, scenario, baselineBundle, rebuilt }) {
  const dm = toNum(scenario.changes?.demand_multiplier, 1);
  const physical = calculatePhysicalCosts({ companyId, scenario, baselineBundle, rebuilt });
  const { taxImpact, taxDetails } = resolveTaxImpact({
    scenario,
    baselineBundle,
    rebuilt,
    demandMultiplier: dm,
  });

  const totalLogistics =
    toNum(physical.transfer_cost) +
    toNum(physical.distribution_cost) +
    toNum(physical.storage_cost) +
    toNum(physical.inventory_cost);
  const baselineTotal = toNum(baselineBundle?.costs?.costs?.total_with_tax);
  const transferProxySensitivity = physical.transfer_proxy_sensitivity
    ? {
        ...physical.transfer_proxy_sensitivity,
        points: physical.transfer_proxy_sensitivity.points.map((point) => {
          const totalWithTax = totalLogistics + toNum(point.delta_from_reference) + taxImpact;
          const savingAbs = baselineTotal - totalWithTax;
          return {
            ...point,
            total_with_tax: totalWithTax,
            saving_abs: savingAbs,
            saving_pct: baselineTotal ? (savingAbs / baselineTotal) * 100 : null,
          };
        }),
      }
    : null;

  return {
    ...physical,
    tax_impact: taxImpact,
    total_logistics_cost: totalLogistics,
    total_with_tax: totalLogistics + taxImpact,
    transfer_proxy_sensitivity: transferProxySensitivity,
    tax_details: taxDetails,
    physical_warnings: physical.warnings,
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
  const taxResults = {
    total_tax_impact: costs.tax_impact,
    tax_mode: td?.tax_mode || scenario.changes?.tax_mode || 'current',
    tax_regime: td?.tax_regime || scenario.changes?.tax_regime || 'legacy_current',
    regime_label: td?.regime_label,
    calculation_mode: td?.calculation_mode,
    precision_mode: td?.precision_mode,
    explanation: td?.explanation,
    breakdown: td?.breakdown,
    flow_breakdown: td?.flow_breakdown,
    metadata: td?.metadata,
    warnings: td?.warnings || [],
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
