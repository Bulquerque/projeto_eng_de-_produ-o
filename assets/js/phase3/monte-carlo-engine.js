import { runScenario } from './scenario-simulator.js';
import { safeNumber } from '../core/common.js';
import { calculateSaving, MODEL_DEFAULTS } from '../core/model-configuration.js';
function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hashSeed(seed) {
  if (Number.isFinite(Number(seed))) {
    return Math.trunc(Number(seed)) >>> 0;
  }

  const text = String(seed || '42');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed) {
  let state = hashSeed(seed);
  return function rng() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function quantile(sortedValues, percentile) {
  if (!sortedValues.length) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const position = (sortedValues.length - 1) * clamp(percentile, 0, 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sortedValues[lower];
  const weight = position - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function percentileRank(sortedValues, value) {
  if (!sortedValues.length) return 0;
  let count = 0;
  for (const item of sortedValues) {
    if (item <= value) count += 1;
    else break;
  }
  return (count / sortedValues.length) * 100;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function pearsonCorrelation(xs, ys) {
  if (xs.length !== ys.length || xs.length < 2) return 0;
  const meanX = mean(xs);
  const meanY = mean(ys);
  let numerator = 0;
  let varianceX = 0;
  let varianceY = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    numerator += dx * dy;
    varianceX += dx * dx;
    varianceY += dy * dy;
  }
  const denominator = Math.sqrt(varianceX * varianceY);
  return denominator ? numerator / denominator : 0;
}

function buildHistogram(values, binCount = 12) {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (min === max) {
    return [
      {
        label: `${min.toFixed(1)}%`,
        start: min,
        end: max,
        count: values.length,
        ratio: 1,
      },
    ];
  }

  const width = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    label: '',
    start: min + width * index,
    end: index === binCount - 1 ? max : min + width * (index + 1),
    count: 0,
    ratio: 0,
  }));

  for (const value of values) {
    let index = Math.floor((value - min) / width);
    if (index < 0) index = 0;
    if (index >= bins.length) index = bins.length - 1;
    bins[index].count += 1;
  }

  for (const bin of bins) {
    bin.ratio = values.length ? bin.count / values.length : 0;
    bin.label = `${bin.start.toFixed(1)}% a ${bin.end.toFixed(1)}%`;
  }
  return bins;
}

function normalizeProfile(profile) {
  const value = String(profile || 'balanced').toLowerCase();
  if (value === 'conservative' || value === 'conservador') return 'conservative';
  if (value === 'broad' || value === 'amplo') return 'broad';
  return 'balanced';
}

function normalizeDriver(driver) {
  const allowed = new Set([
    'freight_multiplier',
    'demand_multiplier',
    'inventory_days',
    'wacc',
    'tax_multiplier',
  ]);
  return allowed.has(driver) ? driver : 'freight_multiplier';
}

const HISTORICAL_DOMAINS = Object.freeze({
  freight_multiplier: { min: Number.EPSILON, max: 3 },
  demand_multiplier: { min: Number.EPSILON, max: 3 },
  inventory_days: { min: 0, max: 365 },
  wacc: { min: 0, max: 1 },
  tax_multiplier: { min: Number.EPSILON, max: 3 },
});

function isValidHistoricalValue(driver, value) {
  const numeric = Number(value);
  const domain = HISTORICAL_DOMAINS[driver];
  return Boolean(
    domain &&
    Number.isFinite(numeric) &&
    numeric >= domain.min &&
    (domain.max == null || numeric <= domain.max)
  );
}

function normalizeHistoricalData(history = {}) {
  const allowed = [
    'freight_multiplier',
    'demand_multiplier',
    'inventory_days',
    'wacc',
    'tax_multiplier',
  ];
  const rejected = {};
  const normalized = Object.fromEntries(
    allowed
      .map((driver) => {
        const rawValues = Array.isArray(history?.[driver]) ? history[driver].map(Number) : [];
        const values = rawValues.filter((value) => isValidHistoricalValue(driver, value));
        rejected[driver] = rawValues.length - values.length;
        return [driver, values.length >= 2 ? values : []];
      })
      .filter(([, values]) => values.length)
  );
  const provenance = history?.provenance || history?.metadata || null;
  const provenanceValid = Boolean(
    provenance &&
    provenance.source &&
    provenance.period_start &&
    provenance.period_end &&
    provenance.company_id &&
    provenance.unit
  );
  const observations = Array.isArray(history?.observations)
    ? history.observations
        .filter((observation) => observation && typeof observation === 'object')
        .map((observation) =>
          Object.fromEntries(
            allowed
              .filter((driver) => isValidHistoricalValue(driver, observation[driver]))
              .map((driver) => [driver, Number(observation[driver])])
          )
        )
        .filter((observation) => Object.keys(observation).length > 0)
    : [];
  if (observations.length >= 2) {
    normalized.observations = observations;
    for (const driver of allowed) {
      if (normalized[driver]) continue;
      const values = observations
        .map((observation) => observation[driver])
        .filter((value) => isValidHistoricalValue(driver, value));
      if (values.length >= 2) normalized[driver] = values;
    }
  }
  normalized.validation = {
    rejected_values_by_driver: rejected,
    rejected_value_count: Object.values(rejected).reduce((sum, value) => sum + value, 0),
    complete_joint_observations: observations.filter((observation) =>
      allowed.every((driver) => Number.isFinite(Number(observation[driver])))
    ).length,
    provenance_status: provenanceValid ? 'declared' : 'missing_or_incomplete',
    provenance: provenance || null,
  };
  normalized.provenance = provenance || null;
  return normalized;
}

function hasHistoricalContent(history) {
  return Boolean(
    history &&
    typeof history === 'object' &&
    (Object.values(history).some((value) => Array.isArray(value) && value.length > 0) ||
      (Array.isArray(history.observations) && history.observations.length > 0))
  );
}

function sampleHistorical(values, rng) {
  if (!Array.isArray(values) || values.length < 2) return null;
  return values[Math.floor(rng() * values.length)];
}

function sampleHistoricalObservation(observations, rng) {
  if (!Array.isArray(observations) || observations.length < 2) return null;
  return observations[Math.floor(rng() * observations.length)];
}

const PROFILE_PRESETS = {
  conservative: {
    spread: {
      freight_multiplier: 0.045,
      demand_multiplier: 0.035,
      inventory_days: 5,
      wacc: 0.012,
      tax_multiplier: 0.025,
    },
    shared_shock: 0.18,
    idiosyncratic_shock: 0.45,
  },
  balanced: {
    spread: {
      freight_multiplier: 0.08,
      demand_multiplier: 0.07,
      inventory_days: 9,
      wacc: 0.02,
      tax_multiplier: 0.04,
    },
    shared_shock: 0.32,
    idiosyncratic_shock: 0.65,
  },
  broad: {
    spread: {
      freight_multiplier: 0.12,
      demand_multiplier: 0.1,
      inventory_days: 14,
      wacc: 0.03,
      tax_multiplier: 0.06,
    },
    shared_shock: 0.48,
    idiosyncratic_shock: 0.85,
  },
};

function buildMonteCarloConfig({
  iterations = 300,
  seed = 42,
  profile = 'balanced',
  scatterDriver = 'freight_multiplier',
  histogramBins = 12,
  historicalData = null,
  historical_data = null,
} = {}) {
  const normalizedIterations = clamp(Math.round(safeNumber(iterations, 300)), 50, 5000);
  const normalizedProfile = normalizeProfile(profile);
  const normalizedDriver = normalizeDriver(scatterDriver);
  const preset = PROFILE_PRESETS[normalizedProfile];
  const historical = normalizeHistoricalData(historicalData || historical_data);
  const historicalProvenanceValid = historical.validation?.provenance_status === 'declared';
  const historicalDrivers = Object.keys(historical)
    .filter((key) => key !== 'observations' && key !== 'validation' && key !== 'provenance')
    .filter(() => historicalProvenanceValid);
  const uncertaintySource = historicalDrivers.length
    ? historicalDrivers.length === 5
      ? 'empirical_historical'
      : 'hybrid_empirical_parametric'
    : 'parametric_assumptions';

  return {
    iterations: normalizedIterations,
    seed,
    seed_effective: hashSeed(seed),
    rng_algorithm: 'mulberry32-v1',
    model: 'monte_carlo_complementary_v2',
    analysis_type:
      uncertaintySource === 'empirical_historical'
        ? 'empirical_uncertainty_analysis'
        : 'exploratory_uncertainty_analysis',
    forecast: false,
    historical_distribution: historicalDrivers.length > 0,
    uncertainty_source: uncertaintySource,
    historical_drivers: historicalDrivers,
    historical_observation_counts: Object.fromEntries(
      historicalDrivers.map((driver) => [driver, historical[driver].length])
    ),
    historical_min_observations: historicalDrivers.length
      ? Math.min(...historicalDrivers.map((driver) => historical[driver].length))
      : 0,
    historical_sample_warning:
      historicalDrivers.length &&
      Math.min(...historicalDrivers.map((driver) => historical[driver].length)) < 5
        ? 'Série histórica curta: os percentis representam as premissas observadas disponíveis, não uma estimativa estatística estável.'
        : null,
    historical_joint_observations: historical.observations?.length || 0,
    historical_complete_joint_observations: historical.validation?.complete_joint_observations || 0,
    historical_unique_joint_support: historical.observations
      ? new Set(historical.observations.map((observation) => JSON.stringify(observation))).size
      : 0,
    historical_rejected_value_count: historical.validation?.rejected_value_count || 0,
    historical_validation: historical.validation || null,
    historical_provenance: historical.provenance || null,
    historical_provenance_status: historicalProvenanceValid ? 'declared' : 'missing_or_incomplete',
    historical_provenance_warning:
      historicalDrivers.length || !hasHistoricalContent(historicalData)
        ? null
        : 'Histórico fornecido sem fonte, período, empresa e unidade completos; tratado como premissa paramétrica, não como histórico validado.',
    historical_sampling: historical.observations?.length
      ? historical.validation?.complete_joint_observations === historical.observations.length
        ? 'joint_empirical_bootstrap'
        : 'partial_joint_hybrid'
      : historicalDrivers.length
        ? 'marginal_empirical_bootstrap'
        : 'parametric_draws',
    deterministic_method: 'scenario_simulation',
    profile: normalizedProfile,
    scatter_driver: normalizedDriver,
    histogram_bins: clamp(Math.round(safeNumber(histogramBins, 12)), 6, 30),
    spread: clone(preset.spread),
    shared_shock: preset.shared_shock,
    idiosyncratic_shock: preset.idiosyncratic_shock,
    historical_data: historical,
  };
}

function sampleAdditive(
  base,
  spread,
  rng,
  sharedShock,
  sharedWeight,
  idiosyncraticWeight,
  min,
  max
) {
  const value =
    base + sharedShock * spread * sharedWeight + gaussian(rng) * spread * idiosyncraticWeight;
  return clamp(value, min, max);
}

function sampleMultiplicative(
  base,
  spreadPct,
  rng,
  sharedShock,
  sharedWeight,
  idiosyncraticWeight,
  minFactor,
  maxFactor
) {
  const value =
    base *
    (1 + sharedShock * spreadPct * sharedWeight + gaussian(rng) * spreadPct * idiosyncraticWeight);
  return clamp(value, base * minFactor, base * maxFactor);
}

function buildSampleScenario({ scenario, sampled, index, profile, seed }) {
  const sampledScenario = clone(scenario);
  const baseName = sampledScenario.scenario_name || sampledScenario.scenario_id || 'Cenário';

  sampledScenario.scenario_id = `${sampledScenario.scenario_id || 'scenario'}__mc_${String(index + 1).padStart(4, '0')}`;
  sampledScenario.scenario_name = `${baseName} · MC ${index + 1}`;
  sampledScenario.changes = {
    ...(sampledScenario.changes || {}),
    freight_multiplier: sampled.freight_multiplier,
    demand_multiplier: sampled.demand_multiplier,
    inventory_days: sampled.inventory_days,
    wacc: sampled.wacc,
  };
  sampledScenario.metadata = {
    ...(sampledScenario.metadata || {}),
    phase: 3,
    monte_carlo: true,
    monte_carlo_profile: profile,
    monte_carlo_seed: seed,
    monte_carlo_iteration: index + 1,
  };

  return sampledScenario;
}

function summarizeSamples({
  samples,
  baselineTotal,
  deterministicTotal,
  deterministicSavingPct,
  config,
  decisionUse = 'decision_support',
}) {
  const totalValues = samples.map((sample) => sample.total_with_tax);
  const savingValues = samples.map((sample) => sample.saving_pct);
  const sortedTotal = [...totalValues].sort((a, b) => a - b);
  const sortedSaving = [...savingValues].sort((a, b) => a - b);
  const meanTotal = mean(totalValues);
  const meanSaving = mean(savingValues);
  const p10Saving = quantile(sortedSaving, 0.1);
  const p50Saving = quantile(sortedSaving, 0.5);
  const p90Saving = quantile(sortedSaving, 0.9);
  const p10Total = quantile(sortedTotal, 0.1);
  const p50Total = quantile(sortedTotal, 0.5);
  const p90Total = quantile(sortedTotal, 0.9);
  const probabilityPositive = savingValues.length
    ? savingValues.filter((value) => value > 0).length / savingValues.length
    : 0;
  const probabilityLoss = savingValues.length
    ? savingValues.filter((value) => value < 0).length / savingValues.length
    : 0;
  const probabilityStrongPositive = savingValues.length
    ? savingValues.filter((value) => value >= 5).length / savingValues.length
    : 0;
  const deterministicPercentile = percentileRank(sortedSaving, deterministicSavingPct);
  const monteCarloPrecision = (() => {
    const n = savingValues.length;
    if (!n) return { standard_error: null, lower_95: null, upper_95: null };
    const z = 1.96;
    const denominator = 1 + (z * z) / n;
    const center = (probabilityPositive + (z * z) / (2 * n)) / denominator;
    const radius =
      (z / denominator) *
      Math.sqrt((probabilityPositive * (1 - probabilityPositive)) / n + (z * z) / (4 * n * n));
    return {
      standard_error: Math.sqrt((probabilityPositive * (1 - probabilityPositive)) / n),
      lower_95: Math.max(0, center - radius),
      upper_95: Math.min(1, center + radius),
    };
  })();
  const correlationMap = {};

  const driverKeys = [
    'freight_multiplier',
    'demand_multiplier',
    'inventory_days',
    'wacc',
    'tax_multiplier',
  ];
  for (const driverKey of driverKeys) {
    correlationMap[driverKey] = pearsonCorrelation(
      samples.map((sample) => sample.inputs?.[driverKey] ?? 0),
      savingValues
    );
  }

  const sortedCorrelations = Object.entries(correlationMap)
    .map(([driver, correlation]) => ({ driver, correlation }))
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

  const percentileCurve = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((percentile) => ({
    percentile,
    value: quantile(sortedSaving, percentile / 100),
  }));
  const totalPercentileCurve = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((percentile) => ({
    percentile,
    value: quantile(sortedTotal, percentile / 100),
  }));

  const histogram = buildHistogram(savingValues, config.histogram_bins);
  const worstCase = sortedSaving.length ? sortedSaving[0] : 0;
  const bestCase = sortedSaving.length ? sortedSaving[sortedSaving.length - 1] : 0;
  const stdSaving = standardDeviation(savingValues);
  const stdTotal = standardDeviation(totalValues);
  const driverImportance = sortedCorrelations.map((item) => ({
    driver: item.driver,
    label: item.driver,
    correlation: item.correlation,
    importance: Math.abs(item.correlation),
  }));

  let riskBand = 'low';
  if (probabilityPositive < 0.6 || p10Saving < 0) {
    riskBand = 'high';
  } else if (probabilityPositive < 0.8 || p10Saving < 2) {
    riskBand = 'medium';
  }

  return {
    iterations: samples.length,
    seed: config.seed,
    seed_effective: config.seed_effective,
    rng_algorithm: config.rng_algorithm,
    profile: config.profile,
    analysis_type: config.analysis_type,
    uncertainty_source: config.uncertainty_source,
    decision_use: decisionUse,
    historical_distribution: config.historical_distribution,
    historical_drivers: config.historical_drivers,
    historical_observation_counts: config.historical_observation_counts,
    historical_min_observations: config.historical_min_observations,
    historical_sample_warning: config.historical_sample_warning,
    historical_sampling: config.historical_sampling,
    historical_joint_observations: config.historical_joint_observations,
    historical_complete_joint_observations: config.historical_complete_joint_observations,
    historical_unique_joint_support: config.historical_unique_joint_support,
    historical_rejected_value_count: config.historical_rejected_value_count,
    effective_historical_sample_size:
      config.historical_joint_observations || config.historical_min_observations || 0,
    monte_carlo_probability_positive_standard_error: monteCarloPrecision.standard_error,
    monte_carlo_probability_positive_lower_95: monteCarloPrecision.lower_95,
    monte_carlo_probability_positive_upper_95: monteCarloPrecision.upper_95,
    simulation_precision_note:
      'A margem acima mede apenas erro de simulação condicional às premissas; não mede representatividade do histórico nem incerteza estrutural do modelo.',
    probability_interpretation: config.historical_distribution
      ? 'condicional_ao_historico_disponivel_e_ao_modelo'
      : 'condicional_as_premissas_parametricas',
    scatter_driver: config.scatter_driver,
    baseline_total_with_tax: baselineTotal,
    deterministic_total_with_tax: deterministicTotal,
    deterministic_saving_pct: deterministicSavingPct,
    iterations_requested: config.iterations,
    iterations_valid: samples.length,
    deterministic_percentile_saving_pct: deterministicPercentile,
    mean_total_with_tax: meanTotal,
    median_total_with_tax: p50Total,
    p10_total_with_tax: p10Total,
    p90_total_with_tax: p90Total,
    mean_saving_pct: meanSaving,
    median_saving_pct: p50Saving,
    p10_saving_pct: p10Saving,
    p90_saving_pct: p90Saving,
    best_case_saving_pct: bestCase,
    worst_case_saving_pct: worstCase,
    probability_saving_positive: probabilityPositive,
    probability_saving_loss: probabilityLoss,
    probability_saving_strong_positive: probabilityStrongPositive,
    stddev_total_with_tax: stdTotal,
    stddev_saving_pct: stdSaving,
    risk_band: riskBand,
    histogram,
    percentile_curve: percentileCurve,
    total_percentile_curve: totalPercentileCurve,
    driver_correlations: correlationMap,
    driver_importance: driverImportance,
    most_sensitive_driver: sortedCorrelations[0]?.driver || null,
    most_sensitive_driver_correlation: sortedCorrelations[0]?.correlation || 0,
  };
}

export function runMonteCarloSimulation({
  companyId,
  selectedScenario,
  baselineBundle,
  deterministicResult = null,
  iterations = 300,
  seed = 42,
  config = {},
} = {}) {
  const warnings = [];
  const errors = [];

  if (!companyId) errors.push('company_id ausente.');
  if (!selectedScenario) errors.push('cenário selecionado ausente.');
  if (!baselineBundle) errors.push('baseline_bundle ausente.');
  if (errors.length) {
    const invalidConfig = buildMonteCarloConfig({ iterations, seed, ...config });
    return {
      company_id: companyId,
      scenario_id: selectedScenario?.scenario_id || null,
      monte_carlo_status: 'error',
      analysis_type: invalidConfig.analysis_type,
      forecast: false,
      historical_distribution: invalidConfig.historical_distribution,
      uncertainty_source: invalidConfig.uncertainty_source,
      config: invalidConfig,
      samples: [],
      summary: null,
      warnings,
      errors,
    };
  }

  const suppliedHistoricalData = [
    config.history,
    config.historical_data,
    baselineBundle?.core_data?.historical_series,
    baselineBundle?.core_data?.time_series,
  ].find(hasHistoricalContent);
  const normalizedConfig = buildMonteCarloConfig({
    iterations,
    seed,
    profile: config.profile || config.uncertainty_profile || 'balanced',
    scatterDriver: config.scatter_driver || config.scatterDriver || 'freight_multiplier',
    histogramBins: config.histogram_bins || 12,
    historicalData: suppliedHistoricalData || null,
  });
  const preset = PROFILE_PRESETS[normalizedConfig.profile];
  const historicalData = normalizedConfig.historical_data || {};
  const historicalDrivers = new Set(normalizedConfig.historical_drivers || []);
  const rng = createRng(normalizedConfig.seed_effective);
  const baseScenario = clone(selectedScenario);
  delete baseScenario.monte_carlo;
  delete baseScenario.analysis;
  const baseChanges = baseScenario.changes || {};
  const baseFreight = Math.max(0.0001, safeNumber(baseChanges.freight_multiplier, 1));
  const baseDemand = Math.max(0.0001, safeNumber(baseChanges.demand_multiplier, 1));
  const baseInventory = Math.max(
    0,
    safeNumber(baseChanges.inventory_days, MODEL_DEFAULTS.inventory_days)
  );
  const baseWacc = Math.max(0, safeNumber(baseChanges.wacc, MODEL_DEFAULTS.reference_wacc));
  const baselineTotal = safeNumber(baselineBundle?.costs?.costs?.total_with_tax);
  const deterministic =
    deterministicResult || runScenario({ companyId, scenario: baseScenario, baselineBundle });
  const baselineScenarioId = baselineBundle?.model?.scenario_id || null;

  if (deterministic?.errors?.length) {
    return {
      company_id: companyId,
      scenario_id: selectedScenario?.scenario_id || null,
      monte_carlo_status: 'blocked',
      analysis_type: normalizedConfig.analysis_type,
      forecast: false,
      historical_distribution: normalizedConfig.historical_distribution,
      uncertainty_source: normalizedConfig.uncertainty_source,
      config: normalizedConfig,
      samples: [],
      summary: null,
      warnings: deterministic.warnings || [],
      errors: deterministic.errors || ['simulação determinística inválida; Monte Carlo bloqueado.'],
    };
  }

  const taxQualityLimited = Boolean(
    deterministic?.tax_results?.tax_coverage?.coverage_limited ||
    deterministic?.calculation_status === 'success_with_tax_limits' ||
    deterministic?.tax_results?.tax_coverage?.blocked === true
  );

  const completeFiscalCoverageRatio = Number(
    deterministic?.tax_results?.tax_coverage?.complete_fiscal_coverage_ratio
  );
  const classificationLimited =
    deterministic?.tax_results?.tax_mode !== 'disabled' &&
    selectedScenario?.changes?.tax_mode !== 'disabled' &&
    (taxQualityLimited ||
      (Number.isFinite(completeFiscalCoverageRatio) && completeFiscalCoverageRatio < 1));
  if (classificationLimited) {
    warnings.push(
      'Monte Carlo executado como análise exploratória: a classificação fiscal completa não cobre 100% dos fluxos.'
    );
  }

  const samples = [];
  for (let index = 0; index < normalizedConfig.iterations; index += 1) {
    const sharedShock = gaussian(rng);
    const historicalObservation = sampleHistoricalObservation(historicalData.observations, rng);
    const historicalValue = (driver) => {
      const value = historicalObservation?.[driver];
      return Number.isFinite(Number(value))
        ? Number(value)
        : sampleHistorical(historicalData[driver], rng);
    };

    const sampled = {
      freight_multiplier: historicalDrivers.has('freight_multiplier')
        ? historicalValue('freight_multiplier')
        : sampleMultiplicative(
            baseFreight,
            preset.spread.freight_multiplier,
            rng,
            sharedShock,
            1,
            preset.idiosyncratic_shock,
            0.6,
            1.8
          ),
      demand_multiplier: historicalDrivers.has('demand_multiplier')
        ? historicalValue('demand_multiplier')
        : sampleMultiplicative(
            baseDemand,
            preset.spread.demand_multiplier,
            rng,
            sharedShock,
            0.9,
            preset.idiosyncratic_shock,
            0.6,
            1.6
          ),
      inventory_days: historicalDrivers.has('inventory_days')
        ? Math.max(0, Math.round(historicalValue('inventory_days')))
        : Math.round(
            sampleAdditive(
              baseInventory,
              preset.spread.inventory_days,
              rng,
              sharedShock,
              1,
              preset.idiosyncratic_shock,
              0,
              120
            )
          ),
      wacc: historicalDrivers.has('wacc')
        ? Math.max(0, historicalValue('wacc'))
        : sampleAdditive(
            baseWacc,
            preset.spread.wacc,
            rng,
            sharedShock,
            0.7,
            preset.idiosyncratic_shock,
            0,
            0.5
          ),
      tax_multiplier: historicalDrivers.has('tax_multiplier')
        ? Math.max(0, historicalValue('tax_multiplier'))
        : sampleMultiplicative(
            1,
            preset.spread.tax_multiplier,
            rng,
            sharedShock,
            0.5,
            preset.idiosyncratic_shock,
            0.7,
            1.35
          ),
      common_shock: sharedShock,
    };

    const sampledScenario = buildSampleScenario({
      scenario: baseScenario,
      sampled,
      index,
      profile: normalizedConfig.profile,
      seed: normalizedConfig.seed_effective,
    });

    const result = runScenario({ companyId, scenario: sampledScenario, baselineBundle });
    if (result.errors?.length) {
      warnings.push(`Amostra ${index + 1} inválida: ${result.errors.join('; ')}`);
      continue;
    }

    const taxImpact = safeNumber(result.costs?.tax_impact);
    const totalLogistics = safeNumber(result.costs?.total_logistics_cost);
    const adjustedTaxImpact = Math.max(0, taxImpact * sampled.tax_multiplier);
    const adjustedTotal = totalLogistics + adjustedTaxImpact;
    const saving = calculateSaving({ baselineTotal, scenarioTotal: adjustedTotal });

    samples.push({
      sample_id: `${selectedScenario.scenario_id || 'scenario'}__mc_${String(index + 1).padStart(4, '0')}`,
      index: index + 1,
      inputs: sampled,
      scenario_id: result.scenario_id,
      total_with_tax: adjustedTotal,
      total_logistics_cost: totalLogistics,
      raw_tax_impact: taxImpact,
      tax_impact: adjustedTaxImpact,
      tax_multiplier: sampled.tax_multiplier,
      saving_abs: saving.saving_abs,
      saving_pct: saving.saving_pct,
      warnings: result.warnings || [],
      errors: [],
    });
  }

  if (!samples.length) {
    return {
      company_id: companyId,
      scenario_id: selectedScenario?.scenario_id || null,
      monte_carlo_status: 'error',
      analysis_type: normalizedConfig.analysis_type,
      forecast: false,
      historical_distribution: normalizedConfig.historical_distribution,
      uncertainty_source: normalizedConfig.uncertainty_source,
      config: normalizedConfig,
      samples: [],
      summary: null,
      warnings,
      errors: warnings.length ? warnings : ['nenhuma amostra válida foi gerada.'],
    };
  }

  const deterministicSaving = calculateSaving({
    baselineTotal,
    scenarioTotal: deterministic.total_with_tax,
  });
  const summary = summarizeSamples({
    samples,
    baselineTotal,
    deterministicTotal: safeNumber(deterministic.total_with_tax),
    deterministicSavingPct: deterministicSaving.saving_pct,
    config: normalizedConfig,
    decisionUse: classificationLimited ? 'exploratory_only' : 'decision_support',
  });

  return {
    company_id: companyId,
    scenario_id: selectedScenario?.scenario_id || null,
    baseline_scenario_id: baselineScenarioId,
    deterministic_scenario_id: deterministic?.scenario_id || selectedScenario?.scenario_id || null,
    monte_carlo_status: 'success',
    analysis_type: normalizedConfig.analysis_type,
    forecast: false,
    historical_distribution: normalizedConfig.historical_distribution,
    uncertainty_source: normalizedConfig.uncertainty_source,
    historical_drivers: normalizedConfig.historical_drivers,
    decision_use: classificationLimited ? 'exploratory_only' : 'decision_support',
    data_quality_status: classificationLimited ? 'limited_fiscal_coverage' : 'complete',
    deterministic_reference: {
      scenario_id: deterministic?.scenario_id || selectedScenario?.scenario_id || null,
      total_with_tax: safeNumber(deterministic?.total_with_tax),
      saving_pct: deterministicSaving.saving_pct,
    },
    config: normalizedConfig,
    samples,
    summary,
    warnings,
    errors: [],
  };
}

export { buildMonteCarloConfig };
