import { renderLineChart, renderBarChart, renderDonutChart, destroyChart } from '../shared/chart-renderer.js';

export function renderSensitivityChart(sensitivityResults) {
  if (!sensitivityResults || sensitivityResults.length === 0) {
    destroyChart('sensitivityChart');
    return;
  }

  const labels = sensitivityResults.map(r => String(r.value));
  const data = sensitivityResults.map(r => r.saving_pct);

  renderLineChart('sensitivityChart', {
    labels,
    datasets: [{
      label: 'Saving vs Baseline (%)',
      data,
      borderColor: '#00A189',
      backgroundColor: '#00A189'
    }],
    title: 'Análise de Sensibilidade',
    yFormat: 'percent'
  });
}

export function renderStressChart(stressResults) {
  if (!stressResults || stressResults.length === 0) {
    destroyChart('stressChart');
    return;
  }

  const labels = stressResults.map(r => r.case_name);
  const data = stressResults.map(r => r.saving_pct);
  
  // Green if scenario_still_better_than_baseline is true, Red otherwise
  const backgroundColors = stressResults.map(r => 
    r.scenario_still_better_than_baseline ? '#00A189' : '#b42318'
  );

  renderBarChart('stressChart', {
    labels,
    datasets: [{
      label: 'Saving vs Baseline (%)',
      data,
      backgroundColor: backgroundColors
    }],
    title: 'Stress Test: Impacto nos Savings',
    indexAxis: 'y',
    xFormat: 'percent'
  });
}

export function renderRobustnessChart(robustnessScore) {
  if (typeof robustnessScore !== 'number') {
    destroyChart('robustnessChart');
    return;
  }

  const value = Math.round(robustnessScore);
  const remaining = 100 - value;

  let color = '#00A189'; // green >= 70
  if (value < 40) color = '#b42318'; // red
  else if (value < 70) color = '#92400e'; // warn/yellow

  renderDonutChart('robustnessChart', {
    labels: ['Robustez', 'Risco'],
    datasets: [{
      data: [value, remaining],
      backgroundColor: [color, '#e6e2e5']
    }],
    title: `Robustness Score: ${value}/100`,
    isHalf: true
  });
}
