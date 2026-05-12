import { renderBarChart, destroyChart } from '../shared/chart-renderer.js';

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
    tax_impact: 'Tributo'
  };

  const labels = keys.map(k => labelsMap[k]);
  
  const baselineData = keys.map(k => baselineCosts[k] || 0);
  const scenarioData = keys.map(k => scenarioCosts[k] || 0);

  const datasets = [
    {
      label: 'Baseline',
      data: baselineData,
      backgroundColor: '#CCC9CA' // --vg-soft
    },
    {
      label: 'Cenário Atual',
      data: scenarioData,
      backgroundColor: '#00A189' // --vg-green
    }
  ];

  renderBarChart('scenarioComparisonChart', {
    labels,
    datasets,
    title: 'Comparação de Custos por Componente',
    yFormat: 'money'
  });
}
