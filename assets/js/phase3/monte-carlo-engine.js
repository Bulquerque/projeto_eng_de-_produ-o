import { runScenario } from './scenario-simulator.js';
import { MODEL_ASSUMPTIONS } from '../shared/model-assumptions.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function n(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hashSeed(seed) {
  if (Number.isFinite(Number(seed))) {
    return Math.trunc(Number(seed)) >>> 0 || 1;
  }

  const text = String(seed || '42');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
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

const MONTE_CARLO_ASSUMPTIONS = MODEL_ASSUMPTIONS.monte_carlo;
const PROFILE_PRESETS = MONTE_CARLO_ASSUMPTIONS.profiles;

const MONTE_CARLO_METHODOLOGY = Object.freeze({
  deterministic_core: true,
  role: 'complementary_probabilistic_layer',
  distribution: 'gaussian_parameterized_with_bounds',
  calibration_status: 'manual_spreads_not_historically_calibrated',
  interpretation:
    'Análise exploratória de sensibilidade; não constitui previsão estatística validada.',
});

function normalizeSpread(profileSpread, override = null) {
  const source = override && typeof override === 'object' ? override : {};
  return Object.fromEntries(
    Object.entries(profileSpread).map(([driver, value]) => [
      driver,
      Math.max(0, n(source[driver], value)),
    ])
  );
}

function buildMonteCarloConfig({
  iterations = MONTE_CARLO_ASSUMPTIONS.default_iterations,
  seed = MONTE_CARLO_ASSUMPTIONS.default_seed,
  profile = 'balanced',
  scatterDriver = 'freight_multiplier',
  histogramBins = MONTE_CARLO_ASSUMPTIONS.default_histogram_bins,
  spread = null,
  sharedShock = null,
  idiosyncraticShock = null,
} = {}) {
  const normalizedIterations = clamp(
    Math.round(n(iterations, MONTE_CARLO_ASSUMPTIONS.default_iterations)),
    MONTE_CARLO_ASSUMPTIONS.minimum_iterations,
    MONTE_CARLO_ASSUMPTIONS.maximum_iterations
  );
  const normalizedProfile = normalizeProfile(profile);
  const normalizedDriver = normalizeDriver(scatterDriver);
  const preset = PROFILE_PRESETS[normalizedProfile];

  return {
    iterations: normalizedIterations,
    seed,
    profile: normalizedProfile,
    scatter_driver: normalizedDriver,
    histogram_bins: clamp(
      Math.round(n(histogramBins, MONTE_CARLO_ASSUMPTIONS.default_histogram_bins)),
      MONTE_CARLO_ASSUMPTIONS.bounds.histogram_bins[0],
      MONTE_CARLO_ASSUMPTIONS.bounds.histogram_bins[1]
    ),
    spread: normalizeSpread(preset.spread, spread),
    shared_shock:
      sharedShock == null ? preset.shared_shock : Math.max(0, n(sharedShock, preset.shared_shock)),
    idiosyncratic_shock:
      idiosyncraticShock == null
        ? preset.idiosyncratic_shock
        : Math.max(0, n(idiosyncraticShock, preset.idiosyncratic_shock)),
    bounds: clone(MONTE_CARLO_ASSUMPTIONS.bounds),
    calibration_status: MONTE_CARLO_METHODOLOGY.calibration_status,
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
  const riskAssumptions = MONTE_CARLO_ASSUMPTIONS.risk;
  const probabilityStrongPositive = savingValues.length
    ? savingValues.filter((value) => value >= riskAssumptions.strong_positive_saving_min_pct)
        .length / savingValues.length
    : 0;
  const deterministicPercentile = percentileRank(sortedSaving, deterministicSavingPct);
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
  if (
    probabilityPositive < riskAssumptions.high_probability_saving_below ||
    p10Saving < riskAssumptions.high_p10_saving_below_pct
  ) {
    riskBand = 'high';
  } else if (
    probabilityPositive < riskAssumptions.medium_probability_saving_below ||
    p10Saving < riskAssumptions.medium_p10_saving_below_pct
  ) {
    riskBand = 'medium';
  }

  return {
    iterations: samples.length,
    seed: config.seed,
    profile: config.profile,
    scatter_driver: config.scatter_driver,
    baseline_total_with_tax: baselineTotal,
    deterministic_total_with_tax: deterministicTotal,
    deterministic_saving_pct: deterministicSavingPct,
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
    probability_saving_strong_positive_threshold_pct:
      riskAssumptions.strong_positive_saving_min_pct,
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
  baselineResult = null,
  deterministicResult = null,
  iterations = MONTE_CARLO_ASSUMPTIONS.default_iterations,
  seed = MONTE_CARLO_ASSUMPTIONS.default_seed,
  config = {},
} = {}) {
  const warnings = [MONTE_CARLO_METHODOLOGY.interpretation];
  const errors = [];

  if (!companyId) errors.push('company_id ausente.');
  if (!selectedScenario) errors.push('cenário selecionado ausente.');
  if (!baselineBundle) errors.push('baseline_bundle ausente.');
  if (errors.length) {
    return {
      company_id: companyId,
      scenario_id: selectedScenario?.scenario_id || null,
      monte_carlo_status: 'error',
      config: buildMonteCarloConfig({ iterations, seed, ...config }),
      samples: [],
      summary: null,
      methodology: MONTE_CARLO_METHODOLOGY,
      warnings,
      errors,
    };
  }

  const normalizedConfig = buildMonteCarloConfig({
    iterations,
    seed,
    profile: config.profile || config.uncertainty_profile || 'balanced',
    scatterDriver: config.scatter_driver || config.scatterDriver || 'freight_multiplier',
    histogramBins: config.histogram_bins || MONTE_CARLO_ASSUMPTIONS.default_histogram_bins,
    spread: config.spread || null,
    sharedShock: config.shared_shock ?? config.sharedShock ?? null,
    idiosyncraticShock: config.idiosyncratic_shock ?? config.idiosyncraticShock ?? null,
  });
  const rng = createRng(normalizedConfig.seed);
  const baseScenario = clone(selectedScenario);
  delete baseScenario.monte_carlo;
  delete baseScenario.analysis;
  const baseChanges = baseScenario.changes || {};
  const baseFreight = Math.max(0.0001, n(baseChanges.freight_multiplier, 1));
  const baseDemand = Math.max(0.0001, n(baseChanges.demand_multiplier, 1));
  const baseInventory = Math.max(
    0,
    n(baseChanges.inventory_days, MODEL_ASSUMPTIONS.inventory.baseline_days)
  );
  const baseWacc = Math.max(0, n(baseChanges.wacc, MODEL_ASSUMPTIONS.inventory.baseline_wacc));
  const baselineTotal = n(
    baselineResult?.total_with_tax ??
      deterministicResult?.baseline_total ??
      baselineBundle?.costs?.costs?.total_with_tax
  );
  const deterministic =
    deterministicResult || runScenario({ companyId, scenario: baseScenario, baselineBundle });

  if (!(baselineTotal > 0)) {
    return {
      company_id: companyId,
      scenario_id: selectedScenario?.scenario_id || null,
      monte_carlo_status: 'blocked',
      config: normalizedConfig,
      samples: [],
      summary: null,
      methodology: MONTE_CARLO_METHODOLOGY,
      warnings,
      errors: ['baseline total deve ser positivo para calcular saving e probabilidades.'],
    };
  }

  if (deterministic?.errors?.length) {
    return {
      company_id: companyId,
      scenario_id: selectedScenario?.scenario_id || null,
      monte_carlo_status: 'blocked',
      config: normalizedConfig,
      samples: [],
      summary: null,
      methodology: MONTE_CARLO_METHODOLOGY,
      warnings: [...warnings, ...(deterministic.warnings || [])],
      errors: deterministic.errors || ['simulação determinística inválida; Monte Carlo bloqueado.'],
    };
  }

  const samples = [];
  for (let index = 0; index < normalizedConfig.iterations; index += 1) {
    const sharedShock = gaussian(rng);

    const sampled = {
      freight_multiplier: sampleMultiplicative(
        baseFreight,
        normalizedConfig.spread.freight_multiplier,
        rng,
        sharedShock,
        normalizedConfig.shared_shock,
        normalizedConfig.idiosyncratic_shock,
        normalizedConfig.bounds.freight_multiplier_factor[0],
        normalizedConfig.bounds.freight_multiplier_factor[1]
      ),
      demand_multiplier: sampleMultiplicative(
        baseDemand,
        normalizedConfig.spread.demand_multiplier,
        rng,
        sharedShock,
        normalizedConfig.shared_shock * 0.9,
        normalizedConfig.idiosyncratic_shock,
        normalizedConfig.bounds.demand_multiplier_factor[0],
        normalizedConfig.bounds.demand_multiplier_factor[1]
      ),
      inventory_days: Math.round(
        sampleAdditive(
          baseInventory,
          normalizedConfig.spread.inventory_days,
          rng,
          sharedShock,
          normalizedConfig.shared_shock,
          normalizedConfig.idiosyncratic_shock,
          normalizedConfig.bounds.inventory_days[0],
          normalizedConfig.bounds.inventory_days[1]
        )
      ),
      wacc: sampleAdditive(
        baseWacc,
        normalizedConfig.spread.wacc,
        rng,
        sharedShock,
        normalizedConfig.shared_shock * 0.7,
        normalizedConfig.idiosyncratic_shock,
        normalizedConfig.bounds.wacc[0],
        normalizedConfig.bounds.wacc[1]
      ),
      tax_multiplier: sampleMultiplicative(
        1,
        normalizedConfig.spread.tax_multiplier,
        rng,
        sharedShock,
        normalizedConfig.shared_shock * 0.5,
        normalizedConfig.idiosyncratic_shock,
        normalizedConfig.bounds.tax_multiplier[0],
        normalizedConfig.bounds.tax_multiplier[1]
      ),
      common_shock: sharedShock,
    };

    const sampledScenario = buildSampleScenario({
      scenario: baseScenario,
      sampled,
      index,
      profile: normalizedConfig.profile,
      seed: normalizedConfig.seed,
    });

    const result = runScenario({ companyId, scenario: sampledScenario, baselineBundle });
    if (result.errors?.length) {
      warnings.push(`Amostra ${index + 1} inválida: ${result.errors.join('; ')}`);
      continue;
    }

    const taxImpact = n(result.costs?.tax_impact);
    const totalLogistics = n(result.costs?.total_logistics_cost);
    const adjustedTaxImpact = Math.max(0, taxImpact * sampled.tax_multiplier);
    const adjustedTotal = totalLogistics + adjustedTaxImpact;
    const savingAbs = baselineTotal - adjustedTotal;
    const savingPct = baselineTotal ? (savingAbs / baselineTotal) * 100 : 0;

    samples.push({
      sample_id: `${selectedScenario.scenario_id || 'scenario'}__mc_${String(index + 1).padStart(4, '0')}`,
      index: index + 1,
      inputs: sampled,
      scenario_id: result.scenario_id,
      total_with_tax: adjustedTotal,
      total_logistics_cost: totalLogistics,
      tax_impact: adjustedTaxImpact,
      saving_abs: savingAbs,
      saving_pct: savingPct,
      warnings: result.warnings || [],
      errors: [],
    });
  }

  if (!samples.length) {
    return {
      company_id: companyId,
      scenario_id: selectedScenario?.scenario_id || null,
      monte_carlo_status: 'error',
      config: normalizedConfig,
      samples: [],
      summary: null,
      methodology: MONTE_CARLO_METHODOLOGY,
      warnings,
      errors: warnings.length ? warnings : ['nenhuma amostra válida foi gerada.'],
    };
  }

  const summary = summarizeSamples({
    samples,
    baselineTotal,
    deterministicTotal: n(deterministic.total_with_tax),
    deterministicSavingPct: baselineTotal
      ? ((baselineTotal - n(deterministic.total_with_tax)) / baselineTotal) * 100
      : 0,
    config: normalizedConfig,
  });

  return {
    company_id: companyId,
    scenario_id: selectedScenario?.scenario_id || null,
    monte_carlo_status: 'success',
    config: normalizedConfig,
    samples,
    summary,
    methodology: MONTE_CARLO_METHODOLOGY,
    invalid_sample_count: normalizedConfig.iterations - samples.length,
    warnings,
    errors: [],
  };
}

export { buildMonteCarloConfig };
