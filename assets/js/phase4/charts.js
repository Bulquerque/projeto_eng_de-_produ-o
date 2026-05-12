import { renderScatterChart, renderBarChart, destroyChart } from '../shared/chart-renderer.js';

export function renderTradeoffChart(frontierResult) {
  if (!frontierResult || !frontierResult.frontier_points || frontierResult.frontier_points.length === 0) {
    destroyChart('tradeoffChart');
    return;
  }

  const points = frontierResult.frontier_points;
  
  // Separate into frontier and dominated for different colors
  const frontierData = points.filter(p => p.is_frontier_candidate).map(p => ({
    x: p.x_total_cost,
    y: p.y_quality_score,
    label: `${p.scenario_name} (Risk: ${p.risk_level})`
  }));
  
  const dominatedData = points.filter(p => !p.is_frontier_candidate).map(p => ({
    x: p.x_total_cost,
    y: p.y_quality_score,
    label: `${p.scenario_name} (Risk: ${p.risk_level})`
  }));

  const datasets = [
    {
      label: 'Fronteira Eficiente',
      data: frontierData,
      backgroundColor: '#00A189', // --vg-green
      pointRadius: 6,
      pointHoverRadius: 8
    },
    {
      label: 'Dominados',
      data: dominatedData,
      backgroundColor: '#CCC9CA', // --vg-soft
      pointRadius: 4,
      pointHoverRadius: 6
    }
  ];

  renderScatterChart('tradeoffChart', {
    datasets,
    xLabel: 'Custo Total',
    yLabel: 'Qualidade (Score)',
    title: 'Trade-off Custo vs Qualidade',
    xFormat: 'money'
  });
}

export function renderRankingChart(bestScenarios) {
  if (!bestScenarios || bestScenarios.length === 0) {
    destroyChart('rankingChart');
    return;
  }

  const topScenarios = bestScenarios.slice(0, 8);
  const labels = topScenarios.map(s => s.scenario_name);
  const data = topScenarios.map(s => s.final_score * 100);

  renderBarChart('rankingChart', {
    labels,
    datasets: [{
      label: 'Score Final (%)',
      data,
      backgroundColor: '#00A189'
    }],
    title: 'Top Cenários',
    indexAxis: 'y',
    xFormat: 'percent'
  });
}
