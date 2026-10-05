import {
  renderBarChart,
  renderDonutChart,
  renderLineChart,
  renderScatterChart,
} from '../../core/chart-renderer.js';
import { escapeHtml, formatBRL, formatPct } from '../view-helpers.js';
import { BRAZIL_MAP } from './brazil-map-data.js';
import { isDistributionFlow } from './overview-analytics.js';

export function renderCostChart(canvasId, result) {
  const costs = result?.costs?.costs || result?.costs || {};
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
  const rows = (sensitivity?.sensitivity_results || [])
    .filter(
      (row) =>
        row.value != null &&
        row.saving_pct != null &&
        Number.isFinite(Number(row.value)) &&
        Number.isFinite(Number(row.saving_pct))
    )
    .slice()
    .sort((a, b) => Number(a.value) - Number(b.value));
  if (!rows.length) return null;
  const variableNames = {
    freight_multiplier: 'Frete',
    demand_multiplier: 'Demanda',
    inventory_days: 'Dias de estoque',
    wacc: 'WACC',
    tax_multiplier: 'Tributo',
  };
  const variable = sensitivity?.most_sensitive_variable || rows[0]?.variable;
  const variableName = variableNames[variable] || variable || 'variável';
  return renderLineChart(canvasId, {
    title: `Sensibilidade · ${variableName}`,
    labels: rows.map((row) => String(row.value)),
    xValues: rows.map((row) => Number(row.value)),
    datasets: [
      { label: 'Saving %', data: rows.map((row) => row.saving_pct), borderColor: '#0f515c' },
    ],
    yFormat: 'percent',
  });
}

function flowVolume(flow) {
  return observedNumber(flow?.annual_weight_kg ?? flow?.weight_kg);
}

function flowDistance(flow) {
  return observedNumber(flow?.distance_km);
}

function observedNumber(value) {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function aggregateDistributionWeightByCd(flows = []) {
  const eligible = flows.filter(isDistributionFlow);
  const byCd = new Map();
  let included = 0;
  eligible.forEach((flow) => {
    const weight = flowVolume(flow);
    if (weight == null || weight <= 0) return;
    const cd = flow?.cd || flow?.assigned_cd || flow?.cd_name || 'CD não informado';
    byCd.set(cd, (byCd.get(cd) || 0) + weight);
    included += 1;
  });
  return {
    rows: [...byCd.entries()].sort((a, b) => b[1] - a[1]),
    eligible: eligible.length,
    included,
  };
}

export function aggregateDistributionDistances(flows = []) {
  const eligible = flows.filter(isDistributionFlow);
  const distances = eligible.map(flowDistance).filter((value) => value > 0);
  const buckets = [0, 0, 0, 0];
  distances.forEach((distance) => {
    if (distance <= 100) buckets[0] += 1;
    else if (distance <= 300) buckets[1] += 1;
    else if (distance <= 600) buckets[2] += 1;
    else buckets[3] += 1;
  });
  return { distances, buckets, eligible: eligible.length };
}

export function renderVolumeByCdChart(canvasId, flows = []) {
  const canvas = document.getElementById(canvasId);
  if (canvas) canvas.hidden = true;
  const aggregate = aggregateDistributionWeightByCd(flows);
  const { rows, eligible, included } = aggregate;
  const summary = document.querySelector(`[data-chart-summary="${canvasId}"]`);
  const caption = document.querySelector(`[data-chart-caption="${canvasId}"]`);
  if (summary)
    summary.textContent = rows.length
      ? `${included}/${eligible} fluxos com peso informado · toneladas`
      : 'Peso em kg não informado';
  if (caption)
    caption.textContent = `Peso explícito em kg, convertido para toneladas. ${included}/${eligible} fluxos de distribuição têm peso positivo; fluxos sem peso não entram.`;
  if (!rows.length) return null;
  if (canvas) canvas.hidden = false;
  renderBarChart(canvasId, {
    labels: rows.map(([label]) => String(label)),
    datasets: [
      {
        label: 'Peso (t)',
        data: rows.map(([, value]) => value / 1000),
        backgroundColor: '#0c7878',
      },
    ],
    title: 'Peso informado por CD (t)',
    indexAxis: 'y',
    xFormat: 'number',
    yFormat: 'number',
  });
}

export function renderDistanceHistogram(canvasId, flows = []) {
  const canvas = document.getElementById(canvasId);
  if (canvas) canvas.hidden = true;
  const aggregate = aggregateDistributionDistances(flows);
  const { distances, buckets, eligible } = aggregate;
  const summary = document.querySelector(`[data-chart-summary="${canvasId}"]`);
  const caption = document.querySelector(`[data-chart-caption="${canvasId}"]`);
  if (summary) summary.textContent = `${distances.length}/${eligible} fluxos com distância`;
  if (caption)
    caption.textContent = `Contagem dos fluxos de distribuição com distância positiva informada: ${distances.length}/${eligible}. Os demais não entram nas faixas.`;
  if (!distances.length) return null;
  if (canvas) canvas.hidden = false;
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
    xValues: points.map((point) => Number(point.percentile)),
    datasets: [{ label, data: points.map((point) => point.value), borderColor: color }],
    title,
    yFormat,
  });
}

export function renderRiskHistogram(canvasId, monteCarlo) {
  const histogram = monteCarlo?.summary?.histogram || [];
  if (!histogram.length) return null;
  const labels = histogram.map((bin) => {
    const bounds = String(bin.label || '').match(/-?\d+(?:[.,]\d+)?/g) || [];
    return bounds.length > 1 ? `${bounds[0]}–${bounds[1]}%` : String(bin.label || '');
  });
  renderBarChart(canvasId, {
    labels,
    datasets: [
      { label: 'Simulações', data: histogram.map((bin) => bin.count), backgroundColor: '#00a189' },
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
  const rows = drivers
    .filter((row) => observedNumber(row.correlation) != null)
    .sort((a, b) => Math.abs(Number(b.correlation)) - Math.abs(Number(a.correlation)))
    .reverse();
  if (!rows.length) return null;
  renderBarChart(canvasId, {
    labels: rows.map((row) => labels[row.driver] || row.driver || 'Driver'),
    datasets: [
      {
        label: 'Correlação com o saving (%)',
        data: rows.map((row) =>
          Number.isFinite(Number(row.correlation)) && row.correlation != null
            ? Number(row.correlation) * 100
            : null
        ),
        backgroundColor: '#0c7878',
      },
    ],
    title: 'Drivers mais influentes',
    indexAxis: 'y',
    xFormat: 'percent',
    yFormat: 'percent',
  });
}

export function renderRiskScatter(canvasId, monteCarlo) {
  const samples = monteCarlo?.samples || [];
  const driver =
    monteCarlo?.summary?.scatter_driver ||
    monteCarlo?.config?.scatter_driver ||
    Object.keys(samples.find((sample) => sample.inputs)?.inputs || {}).find((key) =>
      samples.some((sample) => observedNumber(sample.inputs?.[key]) != null)
    );
  if (!samples.length || !driver) return null;
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
        data: samples
          .filter(
            (sample) =>
              sample.inputs?.[driver] != null &&
              sample.saving_pct != null &&
              Number.isFinite(Number(sample.inputs[driver])) &&
              Number.isFinite(Number(sample.saving_pct))
          )
          .map((sample, index) => ({
            x: Number(sample.inputs[driver]),
            y: Number(sample.saving_pct),
            label: `Simulação ${index + 1}`,
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
  const probability = observedNumber(summary.probability_saving_positive);
  if (probability == null || probability < 0 || probability > 1) return null;
  const positive = probability * 100;
  renderDonutChart(canvasId, {
    labels: ['Saving positivo', 'Sem saving'],
    datasets: [{ data: [positive, 100 - positive], backgroundColor: ['#00a189', '#b42318'] }],
    title: 'Probabilidade de saving positivo',
    yFormat: 'percent',
    isHalf: true,
    centerText: `${positive.toFixed(0)}%`,
  });
}

export function renderRanking(canvasId, optimizer) {
  const rows = (optimizer?.best_scenarios || []).slice(0, 8);
  if (!rows.length) return null;
  return renderBarChart(canvasId, {
    title: `Ranking · ${rows.length} de ${optimizer.best_scenarios.length} cenários`,
    labels: rows.map((row) => row.scenario_id),
    datasets: [
      { label: 'Score', data: rows.map((row) => row.final_score), backgroundColor: '#00a189' },
    ],
    yFormat: 'number',
    indexAxis: 'y',
  });
}

export function renderNetworkSvg(flows = []) {
  const limited = flows.filter((flow) => flow && typeof flow === 'object').slice(0, 12);
  const origins = [...new Set(limited.map((flow) => flow.origin).filter(Boolean))];
  const cds = [...new Set(limited.map((flow) => flow.cd).filter(Boolean))];
  const destinations = [...new Set(limited.map((flow) => flow.destination).filter(Boolean))];
  const height = Math.max(370, Math.max(origins.length, cds.length, destinations.length) * 48 + 70);
  const y = (index, count) => 40 + index * ((height - 100) / Math.max(1, count - 1));
  const node = (x, labels, role, field, className) =>
    labels
      .map((label, index) => {
        const count = limited.filter((flow) => flow[field] === label).length;
        const description = `${label}: ${count} registro(s) no recorte exibido`;
        return `<g data-network-node="${role}${index}" data-network-detail="${escapeHtml(description)}" tabindex="0" role="button" aria-label="${escapeHtml(description)}"><title>${escapeHtml(description)}</title><circle cx="${x}" cy="${y(index, labels.length)}" r="16" class="${className}"/><text x="${x}" y="${y(index, labels.length) + 30}" text-anchor="middle">${escapeHtml(String(label).slice(0, 20))}</text></g>`;
      })
      .join('');
  const edges = limited
    .map((flow) => {
      const oi = origins.indexOf(flow.origin),
        ci = cds.indexOf(flow.cd),
        di = destinations.indexOf(flow.destination);
      const inbound =
        oi >= 0 && ci >= 0
          ? `<path data-network-edge="o${oi} c${ci}" d="M 116 ${y(oi, origins.length)} C 185 ${y(oi, origins.length)}, 225 ${y(ci, cds.length)}, 299 ${y(ci, cds.length)}"/>`
          : '';
      const outbound =
        ci >= 0 && di >= 0
          ? `<path data-network-edge="c${ci} d${di}" d="M 331 ${y(ci, cds.length)} C 410 ${y(ci, cds.length)}, 465 ${y(di, destinations.length)}, 549 ${y(di, destinations.length)}"/>`
          : '';
      return inbound + outbound;
    })
    .join('');
  return `<svg class="ni-network-svg" viewBox="0 0 680 ${height}" role="group" aria-label="Topologia dos ${limited.length} registros de fluxo exibidos"><g class="ni-network-edges">${edges}</g><g>${node(100, origins, 'o', 'origin', 'origin')}${node(315, cds, 'c', 'cd', 'cd')}${node(565, destinations, 'd', 'destination', 'destination')}</g></svg><p class="ni-network-detail ni-note" role="status">Topologia dos primeiros ${limited.length}/${flows.length} registros. Selecione um nó para destacar suas ligações; posições são esquemáticas.</p>`;
}

const MAP_BOUNDS = Object.freeze({ west: -74, east: -34, north: 6.5, south: -34 });

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
  const valid = new Set(
    BRAZIL_MAP.features.map((feature) => feature.properties?.sigla || feature.properties?.uf)
  );
  const candidates = [flow?.destination_uf, flow?.destinationUf, flow?.uf, flow?.state];
  return (
    candidates
      .filter((value) => typeof value === 'string')
      .map((value) => value.trim().toUpperCase())
      .find((value) => valid.has(value)) || null
  );
}

export function mapMetrics(flows = []) {
  const metrics = new Map();
  flows.forEach((flow) => {
    const uf = flowUF(flow);
    if (uf) metrics.set(uf, (metrics.get(uf) || 0) + 1);
  });
  return { metrics, covered: [...metrics.values()].reduce((sum, value) => sum + value, 0) };
}

export function renderBrazilMap(flows = []) {
  const { metrics, covered } = mapMetrics(flows);
  const maxValue = Math.max(...metrics.values(), 1);
  const features = BRAZIL_MAP.features
    .map((feature) => {
      const uf = feature.properties?.sigla || feature.properties?.uf || '';
      const value = metrics.get(uf) || 0;
      const intensity = value ? 0.24 + (value / maxValue) * 0.68 : 0.08;
      const description = `${feature.properties?.name || uf}: ${value} fluxo(s) com UF de destino identificada`;
      return `<path class="ni-map-state" data-uf="${escapeHtml(uf)}" data-map-detail="${escapeHtml(description)}" d="${geometryPath(feature.geometry)}" fill="rgba(0,161,137,${intensity.toFixed(2)})" tabindex="0" role="button" aria-label="${escapeHtml(description)}"><title>${escapeHtml(description)}</title></path>`;
    })
    .join('');
  const rows = [...metrics.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([uf, count]) => `<tr><th scope="row">${escapeHtml(uf)}</th><td>${count}</td></tr>`)
    .join('');
  return `<div class="ni-brazil-map" data-testid="brazil-map"><div class="ni-brazil-map-heading"><div><p class="ni-eyebrow">Geografia da rede</p><h2>Brasil · destinos dos fluxos</h2></div><span class="ni-map-status">${covered}/${flows.length} fluxos com UF</span></div><svg viewBox="0 0 520 500" role="group" aria-label="Mapa do Brasil: quantidade de fluxos por UF de destino"><g class="ni-map-states">${features}</g></svg><div class="ni-map-detail" role="status" aria-live="polite">Passe sobre um estado ou use Tab para consultar seus fluxos.</div><div class="ni-map-footnote">Intensidade representa contagem de fluxos por destino, não volume ou demanda. ${flows.length - covered} fluxo(s) sem UF válida. ${covered ? '' : 'Não há dados de UF para colorir o mapa.'}</div><details class="vg-chart-data"><summary>Ver dados por UF</summary><table><thead><tr><th>UF de destino</th><th>Fluxos</th></tr></thead><tbody>${rows}</tbody></table></details></div>`;
}

export function bindMapInteraction(root) {
  root.querySelectorAll('[data-network-node]').forEach((node) => {
    const show = () => {
      const svg = node.closest('svg');
      svg.querySelectorAll('[data-network-edge]').forEach((edge) => {
        const connected = edge.dataset.networkEdge.split(' ').includes(node.dataset.networkNode);
        edge.classList.toggle('is-highlighted', connected);
        edge.classList.toggle('is-dimmed', !connected);
      });
      const detail = svg.parentElement.querySelector('.ni-network-detail');
      if (detail) detail.textContent = node.dataset.networkDetail;
    };
    node.addEventListener('pointerenter', show);
    node.addEventListener('focus', show);
    node.addEventListener('click', show);
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        show();
      }
    });
  });
  root.querySelectorAll('[data-map-detail]').forEach((node) => {
    const show = () => {
      const detail = node.closest('.ni-brazil-map')?.querySelector('.ni-map-detail');
      if (detail) detail.textContent = node.dataset.mapDetail;
    };
    node.addEventListener('pointerenter', show);
    node.addEventListener('focus', show);
    node.addEventListener('click', show);
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        show();
      }
    });
  });
}

export function renderChartFallback(label, value) {
  return `<div class="ni-chart-fallback"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value == null ? '—' : formatPct(value))}</span></div>`;
}

export { formatBRL };
