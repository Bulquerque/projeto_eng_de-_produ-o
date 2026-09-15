import {
  renderBarChart,
  renderDonutChart,
  renderLineChart,
  renderScatterChart,
} from '../../core/chart-renderer.js';
import { escapeHtml, formatBRL, formatPct } from '../view-helpers.js';
import { BRAZIL_MAP } from './brazil-map-data.js';

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

function flowVolume(flow) {
  return (
    Number(flow?.annual_weight_kg ?? flow?.weight_kg ?? flow?.volume ?? flow?.demand ?? 0) || 0
  );
}

function flowDistance(flow) {
  return Number(flow?.distance_km ?? flow?.distance ?? 0) || 0;
}

export function renderVolumeByCdChart(canvasId, flows = []) {
  if (!flows.length) return null;
  const byCd = new Map();
  flows.forEach((flow) => {
    const cd = flow?.cd || flow?.assigned_cd || flow?.cd_name || 'CD não informado';
    byCd.set(cd, (byCd.get(cd) || 0) + flowVolume(flow));
  });
  const rows = [...byCd.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (!rows.length || !rows.some(([, value]) => value > 0)) return null;
  renderBarChart(canvasId, {
    labels: rows.map(([label]) => String(label).slice(0, 18)),
    datasets: [
      {
        label: 'Volume (t)',
        data: rows.map(([, value]) => value / 1000),
        backgroundColor: '#0c7878',
      },
    ],
    title: 'Concentração de volume por CD',
    indexAxis: 'y',
    yFormat: 'number',
  });
}

export function renderDistanceHistogram(canvasId, flows = []) {
  const distances = flows.map(flowDistance).filter((value) => value > 0);
  if (!distances.length) return null;
  const buckets = [0, 0, 0, 0];
  distances.forEach((distance) => {
    if (distance <= 100) buckets[0] += 1;
    else if (distance <= 300) buckets[1] += 1;
    else if (distance <= 600) buckets[2] += 1;
    else buckets[3] += 1;
  });
  renderBarChart(canvasId, {
    labels: ['0–100 km', '100–300 km', '300–600 km', '600+ km'],
    datasets: [{ label: 'Fluxos', data: buckets, backgroundColor: '#00a189' }],
    title: 'Perfil de distâncias da rede',
    yFormat: 'number',
  });
}

function renderRiskSeries(canvasId, title, label, points, yFormat = 'percent', color = '#0c7878') {
  if (!points?.length) return null;
  renderLineChart(canvasId, {
    labels: points.map((point) => `P${point.percentile}`),
    datasets: [{ label, data: points.map((point) => point.value), borderColor: color }],
    title,
    yFormat,
  });
}

export function renderRiskHistogram(canvasId, monteCarlo) {
  const histogram = monteCarlo?.summary?.histogram || [];
  if (!histogram.length) return null;
  renderBarChart(canvasId, {
    labels: histogram.map((bin) => bin.label),
    datasets: [
      { label: 'Frequência', data: histogram.map((bin) => bin.count), backgroundColor: '#00a189' },
    ],
    title: 'Distribuição de saving',
    yFormat: 'number',
  });
}

export function renderRiskCdf(canvasId, monteCarlo) {
  return renderRiskSeries(
    canvasId,
    'Curva percentílica do saving',
    'Saving (%)',
    monteCarlo?.summary?.percentile_curve,
    'percent',
    '#0c7878'
  );
}

export function renderRiskTotalCurve(canvasId, monteCarlo) {
  return renderRiskSeries(
    canvasId,
    'Curva percentílica do custo total',
    'Total com tributo',
    monteCarlo?.summary?.total_percentile_curve,
    'money',
    '#00363d'
  );
}

export function renderRiskDrivers(canvasId, monteCarlo) {
  const drivers = monteCarlo?.summary?.driver_importance || [];
  if (!drivers.length) return null;
  const labels = {
    freight_multiplier: 'Frete',
    demand_multiplier: 'Demanda',
    inventory_days: 'Dias de estoque',
    wacc: 'WACC',
    tax_multiplier: 'Tributo',
  };
  const rows = [...drivers]
    .sort((a, b) => Math.abs(Number(b.correlation) || 0) - Math.abs(Number(a.correlation) || 0))
    .slice(0, 6)
    .reverse();
  renderBarChart(canvasId, {
    labels: rows.map((row) => labels[row.driver] || row.driver || 'Driver'),
    datasets: [
      {
        label: 'Correlação absoluta (%)',
        data: rows.map((row) => Math.abs(Number(row.correlation) || 0) * 100),
        backgroundColor: '#0c7878',
      },
    ],
    title: 'Drivers mais influentes',
    indexAxis: 'y',
    yFormat: 'percent',
  });
}

export function renderRiskScatter(canvasId, monteCarlo) {
  const samples = monteCarlo?.samples || [];
  const driver = monteCarlo?.summary?.scatter_driver || 'freight_multiplier';
  if (!samples.length) return null;
  const labels = {
    freight_multiplier: 'Frete',
    demand_multiplier: 'Demanda',
    inventory_days: 'Dias de estoque',
    wacc: 'WACC',
    tax_multiplier: 'Tributo',
  };
  renderScatterChart(canvasId, {
    datasets: [
      {
        label: labels[driver] || driver,
        data: samples.slice(0, 500).map((sample) => ({
          x: Number(sample.inputs?.[driver]) || 0,
          y: Number(sample.saving_pct) || 0,
        })),
        borderColor: '#92400e',
        backgroundColor: '#92400e',
      },
    ],
    xLabel: labels[driver] || driver,
    yLabel: 'Saving (%)',
    title: 'Driver × saving',
    xFormat: 'number',
    yFormat: 'percent',
  });
}

export function renderRiskProbability(canvasId, monteCarlo) {
  const summary = monteCarlo?.summary;
  if (!summary || summary.probability_saving_positive == null) return null;
  const positive = Math.max(0, Math.min(100, Number(summary.probability_saving_positive) * 100));
  renderDonutChart(canvasId, {
    labels: ['Saving positivo', 'Sem saving'],
    datasets: [{ data: [positive, 100 - positive], backgroundColor: ['#00a189', '#b42318'] }],
    title: 'Probabilidade de saving positivo',
    isHalf: true,
    centerText: `${positive.toFixed(0)}%`,
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

const MAP_BOUNDS = Object.freeze({ west: -74, east: -34, north: 6.5, south: -34 });
const DEMO_UFS = ['SP', 'MG', 'PR', 'BA', 'PE'];

function projectMapPoint([longitude, latitude]) {
  const x = ((longitude - MAP_BOUNDS.west) / (MAP_BOUNDS.east - MAP_BOUNDS.west)) * 520;
  const y = ((MAP_BOUNDS.north - latitude) / (MAP_BOUNDS.north - MAP_BOUNDS.south)) * 500;
  return [x.toFixed(2), y.toFixed(2)];
}

function ringPath(ring) {
  return ring
    .map((point, index) => {
      const [x, y] = projectMapPoint(point);
      return `${index ? 'L' : 'M'}${x} ${y}`;
    })
    .join(' ')
    .concat(' Z');
}

function geometryPath(geometry) {
  if (!geometry) return '';
  if (geometry.type === 'Polygon') return geometry.coordinates.map(ringPath).join(' ');
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flatMap((polygon) => polygon.map(ringPath)).join(' ');
  }
  return '';
}

function flowUF(flow) {
  const candidates = [
    flow?.uf,
    flow?.state,
    flow?.origin_uf,
    flow?.originUf,
    flow?.destination_uf,
    flow?.destinationUf,
  ];
  const candidate = candidates.find((value) => typeof value === 'string' && value.trim());
  return candidate ? candidate.trim().toUpperCase().slice(0, 2) : null;
}

function mapMetrics(flows = []) {
  const metrics = new Map();
  const explicit = flows.some((flow) => flowUF(flow));
  flows.forEach((flow, index) => {
    const uf = flowUF(flow) || (explicit ? null : DEMO_UFS[index % DEMO_UFS.length]);
    if (!uf) return;
    const value = Number(flow.volume ?? flow.demand ?? flow.value ?? 1);
    metrics.set(uf, (metrics.get(uf) || 0) + (Number.isFinite(value) ? value : 1));
  });
  return { explicit, metrics };
}

export function renderBrazilMap(flows = []) {
  const { explicit, metrics } = mapMetrics(flows);
  const maxValue = Math.max(...metrics.values(), 1);
  const features = BRAZIL_MAP.features
    .map((feature) => {
      const uf = feature.properties?.sigla || feature.properties?.uf || '';
      const value = metrics.get(uf) || 0;
      const intensity = value ? 0.24 + (value / maxValue) * 0.68 : 0.08;
      const path = geometryPath(feature.geometry);
      return `<path class="ni-map-state" data-uf="${escapeHtml(uf)}" d="${path}" fill="rgba(0,161,137,${intensity.toFixed(2)})" tabindex="0" role="img" aria-label="${escapeHtml(feature.properties?.name || uf)}: ${value ? `${value} unidades` : 'sem fluxo no recorte'}"><title>${escapeHtml(feature.properties?.name || uf)} · ${value ? `${value} unidades` : 'sem fluxo no recorte'}</title></path>`;
    })
    .join('');
  const dataLabel = explicit ? 'Dados por UF do provider' : 'Cobertura demonstrativa por fluxo';
  return `<div class="ni-brazil-map" data-testid="brazil-map"><div class="ni-brazil-map-heading"><div><p class="ni-eyebrow">Geografia da rede</p><h2>Brasil · cobertura de fluxos</h2></div><span class="ni-map-status">${escapeHtml(dataLabel)}</span></div><svg viewBox="0 0 520 500" role="img" aria-label="Mapa do Brasil com intensidade de fluxos por estado"><g class="ni-map-states">${features}</g></svg><div class="ni-map-footnote">${explicit ? 'Intensidade calculada a partir das UFs disponíveis no bundle.' : 'A fixture atual não informa UF; a distribuição é apenas demonstrativa e não representa demanda observada.'}</div></div>`;
}

export function renderChartFallback(label, value) {
  return `<div class="ni-chart-fallback"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value == null ? '—' : formatPct(value))}</span></div>`;
}

export { formatBRL };
