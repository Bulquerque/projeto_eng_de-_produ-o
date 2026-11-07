import {
  renderLineChart,
  renderBarChart,
  renderDonutChart,
  destroyChart,
} from '../core/chart-renderer.js';

export function usablePhase5ChartRows(results) {
  return (results || []).filter(
    (result) =>
      result?.status !== 'blocked' &&
      !['error', 'invalid'].includes(result?.simulation_status) &&
      Number.isFinite(result?.saving_pct) &&
      Number.isFinite(result?.total_with_tax)
  );
}

export function renderSensitivityChart(sensitivityResults) {
  const usableResults = usablePhase5ChartRows(sensitivityResults);
  if (usableResults.length === 0) {
    destroyChart('sensitivityChart');
    return;
  }

  const labels = usableResults.map((r) => String(r.value));
  const data = usableResults.map((r) => r.saving_pct);

  renderLineChart('sensitivityChart', {
    labels,
    datasets: [
      {
        label: 'Saving vs Baseline (%)',
        data,
        borderColor: '#00A189',
        backgroundColor: '#00A189',
      },
    ],
    title: 'Análise de Sensibilidade',
    yFormat: 'percent',
  });
}

export function renderStressChart(stressResults) {
  const usableResults = usablePhase5ChartRows(stressResults);
  if (usableResults.length === 0) {
    destroyChart('stressChart');
    return;
  }

  const labels = usableResults.map((r) => r.case_name);
  const data = usableResults.map((r) => r.saving_pct);

  // Green if scenario_still_better_than_baseline is true, Red otherwise
  const backgroundColors = usableResults.map((r) =>
    r.scenario_still_better_than_baseline ? '#00A189' : '#b42318'
  );

  renderBarChart('stressChart', {
    labels,
    datasets: [
      {
        label: 'Saving vs Baseline (%)',
        data,
        backgroundColor: backgroundColors,
      },
    ],
    title: 'Stress Test: Impacto nos Savings',
    indexAxis: 'y',
    xFormat: 'percent',
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
  if (value < 40)
    color = '#b42318'; // red
  else if (value < 70) color = '#92400e'; // warn/yellow

  renderDonutChart('robustnessChart', {
    labels: ['Score de robustez', 'Complemento do score'],
    datasets: [
      {
        data: [value, remaining],
        backgroundColor: [color, '#e6e2e5'],
      },
    ],
    title: `Robustness Score: ${value}/100`,
    isHalf: true,
  });
}
