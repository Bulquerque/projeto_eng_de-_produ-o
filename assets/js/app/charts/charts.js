import { renderBarChart, renderLineChart } from '../../core/chart-renderer.js';
import { escapeHtml, formatBRL, formatPct } from '../view-helpers.js';

export function renderCostChart(canvasId, result) {
  const costs = result?.costs || {};
  return renderBarChart(canvasId, {
    title: 'Composição do custo',
    labels: ['Transferência', 'Distribuição', 'Armazenagem', 'Estoque', 'Tributos'],
    datasets: [
      {
        label: 'R$',
        data: [
          costs.transfer_cost,
          costs.distribution_cost,
          costs.storage_cost,
          costs.inventory_cost,
          costs.tax_impact,
        ],
        backgroundColor: '#0c7878',
      },
    ],
    yFormat: 'money',
  });
}

export function renderRiskChart(canvasId, monteCarlo) {
  const summary = monteCarlo?.summary;
  if (!summary) return null;
  return renderLineChart(canvasId, {
    title: 'Faixa de incerteza',
    labels: ['p10', 'mediana', 'p90'],
    datasets: [
      {
        label: 'Saving %',
        data: [summary.p10_saving_pct, summary.median_saving_pct, summary.p90_saving_pct],
        borderColor: '#00a189',
      },
    ],
    yFormat: 'percent',
  });
}

export function renderSensitivity(canvasId, sensitivity) {
  const rows = sensitivity?.sensitivity_results || [];
  if (!rows.length) return null;
  return renderLineChart(canvasId, {
    title: 'Sensibilidade',
    labels: rows.map((row) => String(row.value)),
    datasets: [
      { label: 'Saving %', data: rows.map((row) => row.saving_pct), borderColor: '#0f515c' },
    ],
    yFormat: 'percent',
  });
}

export function renderRanking(canvasId, optimizer) {
  const rows = (optimizer?.best_scenarios || []).slice(0, 8);
  if (!rows.length) return null;
  return renderBarChart(canvasId, {
    title: 'Ranking',
    labels: rows.map((row) => row.scenario_id),
    datasets: [
      { label: 'Score', data: rows.map((row) => row.final_score), backgroundColor: '#00a189' },
    ],
    yFormat: 'number',
    indexAxis: 'y',
  });
}

export function renderNetworkSvg(flows = []) {
  const limited = flows.slice(0, 12);
  const origins = [...new Set(limited.map((flow) => flow.origin).filter(Boolean))].slice(0, 4);
  const cds = [...new Set(limited.map((flow) => flow.cd).filter(Boolean))].slice(0, 4);
  const destinations = [...new Set(limited.map((flow) => flow.destination).filter(Boolean))].slice(
    0,
    6
  );
  const node = (x, y, label, className) =>
    `<g><circle cx="${x}" cy="${y}" r="18" class="${className}"/><text x="${x}" y="${y + 34}" text-anchor="middle">${escapeHtml(String(label).slice(0, 18))}</text></g>`;
  const edges = limited
    .map((flow) => {
      const originIndex = Math.max(0, origins.indexOf(flow.origin));
      const cdIndex = Math.max(0, cds.indexOf(flow.cd));
      const destinationIndex = Math.max(0, destinations.indexOf(flow.destination));
      const y1 = 52 + originIndex * 75;
      const y2 = 52 + cdIndex * 75;
      const y3 = 52 + destinationIndex * 58;
      return `<path d="M 105 ${y1} C 185 ${y1}, 225 ${y2}, 295 ${y2}"/><path d="M 335 ${y2} C 410 ${y2}, 465 ${y3}, 565 ${y3}" opacity="0.55"/>`;
    })
    .join('');
  return `<svg class="ni-network-svg" viewBox="0 0 680 370" role="img" aria-label="Visão topológica resumida dos fluxos"><g class="ni-network-edges">${edges}</g><g>${origins.map((label, index) => node(105, 52 + index * 75, label, 'origin')).join('')}</g><g>${cds.map((label, index) => node(315, 52 + index * 75, label, 'cd')).join('')}</g><g>${destinations.map((label, index) => node(565, 52 + index * 58, label, 'destination')).join('')}</g></svg>`;
}

export function renderChartFallback(label, value) {
  return `<div class="ni-chart-fallback"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value == null ? '—' : formatPct(value))}</span></div>`;
}

export { formatBRL };
