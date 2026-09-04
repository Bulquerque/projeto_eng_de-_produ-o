import { MODEL_ASSUMPTIONS } from '../shared/model-assumptions.js';

const AUDITED_PROFILES = MODEL_ASSUMPTIONS.scoring.objective_profiles;

export const DEFAULT_OBJECTIVE_PROFILES = [
  {
    profile_id: 'cost_minimum',
    profile_name: 'Perfil Custo Mínimo',
    description: 'Prioriza o custo total dentro do espaço discreto avaliado.',
    weights: AUDITED_PROFILES.cost_minimum,
  },
  {
    profile_id: 'balanced',
    profile_name: 'Perfil Balanceado',
    description: 'Equilibra custo, qualidade, risco, tributo e estoque.',
    weights: AUDITED_PROFILES.balanced,
  },
  {
    profile_id: 'cfo',
    profile_name: 'Perfil CFO',
    description: 'Prioriza custo total, impacto tributário e capital parado.',
    weights: {
      total_cost: 0.5,
      service_quality: 0.1,
      operational_risk: 0.1,
      tax_impact: 0.2,
      inventory_efficiency: 0.1,
    },
  },
  {
    profile_id: 'supply',
    profile_name: 'Perfil Supply',
    description: 'Prioriza qualidade operacional, serviço e risco.',
    weights: {
      total_cost: 0.2,
      service_quality: 0.4,
      operational_risk: 0.25,
      tax_impact: 0.05,
      inventory_efficiency: 0.1,
    },
  },
  {
    profile_id: 'fiscal',
    profile_name: 'Perfil Fiscal',
    description: 'Dá peso maior ao impacto tributário, sem ignorar custo e risco.',
    weights: {
      total_cost: 0.25,
      service_quality: 0.1,
      operational_risk: 0.15,
      tax_impact: 0.4,
      inventory_efficiency: 0.1,
    },
  },
  {
    profile_id: 'conservative',
    profile_name: 'Perfil Conservador',
    description: 'Prioriza baixo risco e qualidade mesmo com saving menor.',
    weights: AUDITED_PROFILES.conservative,
  },
  {
    profile_id: 'quality_service',
    profile_name: 'Perfil Qualidade/Serviço',
    description: 'Prioriza qualidade e serviço, mantendo custo, risco e tributo no score.',
    weights: AUDITED_PROFILES.quality_service,
  },
  {
    profile_id: 'growth',
    profile_name: 'Perfil Crescimento',
    description: 'Prioriza serviço e flexibilidade operacional.',
    weights: {
      total_cost: 0.2,
      service_quality: 0.45,
      operational_risk: 0.15,
      tax_impact: 0.05,
      inventory_efficiency: 0.15,
    },
  },
];
export function loadDefaultProfiles() {
  return DEFAULT_OBJECTIVE_PROFILES.map((p) => ({ ...p, weights: { ...p.weights } }));
}
export function getProfileById(profileId) {
  const p = DEFAULT_OBJECTIVE_PROFILES.find((x) => x.profile_id === profileId);
  return p ? { ...p, weights: { ...p.weights } } : null;
}
export function validateProfileWeights(profile) {
  const sum = Object.values(profile?.weights || {}).reduce((a, b) => a + Number(b || 0), 0);
  return { valid: Math.abs(sum - 1) < 1e-6, weights_sum: sum };
}
export function cloneProfileAsObjective(profileId, companyId) {
  const p = getProfileById(profileId) || getProfileById('balanced');
  return {
    objective_name: p.profile_name,
    company_id: companyId,
    weights: { ...p.weights },
    source_profile: p.profile_id,
  };
}
export function renderProfileDescription(profile) {
  return `${profile.profile_name}: ${profile.description}`;
}
