/**
 * Canonical, auditable assumptions used when source data do not support a
 * direct calculation. Values in this file are model parameters, not observed
 * company data. Callers must expose their use in warnings and coverage output.
 */

export const MODEL_ASSUMPTIONS = Object.freeze({
  version: '2026-09-04',
  inventory: Object.freeze({
    baseline_days: 45,
    baseline_wacc: 0.15,
    calculation_mode: 'days_wacc_only',
    pooling_effect_included: false,
  }),
  storage: Object.freeze({
    fixed_share_proxy: 0.65,
    active_cd_share_proxy: 0.35,
  }),
  empresa1_transfer_proxy: Object.freeze({
    source_company: 'empresa2',
    source_description: 'médias ponderadas de notas fiscais de transferência da Empresa 2',
    rate_by_destination_uf_brl_per_kg_km: Object.freeze({
      SP: 0.0083,
      MG: 0.0049,
      ES: 0.0176,
      RJ: 0.0133,
    }),
    fallback_rate_brl_per_kg_km: 0.005,
    missing_distance_distribution_share: 0.4,
    sensitivity_rate_multipliers: Object.freeze([0.75, 1, 1.25]),
  }),
  empresa2_freight: Object.freeze({
    missing_cif_revenue_share: 0.025,
    missing_transfer_rate_revenue_share: 0.025,
  }),
  quality: Object.freeze({
    max_cd_volume_share: 0.75,
    max_reallocated_flow_share: 0.5,
    max_missing_distance_share: 0.05,
  }),
  scoring: Object.freeze({
    objective_profiles: Object.freeze({
      cost_minimum: Object.freeze({
        total_cost: 0.75,
        service_quality: 0.05,
        operational_risk: 0.05,
        tax_impact: 0.1,
        inventory_efficiency: 0.05,
      }),
      balanced: Object.freeze({
        total_cost: 0.3,
        service_quality: 0.25,
        operational_risk: 0.2,
        tax_impact: 0.15,
        inventory_efficiency: 0.1,
      }),
      conservative: Object.freeze({
        total_cost: 0.15,
        service_quality: 0.25,
        operational_risk: 0.45,
        tax_impact: 0.05,
        inventory_efficiency: 0.1,
      }),
      quality_service: Object.freeze({
        total_cost: 0.1,
        service_quality: 0.55,
        operational_risk: 0.2,
        tax_impact: 0.05,
        inventory_efficiency: 0.1,
      }),
    }),
  }),
  monte_carlo: Object.freeze({
    default_iterations: 300,
    minimum_iterations: 50,
    maximum_iterations: 5000,
    default_seed: 42,
    default_histogram_bins: 12,
    bounds: Object.freeze({
      freight_multiplier_factor: Object.freeze([0.6, 1.8]),
      demand_multiplier_factor: Object.freeze([0.6, 1.6]),
      inventory_days: Object.freeze([0, 120]),
      wacc: Object.freeze([0, 0.5]),
      tax_multiplier: Object.freeze([0.7, 1.35]),
      histogram_bins: Object.freeze([6, 30]),
    }),
    risk: Object.freeze({
      high_probability_saving_below: 0.6,
      medium_probability_saving_below: 0.8,
      high_p10_saving_below_pct: 0,
      medium_p10_saving_below_pct: 2,
      strong_positive_saving_min_pct: 5,
    }),
    profiles: Object.freeze({
      conservative: Object.freeze({
        spread: Object.freeze({
          freight_multiplier: 0.045,
          demand_multiplier: 0.035,
          inventory_days: 5,
          wacc: 0.012,
          tax_multiplier: 0.025,
        }),
        shared_shock: 0.18,
        idiosyncratic_shock: 0.45,
      }),
      balanced: Object.freeze({
        spread: Object.freeze({
          freight_multiplier: 0.08,
          demand_multiplier: 0.07,
          inventory_days: 9,
          wacc: 0.02,
          tax_multiplier: 0.04,
        }),
        shared_shock: 0.32,
        idiosyncratic_shock: 0.65,
      }),
      broad: Object.freeze({
        spread: Object.freeze({
          freight_multiplier: 0.12,
          demand_multiplier: 0.1,
          inventory_days: 14,
          wacc: 0.03,
          tax_multiplier: 0.06,
        }),
        shared_shock: 0.48,
        idiosyncratic_shock: 0.85,
      }),
    }),
  }),
  robustness: Object.freeze({
    default_quality_score: 70,
    high_risk_penalty: 18,
    medium_risk_penalty: 8,
    positive_case_weight: 70,
    quality_weight: 0.3,
    negative_saving_penalty_multiplier: 2,
    negative_saving_penalty_cap: 30,
    high_threshold: 80,
    medium_threshold: 55,
  }),
  recommendation: Object.freeze({
    recommended_min_robustness: 70,
    warning_min_robustness: 45,
    recommended_min_mc_probability: 0.65,
    warning_min_mc_probability: 0.5,
  }),
  reconciliation: Object.freeze({
    aligned_max_abs_error_pct: 3,
    tolerable_max_abs_error_pct: 10,
  }),
  fallback_catalog: Object.freeze({
    empresa1_transfer_cross_company_proxy: Object.freeze({
      classification: 'proxy',
      company: 'empresa1',
      value: '0,0049 a 0,0176; fallback 0,0050',
      unit: 'R$/kg-km',
      origin: 'médias ponderadas de notas fiscais de transferência da Empresa 2',
      activation: 'fluxos da Empresa 1 com peso positivo',
      justification: 'a base disponível da Empresa 1 não contém tarifa própria de transferência',
    }),
    empresa1_missing_transfer_distance: Object.freeze({
      classification: 'fallback',
      company: 'empresa1',
      value: 0.4,
      unit: 'fração do custo de distribuição do fluxo',
      origin: 'premissa manual do modelo',
      activation: 'fluxo com peso positivo e sem distância recuperável',
      justification: 'evitar atribuir distância inexistente ou custo de transferência nulo',
    }),
    empresa2_missing_rate_revenue: Object.freeze({
      classification: 'fallback',
      company: 'empresa2',
      value: 0.025,
      unit: 'fração da receita do fluxo',
      origin: 'premissa manual do modelo',
      activation: 'linha CIF ou tarifa de transferência ausente, com receita disponível',
      justification: 'aproximação explícita quando a tabela observada não cobre o fluxo',
    }),
    storage_proportional: Object.freeze({
      classification: 'proxy',
      company: 'ambas',
      value: '0,65 + 0,35 × CDs ativos / CDs do baseline',
      unit: 'multiplicador do custo-base de armazenagem',
      origin: 'premissa manual do modelo',
      activation: 'tabela de armazenagem indisponível ou sem correspondência',
      justification:
        'aproximação proporcional; não constitui decomposição observada entre fixo e variável',
    }),
    inventory_days_wacc_only: Object.freeze({
      classification: 'parameter',
      company: 'ambas',
      value: '45 dias; WACC 15% a.a.',
      unit: 'dias e taxa anual',
      origin: 'parâmetros-base do modelo',
      activation: 'todos os cenários com custo de estoque',
      justification:
        'não há dados suficientes para separar estoque cíclico e de segurança nem calibrar pooling',
    }),
    monte_carlo_spreads: Object.freeze({
      classification: 'parameter',
      company: 'ambas',
      value: 'perfis conservative, balanced e broad',
      unit: 'desvio parametrizado por driver',
      origin: 'premissas manuais do modelo',
      activation: 'execução opcional da camada Monte Carlo',
      justification: 'análise exploratória de sensibilidade, sem calibração histórica validada',
    }),
    robustness_defaults: Object.freeze({
      classification: 'fallback',
      company: 'ambas',
      value: 'quality_score 70; risco medium',
      unit: 'índice e categoria',
      origin: 'premissas manuais do modelo',
      activation: 'qualidade ou risco ausentes',
      justification:
        'permite cálculo explícito, acompanhado de warning; não representa probabilidade empírica',
    }),
    quality_thresholds: Object.freeze({
      classification: 'parameter',
      company: 'ambas',
      value: 'concentração 75%; realocação 50%; distância ausente 5%',
      unit: 'percentual dos fluxos ou volume',
      origin: 'premissas manuais do modelo',
      activation: 'avaliação de qualidade de todos os cenários',
      justification: 'limites de triagem operacional; não representam níveis de serviço observados',
    }),
    recommendation_thresholds: Object.freeze({
      classification: 'parameter',
      company: 'ambas',
      value: 'robustez 70/45; probabilidade Monte Carlo 65%/50%',
      unit: 'índice e probabilidade simulada',
      origin: 'premissas manuais do modelo',
      activation: 'geração da recomendação executiva',
      justification: 'régua decisória parametrizada, não validação empírica',
    }),
    reconciliation_thresholds: Object.freeze({
      classification: 'parameter',
      company: 'ambas',
      value: 'alinhado até 3%; tolerável acima de 3% até 10%; divergente acima de 10%',
      unit: 'erro percentual absoluto',
      origin: 'régua metodológica do projeto',
      activation: 'quando existe referência independente comparável',
      justification: 'padronizar a leitura sem fabricar benchmark ausente',
    }),
  }),
});

export function getModelAssumptions() {
  return MODEL_ASSUMPTIONS;
}
