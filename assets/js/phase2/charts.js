import { renderBarChart, renderDonutChart, destroyChart } from '../shared/chart-renderer.js';

export function renderCostBreakdownChart(costs) {
  if (!costs) {
    destroyChart('costBreakdownChart');
    return;
  }

  const keys = ['distribution_cost', 'storage_cost', 'inventory_cost', 'tax_cost'];
  const labelsMap = {
    distribution_cost: 'Distribuição',
    storage_cost: 'Armazenagem',
    inventory_cost: 'Estoque',
    tax_cost: 'Tributo'
  };

  const data = [];
  const labels = [];
  
  keys.forEach(k => {
    if (costs[k]) {
      data.push(costs[k]);
      labels.push(labelsMap[k]);
    }
  });

  if (data.length === 0) {
    destroyChart('costBreakdownChart');
    return;
  }

  renderDonutChart('costBreakdownChart', {
    labels,
    datasets: [{ data }],
    title: 'Mix de Custos Operacionais (%)'
  });
}

export function renderCdVolumeChart(flows) {
  if (!flows || flows.length === 0) {
    destroyChart('cdVolumeChart');
    return;
  }

  const cdVols = {};
  flows.forEach(f => {
    const cd = f.cd || 'Desconhecido';
    cdVols[cd] = (cdVols[cd] || 0) + (f.annual_weight_kg || 0);
  });

  const sorted = Object.entries(cdVols).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(i => i[0]);
  const data = sorted.map(i => i[1] / 1000); // Em toneladas para ficar legível

  renderBarChart('cdVolumeChart', {
    labels,
    datasets: [{ label: 'Volume (t)', data }],
    title: 'Concentração de Volume por Unidade (t)',
    indexAxis: 'y'
  });
}

export function renderDistanceHistogramChart(flows) {
  if (!flows || flows.length === 0) {
    destroyChart('distanceHistogramChart');
    return;
  }

  const buckets = [0, 0, 0, 0];
  const labels = ['0-100 km', '100-300 km', '300-600 km', '600+ km'];

  flows.forEach(f => {
    const d = f.distance_km || 0;
    if (d <= 100) buckets[0]++;
    else if (d <= 300) buckets[1]++;
    else if (d <= 600) buckets[2]++;
    else buckets[3]++;
  });

  renderBarChart('distanceHistogramChart', {
    labels,
    datasets: [{ label: 'Qtd de Fluxos', data: buckets }],
    title: 'Capilaridade: Perfil de Distâncias',
    indexAxis: 'x'
  });
}
