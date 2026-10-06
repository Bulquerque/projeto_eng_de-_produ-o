import assert from 'node:assert/strict';
import { overviewAnalyticsInternals as analytics } from '../../assets/js/app/charts/overview-analytics.js';
import { buildEvidenceCoverage } from '../../assets/js/app/charts/trust-analytics.js';
import { renderOverviewSummary, renderOverviewTax } from '../../assets/js/app/pages/overview.js';
import {
  aggregateDistributionDistances,
  aggregateDistributionWeightByCd,
} from '../../assets/js/app/charts/charts.js';

// Synthetic fixture mirrors Empresa 2's mixed stream: source-side factory→CD
// volume rows coexist with distribution records that have no usable kg/cost.
const flows = [
  { flow_id: 'd1', flow_type: 'cd_to_destination', cd: 'CD Norte', destination: 'Loja 1' },
  {
    flow_id: 'd2',
    flow_type: 'cd_to_destination',
    cd: 'CD Norte',
    destination: 'Loja 2',
    volume: 900,
  },
  { flow_id: 'd3', flow_type: 'cd_to_destination', cd: 'CD Sul', destination: 'Loja 3' },
  { flow_id: 'd4', flow_type: 'cd_to_destination_proxy', cd: 'CD Sul', destination: 'Loja 4' },
  ...Array.from({ length: 10 }, (_, index) => ({
    flow_id: `s${index}`,
    flow_type: 'factory_to_cd',
    origin: `Fábrica ${index}`,
    cd: index % 2 ? 'CD Norte' : 'CD Sul',
    volume: 100000 + index,
  })),
];

const counts = analytics.buildFlowCountByCd(flows);
assert.deepEqual(counts.rows, [
  ['CD Norte', 2],
  ['CD Sul', 2],
]);
assert.equal(counts.eligible, 4);
assert.equal(counts.counted, 4);
assert.equal(counts.missingCd, 0);
assert.equal(
  counts.rows.reduce((total, [, count]) => total + count, 0),
  4,
  'bars count eligible distribution records, never demand or unqualified source volume'
);

const weighted = analytics.buildWeightDistanceDistribution(flows);
assert.equal(weighted.eligibleCount, 4);
assert.equal(weighted.coveredWeight, 0);
assert.equal(weighted.proxyFlows, 1);

const costByCd = analytics.buildCdDistributionCost({
  flows,
  costs: {
    flow_cost_detail: [
      { flow_id: 'd1', distribution_cost: 10 },
      { flow_id: 's0', distribution_cost: 9000 },
      { flow_id: 'unknown', distribution_cost: 1000 },
    ],
  },
});
assert.deepEqual(costByCd.rows, [['CD Norte', 10]]);
assert.equal(costByCd.joined, 1);
assert.equal(costByCd.eligible, 4);
assert.equal(costByCd.proxyFlows, 1);

const fiscalSeries = analytics.buildTaxCoverageSeries({
  tax_period_contract: {
    available_periods: [
      { year: 2026, phase: 'transicao', current_tax_weight: 0.7, reform_tax_weight: 0.3 },
      { year: 2027, phase: 'transicao', current_tax_weight: 0.5, reform_tax_weight: null },
      { year: 2028, phase: 'transicao', current_tax_weight: 1.4, reform_tax_weight: 0.4 },
      { year: 2029, phase: 'sem_peso' },
    ],
  },
});
assert.deepEqual(fiscalSeries.rows, [
  { label: '2026 · transicao', current: 0.7, reform: 0.3 },
  { label: '2027 · transicao', current: 0.5, reform: null },
  { label: '2028 · transicao', current: null, reform: 0.4 },
]);
assert.equal(fiscalSeries.currentCount, 2);
assert.equal(fiscalSeries.reformCount, 2);
assert.equal(fiscalSeries.pairedCount, 1);
assert.equal(analytics.isDistributionFlow(flows.at(-1)), false);
const networkWeight = aggregateDistributionWeightByCd([
  { flow_type: 'cd_to_destination', cd: 'CD A', annual_weight_kg: 1200 },
  { flow_type: 'cd_to_destination', cd: 'CD A', volume: 5000 },
  { flow_type: 'factory_to_cd', cd: 'CD A', annual_weight_kg: 9000 },
]);
assert.deepEqual(networkWeight.rows, [['CD A', 1200]]);
assert.equal(networkWeight.eligible, 2);
assert.equal(networkWeight.included, 1);
const networkDistance = aggregateDistributionDistances([
  { flow_type: 'cd_to_destination', distance_km: 80 },
  { flow_type: 'cd_to_destination', distance_km: null },
  { flow_type: 'factory_to_cd', distance_km: 200 },
]);
assert.deepEqual(networkDistance.buckets, [1, 0, 0, 0]);
assert.equal(networkDistance.eligible, 2);

const coverage = buildEvidenceCoverage([
  { label: 'Demanda', coverage: 0.75 },
  { label: 'Distância', coverage: null },
  { label: 'Peso', coverage: 1.2 },
  { label: 'Custo', coverage: '0.5' },
]);
assert.deepEqual(coverage, {
  rows: [
    { label: 'Demanda', value: 75 },
    { label: 'Custo', value: 50 },
  ],
  total: 4,
  available: 2,
});

const executiveState = {
  context: {
    company_id: 'empresa_mock',
    provider_kind: 'mock',
    selected_scenario_id: 'candidate-1',
  },
  ui: { route: '#/network/overview/summary' },
  data: {
    baseline: {
      model: { scenario_id: 'baseline' },
      flows,
      costs: {
        costs: {
          total_with_tax: 144000,
          total_logistics_cost: 120000,
          tax_impact: 24000,
          transfer_cost: 30000,
          distribution_cost: 40000,
          storage_cost: 20000,
          inventory_cost: 30000,
        },
      },
    },
    selected_scenario: {
      scenario_id: 'candidate-1',
      scenario_type: 'scenario',
      scenario_name: 'Cenário ativo',
    },
    scenarios: [],
    robustness: { conditional_robustness_score: 9.200000000000001 },
    scenario_result: {
      total_with_tax: 137000,
      costs: {
        total_logistics_cost: 110000,
        tax_impact: 27000,
        transfer_cost: 28000,
        distribution_cost: 37000,
        storage_cost: 18000,
        inventory_cost: 27000,
      },
    },
  },
};
const executiveHtml = renderOverviewSummary(executiveState);
assert.match(executiveHtml, /R\$\s?137\.000/);
assert.match(executiveHtml, /R\$\s?110\.000/);
assert.match(executiveHtml, /R\$\s?27\.000/);
assert.match(executiveHtml, /R\$\s?7\.000/);
assert.match(executiveHtml, /id="niOverviewCostCompositionChart"/);
assert.match(executiveHtml, /id="niOverviewCostComparisonChart"/);
assert.match(executiveHtml, /id="niFlowCountByCdChart"/);
assert.match(executiveHtml, /data-testid="overview-metrics"/);
assert.doesNotMatch(
  executiveHtml,
  /robustness|robustez|evidence|evidência|confiabilidade|confiança|recomendação|recomendado/i
);
assert.doesNotMatch(executiveHtml, /R\$\s?144\.000/);
executiveState.data.scenario_result = null;
const pendingScenarioHtml = renderOverviewSummary(executiveState);
assert.match(pendingScenarioHtml, /—/);
assert.doesNotMatch(pendingScenarioHtml, /R\$\s?144\.000/);
assert.doesNotMatch(pendingScenarioHtml, /R\$\s?0(?:,00)?/);
executiveState.data.selected_scenario.result = {
  total_with_tax: 137000,
  costs: {
    total_logistics_cost: 110000,
    tax_impact: 27000,
    transfer_cost: 28000,
    distribution_cost: 37000,
    storage_cost: 18000,
    inventory_cost: 27000,
  },
};
const selectedResultFallbackHtml = renderOverviewSummary(executiveState);
assert.match(selectedResultFallbackHtml, /R\$\s?137\.000/);
assert.match(selectedResultFallbackHtml, /R\$\s?110\.000/);
assert.match(selectedResultFallbackHtml, /R\$\s?27\.000/);
executiveState.data.selected_scenario = null;
executiveState.context.selected_scenario_id = null;
const baselineHtml = renderOverviewSummary(executiveState);
assert.match(baselineHtml, /R\$\s?144\.000/);

const taxState = {
  context: { company_id: 'empresa_mock', provider_kind: 'mock' },
  ui: { route: '#/network/overview/tax' },
  data: {
    baseline: {
      company_id: 'empresa_mock',
      costs: { costs: { tax_impact: 44000 } },
      tax_results: {
        tax_results: {
          tax_regime: 'current',
          total_tax_impact: 46000,
          explanation: { unexpected: 'must not stringify as an object' },
          tax_period_contract: {
            available_periods: [
              { year: 2026, phase: 'transicao', current_tax_weight: 0.7, reform_tax_weight: 0.3 },
            ],
          },
        },
      },
    },
  },
};
const taxHtml = renderOverviewTax(taxState);
assert.match(taxHtml, /Demonstração · empresa fictícia/);
assert.match(taxHtml, /<span>Regime<\/span><strong>Atual<\/strong>/);
assert.match(taxHtml, /R\$\s?44\.000/);
assert.match(taxHtml, /id="niOverviewTaxImpactChart"/);
assert.match(taxHtml, /<td>2026<\/td>/);
assert.match(taxHtml, /70,0%/);
assert.doesNotMatch(taxHtml, /\[object Object\]/);
assert.equal(taxState.data.baseline.tax_results.tax_results.tax_regime, 'current');
taxState.data.baseline.company_id = 'empresa1';
const mismatchedTaxHtml = renderOverviewTax(taxState);
assert.match(mismatchedTaxHtml, /não correspondem à empresa ativa/i);
assert.doesNotMatch(mismatchedTaxHtml, /niOverviewTaxCoverageChart/);
assert.doesNotMatch(mismatchedTaxHtml, /niOverviewTaxImpactChart/);
taxState.data.baseline.company_id = 'empresa_mock';
taxState.data.baseline.costs.costs.tax_impact = null;
const taxTotalFallbackHtml = renderOverviewTax(taxState);
assert.match(taxTotalFallbackHtml, /R\$\s?46\.000/);
taxState.data.baseline.tax_results.tax_results.total_tax_impact = null;
const missingImpactHtml = renderOverviewTax(taxState);
assert.match(missingImpactHtml, /Impacto tributário registrado[\s\S]*?—/);

const missingCd = analytics.buildFlowCountByCd([
  { flow_type: 'cd_to_destination', destination: 'Loja sem CD' },
  { flow_type: 'factory_to_cd', origin: 'Fábrica', cd: 'CD A', volume: 999 },
]);
assert.deepEqual(missingCd.rows, []);
assert.equal(missingCd.eligible, 1);
assert.equal(missingCd.counted, 0);
assert.equal(missingCd.missingCd, 1);

console.log('OVERVIEW_ANALYTICS_AGGREGATION_OK');
