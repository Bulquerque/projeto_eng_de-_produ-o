import {
  renderBarChart,
  renderDonutChart,
  renderLineChart,
  renderScatterChart,
  destroyChart,
} from '../shared/chart-renderer.js';

export function renderScenarioComparisonChart(baselineCosts, scenarioCosts) {
  if (!baselineCosts || !scenarioCosts) {
    destroyChart('scenarioComparisonChart');
    return;
  }

  const keys = ['distribution_cost', 'storage_cost', 'inventory_cost', 'tax_impact'];
  const labelsMap = {
    distribution_cost: 'Distribuição',
    storage_cost: 'Armazenagem',
    inventory_cost: 'Estoque',
    tax_impact: 'Tributo',
  };

  const labels = keys.map((k) => labelsMap[k]);

  const baselineData = keys.map((k) => baselineCosts[k] || 0);
  const scenarioData = keys.map((k) => scenarioCosts[k] || 0);

  const datasets = [
    {
      label: 'Baseline',
      data: baselineData,
      backgroundColor: '#CCC9CA', // --vg-soft
    },
    {
      label: 'Cenário Atual',
      data: scenarioData,
      backgroundColor: '#00A189', // --vg-green
    },
  ];

  renderBarChart('scenarioComparisonChart', {
    labels,
    datasets,
    title: 'Comparação de Custos por Componente',
    yFormat: 'money',
  });
}

export function renderMonteCarloHistogram(histogram) {
  if (!histogram || histogram.length === 0) {
    destroyChart('monteCarloHistogramChart');
    return;
  }

  renderBarChart('monteCarloHistogramChart', {
    labels: histogram.map((bin) => bin.label),
    datasets: [
      {
        label: 'Frequência',
        data: histogram.map((bin) => bin.count),
        backgroundColor: '#00A189',
      },
    ],
    title: 'Distribuição de Saving (%)',
    yFormat: 'integer',
  });
}

export function renderMonteCarloPercentileCurve(percentileCurve) {
  if (!percentileCurve || percentileCurve.length === 0) {
    destroyChart('monteCarloCdfChart');
    return;
  }

  renderLineChart('monteCarloCdfChart', {
    labels: percentileCurve.map((point) => `P${point.percentile}`),
    datasets: [
      {
        label: 'Saving (%)',
        data: percentileCurve.map((point) => point.value),
        borderColor: '#0C7878',
        backgroundColor: '#0C7878',
      },
    ],
    title: 'Curva Percentílica do Saving',
    yFormat: 'percent',
  });
}

export function renderMonteCarloScatter(samples, driverKey, driverLabel) {
  if (!samples || samples.length === 0 || !driverKey) {
    destroyChart('monteCarloScatterChart');
    return;
  }

  renderScatterChart('monteCarloScatterChart', {
    datasets: [
      {
        label: driverLabel || driverKey,
        data: samples.map((sample) => ({
          x: Number(sample.inputs?.[driverKey] || 0),
          y: Number(sample.saving_pct || 0),
        })),
        borderColor: '#92400e',
        backgroundColor: '#92400e',
      },
    ],
    xLabel: driverLabel || driverKey,
    yLabel: 'Saving (%)',
    title: 'Driver vs Saving',
    xFormat: 'number',
    yFormat: 'percent',
  });
}

export function renderMonteCarloRiskDonut(summary) {
  if (!summary) {
    destroyChart('monteCarloRiskChart');
    return;
  }

  const positive = Math.max(0, Number(summary.probability_saving_positive || 0) * 100);
  const negative = Math.max(0, 100 - positive);
  renderDonutChart('monteCarloRiskChart', {
    labels: ['Saving positivo', 'Sem saving'],
    datasets: [
      {
        data: [positive, negative],
        backgroundColor: ['#00A189', '#b42318'],
      },
    ],
    title: 'Probabilidade de saving positivo',
    isHalf: true,
    centerText: `${positive.toFixed(0)}%`,
  });
}

export function renderMonteCarloTotalCurve(totalPercentileCurve) {
  if (!totalPercentileCurve || totalPercentileCurve.length === 0) {
    destroyChart('monteCarloTotalChart');
    return;
  }

  renderLineChart('monteCarloTotalChart', {
    labels: totalPercentileCurve.map((point) => `P${point.percentile}`),
    datasets: [
      {
        label: 'Total com tributo',
        data: totalPercentileCurve.map((point) => point.value),
        borderColor: '#00363D',
        backgroundColor: '#00363D',
      },
    ],
    title: 'Curva Percentílica do Custo Total',
    yFormat: 'money',
  });
}

export function renderMonteCarloDriverImportance(driverImportance) {
  if (!driverImportance || driverImportance.length === 0) {
    destroyChart('monteCarloDriversChart');
    return;
  }

  const topDrivers = [...driverImportance]
    .sort((a, b) => Math.abs(b.correlation || 0) - Math.abs(a.correlation || 0))
    .slice(0, 5)
    .reverse();

  renderBarChart('monteCarloDriversChart', {
    labels: topDrivers.map((item) => item.label || item.driver),
    datasets: [
      {
        label: 'Correlação absoluta',
        data: topDrivers.map((item) => Math.abs(item.correlation || 0) * 100),
        backgroundColor: '#0C7878',
      },
    ],
    title: 'Drivers mais influentes',
    indexAxis: 'y',
    xFormat: 'percent',
  });
}
