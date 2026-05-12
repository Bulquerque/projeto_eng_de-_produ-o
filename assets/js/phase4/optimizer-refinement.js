import {buildScenarioFromForm} from '../phase3/scenario-builder.js';
import {clamp, uniqueByChanges} from './optimizer-utils.js';

function buildVariant({companyId, baselineBundle, seedRecord, roundIndex, label, patch}) {
  const current = seedRecord?.scenario?.changes || {};
  const nextActive = patch.active_cds || current.active_cds || [];
  if (!Array.isArray(nextActive) || nextActive.length === 0) return null;

  return buildScenarioFromForm({
    companyId,
    baselineBundle,
    scenarioId: `${seedRecord?.scenario?.scenario_id || seedRecord?.result?.scenario_id || 'seed'}__r${roundIndex}_${label}`,
    formValues: {
      scenario_name: `${seedRecord?.scenario?.scenario_name || 'Cenário'} · refino ${roundIndex + 1}-${label}`,
      active_cds: nextActive,
      freight_multiplier: patch.freight_multiplier ?? current.freight_multiplier ?? 1,
      demand_multiplier: patch.demand_multiplier ?? current.demand_multiplier ?? 1,
      inventory_days: patch.inventory_days ?? current.inventory_days ?? 45,
      wacc: patch.wacc ?? current.wacc ?? 0.15,
      tax_mode: patch.tax_mode ?? current.tax_mode ?? 'current',
      tax_regime: patch.tax_regime ?? current.tax_regime ?? null,
      reallocation_rule: current.reallocation_rule || 'nearest_available_cd',
      scenario_type: 'refinement'
    }
  });
}

export function buildRefinementVariants({companyId, baselineBundle, seedRecord, roundIndex, refinementConfig = {}}) {
  const base = baselineBundle?.model || {};
  const baseCds = base.active_cds || [];
  const current = seedRecord?.scenario?.changes || {};
  const active = current.active_cds || [];
  const closed = current.closed_cds || baseCds.filter(cd => !active.includes(cd));
  const variants = [];

  const freightSteps = refinementConfig.freight_steps || [0.95, 1.05];
  const demandSteps = refinementConfig.demand_steps || [0.95, 1.05];
  const inventorySteps = refinementConfig.inventory_steps || [-15, 15];
  const waccSteps = refinementConfig.wacc_steps || [-0.02, 0.02];
  const allowTaxToggle = refinementConfig.allow_tax_toggle !== false;

  const add = (label, patch) => {
    const variant = buildVariant({companyId, baselineBundle, seedRecord, roundIndex, label, patch});
    if (variant) variants.push(variant);
  };

  for (const cd of active.slice(0, 3)) {
    add(`drop_${cd}`, {active_cds: active.filter(item => item !== cd)});
  }

  for (const cd of closed.slice(0, 3)) {
    add(`add_${cd}`, {active_cds: Array.from(new Set([...active, cd]))});
  }

  for (const factor of freightSteps) {
    add(`freight_${String(factor).replace('.', '_')}`, {
      freight_multiplier: clamp(Number(current.freight_multiplier || 1) * factor, 0.5, 3)
    });
  }

  for (const factor of demandSteps) {
    add(`demand_${String(factor).replace('.', '_')}`, {
      demand_multiplier: clamp(Number(current.demand_multiplier || 1) * factor, 0.5, 3)
    });
  }

  for (const delta of inventorySteps) {
    add(`inventory_${delta > 0 ? 'p' : 'm'}${Math.abs(delta)}`, {
      inventory_days: clamp(Math.round((Number(current.inventory_days || 45) + delta) / 5) * 5, 15, 90)
    });
  }

  for (const delta of waccSteps) {
    add(`wacc_${delta > 0 ? 'p' : 'm'}${Math.abs(delta)}`.replace('.', '_'), {
      wacc: clamp(Number(current.wacc || 0.15) + delta, 0.01, 0.5)
    });
  }

  if (allowTaxToggle) {
    add(current.tax_mode === 'disabled' ? 'tax_on' : 'tax_off', {
      tax_mode: current.tax_mode === 'disabled' ? 'current' : 'disabled',
      tax_regime: current.tax_mode === 'disabled' ? 'legacy_current' : 'disabled'
    });
  }

  return uniqueByChanges(variants);
}
