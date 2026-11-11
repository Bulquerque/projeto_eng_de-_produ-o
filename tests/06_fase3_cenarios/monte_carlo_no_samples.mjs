import assert from 'node:assert/strict';
import { renderScenarioMonteCarlo } from '../../assets/js/phase3/scenario-arena/monte-carlo-view.js';
import {
  classifyMonteCarloRiskBand,
  monteCarloIterationValidationWarning,
  runMonteCarloSimulation,
} from '../../assets/js/phase3/monte-carlo-engine.js';

const usableSyntheticResult = {
  simulation_status: 'success',
  total_with_tax: 100,
  costs: { total_logistics_cost: 90, tax_impact: 10 },
};
assert.equal(monteCarloIterationValidationWarning(usableSyntheticResult, 1), null);
const blockedBaseline = runMonteCarloSimulation({
  companyId: 'empresa1',
  selectedScenario: { scenario_id: 'x', changes: {} },
  baselineBundle: { costs: { costs: { total_with_tax: null } } },
  deterministicResult: usableSyntheticResult,
});
assert.equal(blockedBaseline.monte_carlo_status, 'blocked');
assert.match(blockedBaseline.errors[0], /baseline/);
const blockedDeterministic = runMonteCarloSimulation({
  companyId: 'empresa1',
  selectedScenario: { scenario_id: 'x', changes: {} },
  baselineBundle: { costs: { costs: { total_with_tax: 100 } } },
  deterministicResult: { ...usableSyntheticResult, simulation_status: 'invalid', errors: [] },
});
assert.equal(blockedDeterministic.monte_carlo_status, 'blocked');
assert.ok(blockedDeterministic.errors.length);
const invalidStatusWarning = monteCarloIterationValidationWarning(
  {
    ...usableSyntheticResult,
    simulation_status: 'invalid',
    errors: [{ message: 'Cenário reprovado na validação.' }],
    warnings: [{ message: 'Amostra fiscal parcial.' }],
  },
  2
);
assert.match(invalidStatusWarning, /simulation_status=invalid/);
assert.match(invalidStatusWarning, /Cenário reprovado na validação/);
assert.match(invalidStatusWarning, /Amostra fiscal parcial/);
for (const missingTotal of [undefined, null, '']) {
  const missingTotalWarning = monteCarloIterationValidationWarning(
    { ...usableSyntheticResult, total_with_tax: missingTotal },
    3
  );
  assert.match(missingTotalWarning, /total com tributo ausente ou não numérico/);
}

assert.equal(classifyMonteCarloRiskBand(0.8, 2), 'low');
for (const invalidProbability of ['', ' ', true, false, -0.01, 1.01, '0.8']) {
  assert.equal(classifyMonteCarloRiskBand(invalidProbability, 2), null);
}
for (const invalidP10 of ['', ' ', true, false, '2']) {
  assert.equal(classifyMonteCarloRiskBand(0.8, invalidP10), null);
}
assert.equal(classifyMonteCarloRiskBand(0.8, 2, { invalidSampleCount: 1 }), null);

const failIfRendered = {
  setAttribute() {
    throw new Error('Monte Carlo chart rendered without valid Monte Carlo samples');
  },
};
const elements = {
  monteCarloSummaryCards: { innerHTML: '' },
  monteCarloSummaryTable: { innerHTML: '' },
  monteCarloRiskChart: failIfRendered,
  monteCarloHistogramChart: failIfRendered,
  monteCarloCdfChart: failIfRendered,
  monteCarloTotalChart: failIfRendered,
  monteCarloDriversChart: failIfRendered,
  monteCarloScatterChart: failIfRendered,
};
globalThis.document = {
  getElementById(id) {
    return elements[id] || null;
  },
};

renderScenarioMonteCarlo({
  monteCarlo: {
    summary: {
      iterations: 0,
      iterations_valid: 0,
      iterations_requested: 100,
      risk_band: null,
      probability_saving_positive: 0,
      probability_saving_loss: 0,
      p10_saving_pct: 0,
      median_saving_pct: 0,
      p90_saving_pct: 0,
      p10_total_with_tax: 0,
      median_total_with_tax: 0,
      p90_total_with_tax: 0,
      histogram: [{ label: '0%', count: 0 }],
      percentile_curve: [{ percentile: 10, value: 0 }],
      total_percentile_curve: [{ percentile: 10, value: 0 }],
      driver_importance: [{ driver: 'freight_multiplier', correlation: 0, importance: 0 }],
    },
    samples: [{ saving_pct: 0, inputs: { freight_multiplier: 1 } }],
  },
});

const rendered = `${elements.monteCarloSummaryCards.innerHTML}\n${elements.monteCarloSummaryTable.innerHTML}`;
assert.match(
  rendered,
  /Sem amostras válidas; faixa de risco e leitura probabilística indisponíveis\./i
);
assert.match(
  rendered,
  /legado|pareada/i,
  'saved Monte Carlo results without pairing metadata must be labeled legacy'
);
assert.doesNotMatch(rendered, /estabilidade razoável|sustentação probabilística/i);
assert.match(
  rendered,
  /<span class="metric-label">Prob\. saving positivo<\/span><strong class="metric-value">—<\/strong>/
);
assert.match(rendered, /<tr><td>Prob\. saving positivo<\/td><td>—<\/td><\/tr>/);
assert.match(
  rendered,
  /<span class="metric-label">Prob\. saving negativo<\/span><strong class="metric-value">—<\/strong>/
);
assert.match(rendered, /<tr><td>Prob\. saving negativo<\/td><td>—<\/td><\/tr>/);
assert.match(rendered, /Saving mediano<\/span><strong class="metric-value">—<\/strong>/);
assert.match(rendered, /Custo mediano<\/span><strong class="metric-value">—<\/strong>/);
assert.match(rendered, /Percentil do cenário<\/span><strong class="metric-value">—<\/strong>/);
assert.doesNotMatch(rendered, /<td>0,0%|R\$\u00a00|\+0\.00<\/td>/);

elements.monteCarloSummaryCards.innerHTML = '';
elements.monteCarloSummaryTable.innerHTML = '';
renderScenarioMonteCarlo({
  monteCarlo: {
    monte_carlo_status: 'error',
    risk_band_unavailable_reason: 'no_valid_samples',
    invalid_sample_count: 10,
    summary: null,
    samples: [],
  },
});
assert.match(
  elements.monteCarloSummaryTable.innerHTML,
  /Sem amostras válidas; indicadores probabilísticos indisponíveis/
);

for (const riskBand of [undefined, 'unknown']) {
  elements.monteCarloRiskChart = null;
  elements.monteCarloSummaryCards.innerHTML = '';
  elements.monteCarloSummaryTable.innerHTML = '';
  renderScenarioMonteCarlo({
    monteCarlo: {
      summary: {
        iterations: 10,
        iterations_valid: 10,
        probability_saving_positive: 0.9,
        probability_saving_loss: 0.1,
        risk_band: riskBand,
        histogram: [],
        percentile_curve: [],
        total_percentile_curve: [],
        driver_importance: [],
      },
      samples: [],
    },
  });
  const unknownBandRendered = `${elements.monteCarloSummaryCards.innerHTML}\n${elements.monteCarloSummaryTable.innerHTML}`;
  assert.match(
    unknownBandRendered,
    /faixa de risco Monte Carlo válida; leitura executiva indisponível/i
  );
  assert.doesNotMatch(unknownBandRendered, /estabilidade razoável|sustentação probabilística/i);
}

elements.monteCarloRiskChart = null;
elements.monteCarloSummaryCards.innerHTML = '';
elements.monteCarloSummaryTable.innerHTML = '';
renderScenarioMonteCarlo({
  monteCarlo: {
    summary: {
      iterations: 10,
      iterations_valid: 10,
      iterations_requested: 10,
      risk_band: 'medium',
      probability_saving_positive: 0.75,
      probability_saving_loss: 0.25,
      histogram: [],
      percentile_curve: [],
      total_percentile_curve: [],
      driver_importance: [],
    },
    samples: [],
  },
});
const validRendered = `${elements.monteCarloSummaryCards.innerHTML}\n${elements.monteCarloSummaryTable.innerHTML}`;
assert.match(validRendered, /75,0%/);
assert.match(validRendered, /25,0%/);
assert.match(validRendered, /O cenário mantém saving na maior parte das amostras/);

elements.monteCarloSummaryCards.innerHTML = '';
elements.monteCarloSummaryTable.innerHTML = '';
renderScenarioMonteCarlo({
  monteCarlo: {
    summary: {
      iterations: 9,
      iterations_valid: 9,
      iterations_requested: 10,
      invalid_sample_count: 1,
      risk_band: null,
      risk_band_unavailable_reason: 'invalid_samples_present',
      probability_saving_positive: 0.8,
      probability_saving_loss: 0.2,
      p10_saving_pct: 2,
      median_saving_pct: 3,
      p90_saving_pct: 5,
      mean_total_with_tax: 90,
      median_total_with_tax: 89,
      p10_total_with_tax: 85,
      p90_total_with_tax: 95,
      stddev_total_with_tax: 4,
      stddev_saving_pct: 1,
      histogram: [],
      percentile_curve: [],
      total_percentile_curve: [],
      driver_importance: [],
    },
    samples: [],
  },
});
const partialRendered = `${elements.monteCarloSummaryCards.innerHTML}\n${elements.monteCarloSummaryTable.innerHTML}`;
assert.match(partialRendered, /Faixa de risco Monte Carlo indisponível: 1 iteração inválida/);
assert.match(partialRendered, /80,0%/);
assert.match(partialRendered, /Saving mediano/);
assert.doesNotMatch(
  partialRendered,
  /estabilidade razoável|sustentação probabilística|risco Monte Carlo low|risco Monte Carlo medium/
);

console.log('MONTE_CARLO_NO_VALID_SAMPLES_OK');
