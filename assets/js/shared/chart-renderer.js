const _instances = new Map();

export const VG_PALETTE = [
  '#00A189',
  '#A9FDAC',
  '#0C7878',
  '#0F515C',
  '#b42318',
  '#92400e',
  '#00363D'
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getCanvas(canvasId) {
  return document.getElementById(canvasId);
}

function getContext(canvas) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width || canvas.clientWidth || 320));
  const height = Math.max(220, Math.floor(rect.height || canvas.clientHeight || 220));
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

function clearCanvas(canvasId) {
  const canvas = getCanvas(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function destroyChart(canvasId) {
  if (_instances.has(canvasId)) {
    const instance = _instances.get(canvasId);
    if (instance?.destroy) instance.destroy();
    _instances.delete(canvasId);
  }
  clearCanvas(canvasId);
}

function text(ctx, value, x, y, { size = 12, weight = '400', color = '#526b70', align = 'left', baseline = 'alphabetic' } = {}) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px Inter, system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(String(value), x, y);
  ctx.restore();
}

function drawFrame(ctx, width, height, title) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#d8e1e3';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
  if (title) text(ctx, title, 16, 18, { size: 14, weight: '700', color: '#00363D' });
}

function drawLegend(ctx, items, width, height) {
  const baseY = height - 18;
  let x = 16;
  ctx.save();
  ctx.font = '12px Inter, system-ui, sans-serif';
  for (const item of items) {
    ctx.fillStyle = item.color;
    ctx.fillRect(x, baseY - 9, 10, 10);
    ctx.fillStyle = '#526b70';
    ctx.fillText(item.label, x + 14, baseY);
    x += ctx.measureText(item.label).width + 32;
  }
  ctx.restore();
}

function niceMax(value) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / exponent;
  const rounded = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return rounded * exponent;
}

function formatValue(value, mode) {
  if (mode === 'money') return `R$ ${Number(value || 0).toLocaleString('pt-BR')}`;
  if (mode === 'percent') return `${Number(value || 0).toFixed(0)}%`;
  if (Number.isInteger(value)) return String(value);
  return Number(value || 0).toFixed(1);
}

function renderBarChart(canvasId, { labels = [], datasets = [], title, yFormat, xFormat, indexAxis = 'x' }) {
  destroyChart(canvasId);
  const canvas = getCanvas(canvasId);
  if (!canvas) return null;
  const { ctx, width, height } = getContext(canvas);
  drawFrame(ctx, width, height, title);

  const pad = { top: title ? 30 : 14, right: 20, bottom: 42, left: 50 };
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;
  const values = datasets.flatMap((ds) => (ds.data || []).map((v) => Number(v) || 0));
  const maxValue = niceMax(Math.max(1, ...values));
  const seriesCount = Math.max(1, datasets.length);
  const labelCount = Math.max(1, labels.length);

  ctx.save();
  ctx.strokeStyle = '#d8e1e3';
  ctx.fillStyle = '#526b70';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, pad.top + chartHeight);
  ctx.lineTo(pad.left + chartWidth, pad.top + chartHeight);
  ctx.stroke();

  const ticks = 4;
  for (let i = 0; i <= ticks; i += 1) {
    const y = pad.top + chartHeight - (chartHeight / ticks) * i;
    const value = (maxValue / ticks) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left - 4, y);
    ctx.lineTo(pad.left + chartWidth, y);
    ctx.strokeStyle = i === 0 ? '#b9c7ca' : '#edf1f2';
    ctx.stroke();
    text(ctx, formatValue(value, yFormat), pad.left - 8, y, { size: 11, align: 'right', baseline: 'middle' });
  }

  if (indexAxis === 'y') {
    const band = chartHeight / labelCount;
    const barHeight = Math.min(24, band * 0.6);
    labels.forEach((label, index) => {
      const y = pad.top + band * index + band / 2 - barHeight / 2;
      text(ctx, label, pad.left - 8, y + barHeight / 2 + 4, { size: 11, align: 'right' });
      datasets.forEach((dataset, dsIndex) => {
        const data = Number(dataset.data?.[index] || 0);
        const barWidth = (data / maxValue) * chartWidth;
        const x = pad.left;
        const color = dataset.backgroundColor || VG_PALETTE[dsIndex % VG_PALETTE.length];
        ctx.fillStyle = color;
        ctx.fillRect(x, y, Math.max(1, barWidth), barHeight / seriesCount);
      });
    });
  } else {
    const band = chartWidth / labelCount;
    const groupWidth = Math.min(band * 0.8, 64);
    const barWidth = groupWidth / seriesCount;
    labels.forEach((label, index) => {
      const groupX = pad.left + band * index + (band - groupWidth) / 2;
      text(ctx, label, groupX + groupWidth / 2, pad.top + chartHeight + 16, { size: 11, align: 'center' });
      datasets.forEach((dataset, dsIndex) => {
        const data = Number(dataset.data?.[index] || 0);
        const barHeight = (data / maxValue) * chartHeight;
        const x = groupX + dsIndex * barWidth;
        const y = pad.top + chartHeight - barHeight;
        const color = dataset.backgroundColor || VG_PALETTE[dsIndex % VG_PALETTE.length];
        ctx.fillStyle = color;
        ctx.fillRect(x + 1, y, Math.max(1, barWidth - 2), Math.max(1, barHeight));
      });
    });
  }

  const legendItems = datasets.map((dataset, index) => ({
    label: dataset.label || `Série ${index + 1}`,
    color: dataset.backgroundColor || VG_PALETTE[index % VG_PALETTE.length]
  }));
  drawLegend(ctx, legendItems, width, height);
  ctx.restore();

  const instance = { destroy() { clearCanvas(canvasId); } };
  _instances.set(canvasId, instance);
  return instance;
}

function renderLineChart(canvasId, { labels = [], datasets = [], title, yFormat }) {
  destroyChart(canvasId);
  const canvas = getCanvas(canvasId);
  if (!canvas) return null;
  const { ctx, width, height } = getContext(canvas);
  drawFrame(ctx, width, height, title);

  const pad = { top: title ? 30 : 14, right: 20, bottom: 42, left: 50 };
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;
  const values = datasets.flatMap((ds) => (ds.data || []).map((v) => Number(v) || 0));
  const maxValue = niceMax(Math.max(1, ...values));
  const points = Math.max(2, labels.length);

  ctx.save();
  ctx.strokeStyle = '#d8e1e3';
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, pad.top + chartHeight);
  ctx.lineTo(pad.left + chartWidth, pad.top + chartHeight);
  ctx.stroke();

  const ticks = 4;
  for (let i = 0; i <= ticks; i += 1) {
    const y = pad.top + chartHeight - (chartHeight / ticks) * i;
    const value = (maxValue / ticks) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + chartWidth, y);
    ctx.strokeStyle = i === 0 ? '#b9c7ca' : '#edf1f2';
    ctx.stroke();
    text(ctx, formatValue(value, yFormat), pad.left - 8, y, { size: 11, align: 'right', baseline: 'middle' });
  }

  labels.forEach((label, index) => {
    const x = pad.left + (chartWidth / (points - 1)) * index;
    text(ctx, label, x, pad.top + chartHeight + 16, { size: 11, align: 'center' });
  });

  datasets.forEach((dataset, dsIndex) => {
    const color = dataset.borderColor || dataset.backgroundColor || VG_PALETTE[dsIndex % VG_PALETTE.length];
    const data = (dataset.data || []).map((v) => Number(v) || 0);
    if (!data.length) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((value, index) => {
      const x = pad.left + (chartWidth / (points - 1)) * index;
      const y = pad.top + chartHeight - (value / maxValue) * chartHeight;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    data.forEach((value, index) => {
      const x = pad.left + (chartWidth / (points - 1)) * index;
      const y = pad.top + chartHeight - (value / maxValue) * chartHeight;
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  });

  const legendItems = datasets.map((dataset, index) => ({
    label: dataset.label || `Série ${index + 1}`,
    color: dataset.borderColor || dataset.backgroundColor || VG_PALETTE[index % VG_PALETTE.length]
  }));
  drawLegend(ctx, legendItems, width, height);
  ctx.restore();

  const instance = { destroy() { clearCanvas(canvasId); } };
  _instances.set(canvasId, instance);
  return instance;
}

function renderScatterChart(canvasId, { datasets = [], xLabel, yLabel, title, xFormat, yFormat }) {
  destroyChart(canvasId);
  const canvas = getCanvas(canvasId);
  if (!canvas) return null;
  const { ctx, width, height } = getContext(canvas);
  drawFrame(ctx, width, height, title);

  const pad = { top: title ? 30 : 14, right: 20, bottom: 42, left: 60 };
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;
  const points = datasets.flatMap((ds) => (ds.data || []).map((p) => ({ ...p, color: ds.borderColor || ds.backgroundColor || VG_PALETTE[0], label: ds.label })));
  if (!points.length) return null;
  const maxX = niceMax(Math.max(...points.map((p) => Number(p.x) || 0), 1));
  const maxY = niceMax(Math.max(...points.map((p) => Number(p.y) || 0), 1));

  ctx.save();
  ctx.strokeStyle = '#d8e1e3';
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, pad.top + chartHeight);
  ctx.lineTo(pad.left + chartWidth, pad.top + chartHeight);
  ctx.stroke();

  points.forEach((point) => {
    const x = pad.left + ((Number(point.x) || 0) / maxX) * chartWidth;
    const y = pad.top + chartHeight - ((Number(point.y) || 0) / maxY) * chartHeight;
    ctx.fillStyle = point.color;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  text(ctx, xLabel || '', pad.left + chartWidth / 2, height - 12, { size: 11, align: 'center' });
  text(ctx, yLabel || '', 12, pad.top + chartHeight / 2, { size: 11, align: 'center' });
  drawLegend(ctx, datasets.map((dataset, index) => ({
    label: dataset.label || `Série ${index + 1}`,
    color: dataset.borderColor || dataset.backgroundColor || VG_PALETTE[index % VG_PALETTE.length]
  })), width, height);
  ctx.restore();

  const instance = { destroy() { clearCanvas(canvasId); } };
  _instances.set(canvasId, instance);
  return instance;
}

function renderDonutChart(canvasId, { labels = [], datasets = [], title, isHalf = false, centerText }) {
  destroyChart(canvasId);
  const canvas = getCanvas(canvasId);
  if (!canvas) return null;
  const { ctx, width, height } = getContext(canvas);
  drawFrame(ctx, width, height, title);

  const data = datasets[0]?.data || [];
  const values = data.map((v) => Number(v) || 0);
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  const colors = datasets[0]?.backgroundColor || VG_PALETTE;
  const cx = width / 2;
  const cy = isHalf ? height * 0.62 : height / 2 + 10;
  const outerRadius = Math.min(width, height) * (isHalf ? 0.34 : 0.28);
  const innerRadius = outerRadius * 0.62;
  const startBase = isHalf ? Math.PI : -Math.PI / 2;
  const sweep = isHalf ? Math.PI : Math.PI * 2;
  let cursor = startBase;

  ctx.save();
  ctx.lineWidth = 1;
  values.forEach((value, index) => {
    const slice = (value / total) * sweep;
    const color = Array.isArray(colors) ? colors[index % colors.length] : colors || VG_PALETTE[index % VG_PALETTE.length];
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.fillStyle = color;
    ctx.arc(cx, cy, outerRadius, cursor, cursor + slice);
    ctx.closePath();
    ctx.fill();
    cursor += slice;
  });

  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  if (centerText) {
    text(ctx, centerText, cx, cy, { size: 15, weight: '700', color: '#00363D', align: 'center', baseline: 'middle' });
  }

  const legendTop = isHalf ? height - 40 : height - 22;
  let x = 16;
  ctx.font = '12px Inter, system-ui, sans-serif';
  labels.forEach((label, index) => {
    const color = Array.isArray(colors) ? colors[index % colors.length] : colors || VG_PALETTE[index % VG_PALETTE.length];
    ctx.fillStyle = color;
    ctx.fillRect(x, legendTop - 9, 10, 10);
    ctx.fillStyle = '#526b70';
    ctx.fillText(label, x + 14, legendTop);
    x += ctx.measureText(label).width + 32;
  });
  ctx.restore();

  const instance = { destroy() { clearCanvas(canvasId); } };
  _instances.set(canvasId, instance);
  return instance;
}

export { destroyChart, renderBarChart, renderLineChart, renderScatterChart, renderDonutChart };
