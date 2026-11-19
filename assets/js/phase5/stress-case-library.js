import { MODEL_DEFAULTS } from '../core/model-configuration.js';

export function getDefaultStressCases(profile = 'standard') {
  const standard = [
    { case_id: 'frete_mais_10', name: 'Frete +10%', changes: { freight_multiplier_delta: 0.1 } },
    { case_id: 'frete_mais_20', name: 'Frete +20%', changes: { freight_multiplier_delta: 0.2 } },
    { case_id: 'demanda_mais_10', name: 'Demanda +10%', changes: { demand_multiplier_delta: 0.1 } },
    {
      case_id: 'demanda_menos_10',
      name: 'Demanda -10%',
      changes: { demand_multiplier_delta: -0.1 },
    },
    {
      case_id: 'wacc_mais_5pp',
      name: 'Custo anual de estoque +5 p.p.',
      changes: { wacc_delta: 0.05 },
    },
    {
      case_id: 'estoque_mais_15d',
      name: 'Estoque no benchmark MedTech 2019',
      changes: {
        inventory_days_delta:
          MODEL_DEFAULTS.inventory_days_sensitivity[0] - MODEL_DEFAULTS.inventory_days,
      },
    },
    {
      case_id: 'reforma_2033',
      name: 'Reforma 2033 (Regime Pleno)',
      changes: { tax_mode: 'reform_2033', tax_regime: 'reform_full_2033' },
    },
  ];
  const conservative = [
    ...standard,
    { case_id: 'frete_mais_30', name: 'Frete +30%', changes: { freight_multiplier_delta: 0.3 } },
    { case_id: 'demanda_mais_20', name: 'Demanda +20%', changes: { demand_multiplier_delta: 0.2 } },
  ];
  const cases = profile === 'conservative' ? conservative : standard;
  return cases.map((c) => ({ ...c, valid: Boolean(c.case_id && c.changes) }));
}
export function buildStressCaseLibrary({ companyId, stressProfile = 'standard' } = {}) {
  const stress_cases = getDefaultStressCases(stressProfile).filter((c) => c.valid);
  return {
    company_id: companyId,
    stress_profile: stressProfile,
    stress_cases,
    warnings: [],
    errors: [],
  };
}
