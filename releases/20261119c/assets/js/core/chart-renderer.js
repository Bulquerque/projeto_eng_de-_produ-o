const _instances = new Map();

export const VG_PALETTE = [
  '#00A189',
  '#A9FDAC',
  '#0C7878',
  '#0F515C',
  '#b42318',
  '#92400e',
  '#00363D',
];

function formatValue(value, mode) {
  if (value === null || value === undefined || value === '') return 'Sem dado';
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Sem dado';
  if (mode === 'money') return `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`;
  if (mode === 'percent') return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  return Number.isInteger(n)
    ? n.toLocaleString('pt-BR')
    : n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function formatLabel(value, mode) {
  if (value === null || value === undefined || value === '') return String(value ?? '');
  return Number.isFinite(Number(value)) && value !== ''
    ? formatValue(value, mode)
    : String(value ?? '');
}
function isValue(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}
function numberValue(value) {
  return isValue(value) ? Number(value) : NaN;
}
function compactTick(value, mode) {
  if (!Number.isFinite(value)) return '—';
  const magnitude = Math.abs(value);
  if (mode === 'money') {
    const scale = magnitude >= 1e9 ? 1e9 : magnitude >= 1e6 ? 1e6 : magnitude >= 1e4 ? 1e3 : 1;
    const suffix = scale === 1e9 ? ' bi' : scale === 1e6 ? ' mi' : scale === 1e3 ? ' mil' : '';
    return `R$ ${(value / scale).toLocaleString('pt-BR', { maximumFractionDigits: scale === 1 ? 0 : 1 })}${suffix}`;
  }
  if (mode === 'percent')
    return `${value.toLocaleString('pt-BR', { maximumFractionDigits: Math.abs(value) < 1 ? 2 : 1 })}%`;
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}
function fitText(ctx, value, maxWidth) {
  const source = String(value ?? '');
  if (ctx.measureText(source).width <= maxWidth) return source;
  let left = 0,
    right = source.length;
  while (left < right) {
    const middle = Math.ceil((left + right) / 2);
    if (ctx.measureText(`${source.slice(0, middle)}…`).width <= maxWidth) left = middle;
    else right = middle - 1;
  }
  return `${source.slice(0, left)}…`;
}
function niceStep(value) {
  if (!(value > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  return (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
}

function destroyChart(canvasId) {
  const old = _instances.get(canvasId);
  if (old) old.destroy();
  _instances.delete(canvasId);
}

function mount(
  canvasId,
  draw,
  rows,
  datasets,
  { title = '', xFormat, yFormat, legendItems, minHeight = 220, onActivate } = {}
) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', title || 'Gráfico interativo');
  canvas.tabIndex = 0;
  canvas.style.touchAction = 'pan-y';
  const originalMinHeight = canvas.style.minHeight;
  canvas.style.minHeight = `${Math.max(220, minHeight)}px`;
  const parent = canvas.parentElement;
  const tooltip = document.createElement('div');
  tooltip.className = 'vg-chart-tooltip';
  tooltip.setAttribute('role', 'status');
  tooltip.setAttribute('aria-live', 'polite');
  Object.assign(tooltip.style, {
    position: 'fixed',
    display: 'none',
    zIndex: '10000',
    padding: '8px 10px',
    background: '#00363D',
    color: 'white',
    borderRadius: '6px',
    font: '12px system-ui',
    pointerEvents: 'none',
    whiteSpace: 'pre-line',
    maxWidth: 'min(280px, calc(100vw - 24px))',
    overflowWrap: 'anywhere',
  });
  document.body.append(tooltip);
  const controls = document.createElement('div');
  controls.className = 'vg-chart-controls';
  controls.style.cssText =
    'display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:6px 0;font:12px system-ui;color:#526b70';
  const table = document.createElement('details');
  table.className = 'vg-chart-data';
  table.style.cssText = 'max-height:240px;overflow:auto;font:12px system-ui';
  const summary = document.createElement('summary');
  summary.textContent = 'Tabela de dados';
  const tableContent = document.createElement('div');
  table.append(summary, tableContent);
  const items =
    legendItems ||
    datasets.map((ds, i) => ({ label: ds.label || `Série ${i + 1}`, color: color(ds, i) }));
  const seriesVisible = items.map(() => true);
  items.forEach((item, i) => {
    const swatch = document.createElement('span');
    swatch.style.cssText = `display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;background:${item.color}`;
    if (items.length > 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-pressed', 'true');
      button.style.cssText =
        'border:0;background:transparent;color:inherit;padding:3px 4px;cursor:pointer;font:inherit';
      button.append(swatch, document.createTextNode(item.label));
      button.addEventListener('click', () => {
        seriesVisible[i] = !seriesVisible[i];
        button.setAttribute('aria-pressed', String(seriesVisible[i]));
        button.style.opacity = seriesVisible[i] ? '1' : '.45';
        drawNow();
      });
      controls.append(button);
    } else {
      const label = document.createElement('span');
      label.append(swatch, document.createTextNode(item.label));
      controls.append(label);
    }
  });
  if (!items.length) controls.hidden = true;
  parent?.insertBefore(controls, canvas.nextSibling);
  parent?.insertBefore(table, controls.nextSibling);
  const esc = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  function updateTable() {
    const tableSeriesVisible = legendItems ? datasets.map(() => true) : seriesVisible;
    if (rows.some((r) => r.axisValues)) {
      tableContent.innerHTML = `<table style="border-collapse:collapse;width:100%"><thead><tr><th>Ponto</th><th>${esc(rows[0]?.xLabel || 'x')}</th><th>${esc(rows[0]?.yLabel || 'y')}</th></tr></thead><tbody>${rows.map((r) => `<tr><th>${esc(r.label)}</th><td>${esc(formatValue(r.axisValues?.[0], xFormat))}</td><td>${esc(formatValue(r.axisValues?.[1], yFormat))}</td></tr>`).join('')}</tbody></table>`;
      return;
    }
    const head = `<thead><tr><th>Categoria</th>${datasets.map((d, i) => (tableSeriesVisible[i] ? `<th>${esc(d.label || `Série ${i + 1}`)}</th>` : '')).join('')}</tr></thead>`;
    tableContent.innerHTML = `<table style="border-collapse:collapse;width:100%">${head}<tbody>${rows.map((r) => `<tr><th>${esc(r.label)}</th>${r.values.map((v, i) => (tableSeriesVisible[i] ? `<td>${esc(formatValue(v, yFormat))}</td>` : '')).join('')}</tr>`).join('')}</tbody></table>`;
  }
  let hitTargets = [];
  function drawNow() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(200, Math.floor(rect.width || 320));
    const height = Math.max(220, minHeight, Math.floor(rect.height || 280));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    hitTargets = draw(ctx, width, height, seriesVisible, xFormat, yFormat) || [];
    updateTable();
  }
  const showTip = (index, x, y) => {
    const row = rows[index];
    if (!row) return;
    const details = row.axisValues
      ? `${row.xLabel || 'x'}: ${formatValue(row.axisValues[0], xFormat)}\n${row.yLabel || 'y'}: ${formatValue(row.axisValues[1], yFormat)}`
      : row.values
          .map((v, i) =>
            legendItems || seriesVisible[i]
              ? `${datasets[i]?.label || `Série ${i + 1}`}: ${formatValue(v, yFormat)}`
              : ''
          )
          .filter(Boolean)
          .join('\n');
    tooltip.textContent = `${row.label}\n${details}`;
    tooltip.style.left = `${Math.max(12, Math.min(x + 12, window.innerWidth - 292))}px`;
    tooltip.style.top = `${Math.min(y + 12, window.innerHeight - 90)}px`;
    tooltip.style.display = 'block';
  };
  const pointer = (event) => {
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left,
      py = event.clientY - rect.top;
    let index = Math.max(
      0,
      Math.min(rows.length - 1, Math.round((px / rect.width) * (rows.length - 1)))
    );
    if (hitTargets.length) {
      let nearest = Infinity;
      hitTargets.forEach((hit) => {
        const distance = (hit.x - px) ** 2 + (hit.y - py) ** 2;
        if (distance < nearest) {
          nearest = distance;
          index = hit.index;
        }
      });
    }
    canvas.dataset.chartIndex = String(index);
    showTip(index, event.clientX, event.clientY);
  };
  const key = (event) => {
    if (onActivate && ['Enter', ' '].includes(event.key) && rows.length) {
      event.preventDefault();
      onActivate(rows[Number(canvas.dataset.chartIndex || 0)]);
      return;
    }
    if (!rows.length || !['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key))
      return;
    if (event.key === 'Escape') {
      tooltip.style.display = 'none';
      return;
    }
    event.preventDefault();
    let index = Number(canvas.dataset.chartIndex || 0);
    index =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? rows.length - 1
          : Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
    canvas.dataset.chartIndex = String(index);
    showTip(
      index,
      canvas.getBoundingClientRect().left + 12,
      canvas.getBoundingClientRect().top + 12
    );
    canvas.setAttribute('aria-label', `${title || 'Gráfico'}: ${rows[index].label}`);
  };
  const hideTip = (event) => {
    if (event?.type === 'pointerleave' && event.pointerType === 'touch') return;
    tooltip.style.display = 'none';
  };
  const focusTip = () =>
    pointer({
      clientX: canvas.getBoundingClientRect().left + 10,
      clientY: canvas.getBoundingClientRect().top + 10,
    });
  const hideOutside = (event) => {
    if (event.target !== canvas) hideTip();
  };
  const activate = (event) => {
    if (!onActivate || !rows.length) return;
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    if (!hitTargets.some((hit) => (hit.x - px) ** 2 + (hit.y - py) ** 2 <= 18 ** 2)) return;
    pointer(event);
    onActivate(rows[Number(canvas.dataset.chartIndex || 0)]);
  };
  canvas.addEventListener('click', activate);
  document.addEventListener('pointerdown', hideOutside);
  canvas.addEventListener('pointermove', pointer);
  canvas.addEventListener('pointerdown', pointer);
  canvas.addEventListener('pointerleave', hideTip);
  canvas.addEventListener('focus', focusTip);
  canvas.addEventListener('keydown', key);
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(drawNow) : null;
  observer?.observe(canvas);
  drawNow();
  const instance = {
    destroy() {
      observer?.disconnect();
      canvas.removeEventListener('click', activate);
      document.removeEventListener('pointerdown', hideOutside);
      canvas.removeEventListener('pointermove', pointer);
      canvas.removeEventListener('pointerdown', pointer);
      canvas.removeEventListener('pointerleave', hideTip);
      canvas.removeEventListener('focus', focusTip);
      canvas.removeEventListener('keydown', key);
      tooltip.remove();
      controls.remove();
      table.remove();
      canvas.style.minHeight = originalMinHeight;
    },
  };
  _instances.set(canvasId, instance);
  return instance;
}

function frame(ctx, w, h, title, pad, drawGrid = true) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#d8e1e3';
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  if (title) {
    ctx.fillStyle = '#00363D';
    ctx.font = '700 14px system-ui';
    const maxTitleWidth = Math.max(80, w - 32);
    const visibleTitle = fitText(ctx, title, maxTitleWidth);
    ctx.fillText(visibleTitle, 16, 19, maxTitleWidth);
  }
  ctx.font = '11px system-ui';
  ctx.fillStyle = '#526b70';
  if (drawGrid) {
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + ((h - pad.t - pad.b) * i) / 4;
      ctx.strokeStyle = '#edf1f2';
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
    }
  }
}
function color(ds, i) {
  const fill = ds.borderColor || ds.backgroundColor;
  return Array.isArray(fill) ? fill[i % fill.length] : fill || VG_PALETTE[i % VG_PALETTE.length];
}
function renderBarChart(
  id,
  { labels = [], datasets = [], title, yFormat, xFormat, indexAxis = 'x' } = {}
) {
  const rows = labels.map((label, i) => ({
    label,
    values: datasets.map((d) => d.data?.[i] ?? null),
  }));
  return mount(
    id,
    (ctx, w, h, visible, xf, yf) => {
      const vals = rows.flatMap((r) => r.values.map(numberValue).filter(Number.isFinite));
      const min = Math.min(0, ...vals),
        max = Math.max(0, ...vals);
      let lo = min === max ? -1 : min,
        hi = min === max ? 1 : max;
      const axisFormat = indexAxis === 'y' ? xFormat : yFormat;
      const integerAxis =
        vals.length > 0 &&
        vals.every(Number.isInteger) &&
        !['money', 'percent'].includes(axisFormat);
      const integerStep = integerAxis ? Math.max(1, niceStep((hi - lo) / 4)) : null;
      if (integerAxis) {
        lo = Math.floor(lo / integerStep) * integerStep;
        hi = Math.ceil(hi / integerStep) * integerStep;
      }
      ctx.font = '11px system-ui';
      const longestCategory = Math.max(
        0,
        ...labels.map((label) => ctx.measureText(String(label ?? '')).width)
      );
      const tickFormat = indexAxis === 'y' ? xf : yf;
      const tickWidth = Math.max(
        ...Array.from(
          { length: 5 },
          (_, i) => ctx.measureText(compactTick(lo + ((hi - lo) * i) / 4, tickFormat)).width
        )
      );
      const categoryPad =
        indexAxis === 'y' ? Math.min(w * 0.4, Math.max(82, longestCategory + 14)) : 0;
      const leftPad = indexAxis === 'y' ? categoryPad : Math.max(54, tickWidth + 16);
      const p = { t: title ? 32 : 14, r: Math.max(20, tickWidth / 2 + 12), b: 54, l: leftPad };
      frame(ctx, w, h, title, p);
      const cw = w - p.l - p.r,
        ch = h - p.t - p.b;
      const tickSteps = Math.max(
        2,
        Math.min(4, Math.floor(indexAxis === 'y' ? cw / (tickWidth + 12) : ch / 36))
      );
      const zeroY = p.t + (hi / (hi - lo)) * ch;
      const zeroX = p.l + ((0 - lo) / (hi - lo)) * cw;
      ctx.fillStyle = '#526b70';
      ctx.font = '10px system-ui';
      const tickValues = integerAxis
        ? Array.from(
            { length: Math.round((hi - lo) / integerStep) + 1 },
            (_, i) => lo + i * integerStep
          )
        : Array.from({ length: tickSteps + 1 }, (_, t) =>
            indexAxis === 'y' ? lo + ((hi - lo) * t) / tickSteps : hi - ((hi - lo) * t) / tickSteps
          );
      tickValues.forEach((v, t) => {
        if (indexAxis === 'y') {
          const x = p.l + ((v - lo) / (hi - lo)) * cw;
          ctx.strokeStyle = '#edf1f2';
          ctx.beginPath();
          ctx.moveTo(x, p.t);
          ctx.lineTo(x, h - p.b);
          ctx.stroke();
          ctx.fillStyle = '#526b70';
          ctx.textAlign = 'center';
          ctx.textAlign = t === 0 ? 'left' : t === tickValues.length - 1 ? 'right' : 'center';
          ctx.fillText(compactTick(v, xf), x, h - 15);
        } else {
          const y = p.t + ((hi - v) / (hi - lo)) * ch;
          ctx.fillStyle = '#526b70';
          ctx.textAlign = 'right';
          ctx.fillText(compactTick(v, yf), p.l - 8, y + 3);
        }
      });
      const n = Math.max(1, rows.length),
        count = Math.max(1, visible.filter(Boolean).length);
      const hits = [];
      rows.forEach((r, ri) => {
        const band = (indexAxis === 'y' ? ch : cw) / n;
        hits.push({
          index: ri,
          x: indexAxis === 'y' ? p.l + cw / 2 : p.l + (ri + 0.5) * band,
          y: indexAxis === 'y' ? p.t + (ri + 0.5) * band : p.t + ch / 2,
        });
        ctx.fillStyle = '#526b70';
        if (indexAxis === 'y') {
          const y = p.t + ri * band;
          ctx.textAlign = 'right';
          ctx.fillText(fitText(ctx, r.label, p.l - 14), p.l - 10, y + band / 2 + 4);
          ctx.textAlign = 'left';
          let slot = 0;
          r.values.forEach((v, si) => {
            if (!visible[si] || !isValue(v)) return;
            const yy = y + (band * slot++) / count + 2,
              bh = Math.max(2, band / count - 4),
              x1 = p.l + ((numberValue(v) - lo) / (hi - lo)) * cw;
            ctx.fillStyle = color(datasets[si], ri);
            ctx.fillRect(Math.min(zeroX, x1), yy, Math.max(1, Math.abs(x1 - zeroX)), bh);
          });
        } else {
          const labelStep = Math.max(1, Math.ceil(rows.length / Math.max(1, Math.floor(cw / 76))));
          if (ri % labelStep === 0 || ri === rows.length - 1) {
            ctx.textAlign = 'center';
            ctx.fillText(
              fitText(ctx, formatLabel(r.label, xf), Math.max(32, band - 4)),
              p.l + (ri + 0.5) * band,
              h - 15
            );
          }
          let slot = 0;
          r.values.forEach((v, si) => {
            if (!visible[si] || !isValue(v)) return;
            const x = p.l + ri * band + (band * slot++) / count + 2,
              bw = Math.max(2, band / count - 4),
              y = p.t + ((hi - numberValue(v)) / (hi - lo)) * ch;
            ctx.fillStyle = color(datasets[si], ri);
            ctx.fillRect(x, Math.min(zeroY, y), bw, Math.max(1, Math.abs(y - zeroY)));
          });
        }
      });
      ctx.strokeStyle = '#879b9f';
      ctx.beginPath();
      if (indexAxis === 'y') {
        ctx.moveTo(zeroX, p.t);
        ctx.lineTo(zeroX, h - p.b);
      } else {
        ctx.moveTo(p.l, zeroY);
        ctx.lineTo(w - p.r, zeroY);
      }
      ctx.stroke();
      return hits;
    },
    rows,
    datasets,
    {
      title,
      xFormat,
      yFormat: indexAxis === 'y' ? xFormat : yFormat,
      minHeight: indexAxis === 'y' ? Math.max(220, labels.length * 20 + 60) : 220,
    }
  );
}
function renderLineChart(
  id,
  { labels = [], datasets = [], title, yFormat, xFormat, xValues } = {}
) {
  const rows = labels.map((label, i) => ({
    label,
    values: datasets.map((d) => d.data?.[i] ?? null),
  }));
  return mount(
    id,
    (ctx, w, h, visible, xf, yf) => {
      const vals = rows.flatMap((r) => r.values.map(numberValue).filter(Number.isFinite));
      let min = Math.min(0, ...vals),
        max = Math.max(0, ...vals);
      if (min === max) {
        min -= 1;
        max += 1;
      }
      ctx.font = '10px system-ui';
      const tickWidth = Math.max(
        ...Array.from(
          { length: 5 },
          (_, i) => ctx.measureText(compactTick(min + ((max - min) * i) / 4, yf)).width
        )
      );
      const p = { t: title ? 32 : 14, r: 24, b: 45, l: Math.max(54, tickWidth + 12) };
      frame(ctx, w, h, title, p);
      const ch = h - p.t - p.b,
        cw = w - p.l - p.r;
      for (let t = 0; t <= 4; t++) {
        const v = max - ((max - min) * t) / 4;
        ctx.fillStyle = '#526b70';
        ctx.textAlign = 'right';
        ctx.fillText(compactTick(v, yf), p.l - 8, p.t + (ch * t) / 4 + 3);
      }
      const nums = (xValues || []).map(numberValue),
        finite = nums.filter(Number.isFinite),
        xmin = Math.min(...finite),
        xmax = Math.max(...finite);
      const xAt = (i) =>
        p.l +
        (finite.length && xmax > xmin && Number.isFinite(nums[i])
          ? (nums[i] - xmin) / (xmax - xmin)
          : i / Math.max(1, rows.length - 1)) *
          cw;
      const hits = rows.map((r, i) => ({
        index: i,
        x: xAt(i),
        y:
          p.t +
          ((max - (r.values.map(numberValue).find(Number.isFinite) ?? min)) / (max - min)) * ch,
      }));
      const labelStep = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(cw / 36))));
      rows.forEach((r, i) => {
        if (i % labelStep === 0 || i === rows.length - 1) {
          ctx.fillStyle = '#526b70';
          ctx.textAlign = 'center';
          ctx.fillText(
            formatLabel(xValues?.[i] ?? r.label, xf),
            xAt(i),
            h - 14,
            Math.max(36, cw / Math.max(2, Math.floor(rows.length / labelStep)))
          );
        }
      });
      datasets.forEach((d, si) => {
        if (!visible[si]) return;
        ctx.strokeStyle = ctx.fillStyle = color(d, si);
        ctx.lineWidth = 2;
        ctx.beginPath();
        let started = false;
        const markers = [];
        rows.forEach((r, i) => {
          const v = numberValue(r.values[si]);
          if (!Number.isFinite(v)) {
            started = false;
            return;
          }
          const x = xAt(i),
            y = p.t + ((max - v) / (max - min)) * ch;
          if (!started) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          started = true;
          markers.push({ x, y, pointIndex: i });
        });
        ctx.stroke();
        markers.forEach(({ x, y, pointIndex }) => {
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, 7);
          ctx.fillStyle = color(d, pointIndex);
          ctx.fill();
        });
      });
      return hits;
    },
    rows,
    datasets,
    { title, xFormat: xFormat || (xValues ? 'number' : undefined), yFormat }
  );
}
function renderScatterChart(
  id,
  { datasets = [], title, xLabel, yLabel, xFormat, yFormat, onActivate } = {}
) {
  const points = datasets.flatMap((d, si) =>
    (d.data || []).map((p, i) => ({
      id: p.id,
      label: p.label ?? d.label ?? `Ponto ${i + 1}`,
      values: [p.x, p.y],
      series: si,
      pointIndex: i,
    }))
  );
  const allX = points.map((p) => numberValue(p.values[0])).filter(Number.isFinite),
    allY = points.map((p) => numberValue(p.values[1])).filter(Number.isFinite);
  return mount(
    id,
    (ctx, w, h, visible) => {
      const bound = (a) => {
        const observedMin = a.length ? Math.min(...a) : 0;
        const observedMax = a.length ? Math.max(...a) : 1;
        let lo = observedMin,
          hi = observedMax;
        if (lo === hi) {
          const padding = Math.abs(lo) * 0.1 || 1;
          lo -= padding;
          hi += padding;
        } else {
          const extra = (hi - lo) * 0.06;
          lo -= extra;
          hi += extra;
        }
        if (observedMin >= 0) lo = Math.max(0, lo);
        if (observedMax <= 0) hi = Math.min(0, hi);
        return [lo, hi];
      };
      const [xl, xh] = bound(allX),
        [yl, yh] = bound(allY);
      ctx.font = '10px system-ui';
      const yTickWidth = Math.max(
        ...Array.from(
          { length: 5 },
          (_, i) => ctx.measureText(compactTick(yl + ((yh - yl) * i) / 4, yFormat)).width
        )
      );
      const xTickWidth = Math.max(
        ...Array.from(
          { length: 5 },
          (_, i) => ctx.measureText(compactTick(xl + ((xh - xl) * i) / 4, xFormat)).width
        )
      );
      const p = {
        t: title ? 32 : 14,
        r: Math.max(24, xTickWidth / 2 + 10),
        b: 48,
        l: Math.max(54, yTickWidth + 12),
      };
      frame(ctx, w, h, title, p);
      const cw = w - p.l - p.r,
        ch = h - p.t - p.b;
      ctx.fillStyle = '#526b70';
      ctx.textAlign = 'center';
      const tickSteps = Math.min(
        Math.max(2, Math.min(4, Math.floor(cw / (xTickWidth + 12)))),
        Math.max(2, Math.min(4, Math.floor(ch / 36)))
      );
      for (let tick = 0; tick <= tickSteps; tick++) {
        const xFraction = tick / tickSteps;
        const xv = xl + (xh - xl) * xFraction,
          x = p.l + cw * xFraction;
        const yFraction = tick / tickSteps;
        const yv = yh - (yh - yl) * yFraction,
          y = p.t + ch * yFraction;
        ctx.strokeStyle = '#edf1f2';
        ctx.beginPath();
        ctx.moveTo(x, p.t);
        ctx.lineTo(x, h - p.b);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.l, y);
        ctx.lineTo(w - p.r, y);
        ctx.stroke();
        ctx.fillText(compactTick(xv, xFormat), x, h - p.b + 13);
        ctx.textAlign = 'right';
        ctx.fillText(compactTick(yv, yFormat), p.l - 6, y + 3);
        ctx.textAlign = 'center';
      }
      const hits = [];
      points.forEach((pt, i) => {
        if (!visible[pt.series] || !isValue(pt.values[0]) || !isValue(pt.values[1])) return;
        const x = p.l + ((Number(pt.values[0]) - xl) / (xh - xl)) * cw,
          y = p.t + ((yh - Number(pt.values[1])) / (yh - yl)) * ch;
        hits.push({ index: i, x, y });
        ctx.fillStyle = color(datasets[pt.series], pt.pointIndex);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 7);
        ctx.fill();
      });
      ctx.fillStyle = '#526b70';
      ctx.fillText(fitText(ctx, xLabel || '', cw), p.l + cw / 2, h - 10);
      ctx.save();
      ctx.translate(12, p.t + ch / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText(fitText(ctx, yLabel || '', Math.max(40, ch - 12)), 0, 0);
      ctx.restore();
      return hits;
    },
    points.map((p) => ({
      id: p.id,
      label: p.label,
      values: p.values,
      axisValues: p.values,
      xLabel,
      yLabel,
    })),
    datasets,
    { title, xFormat, yFormat, onActivate }
  );
}
function renderDonutChart(
  id,
  { labels = [], datasets = [], title, isHalf = false, centerText, yFormat } = {}
) {
  const d = datasets[0] || { data: [] },
    rows = labels.map((label, i) => ({
      label,
      values: datasets.map((ds) => ds.data?.[i] ?? null),
    }));
  const positiveTotal = (d.data || [])
    .map(numberValue)
    .filter((value) => Number.isFinite(value) && value > 0)
    .reduce((sum, value) => sum + value, 0);
  return mount(
    id,
    (ctx, w, h, visible) => {
      const p = { t: title ? 30 : 10, r: 10, b: 44, l: 10 };
      frame(ctx, w, h, title, p, false);
      const vals = d.data || [],
        total = vals
          .map(Number)
          .filter((v) => Number.isFinite(v) && v > 0)
          .reduce((a, b) => a + b, 0);
      let angle = isHalf ? Math.PI : -Math.PI / 2;
      const cx = w / 2,
        cy = isHalf ? h * 0.63 : h * 0.48,
        radius = Math.min(w, h) * 0.29;
      const hits = [];
      vals.forEach((v, i) => {
        if (!visible[i] || !isValue(v) || !(Number(v) > 0) || !total) {
          angle +=
            isValue(v) && Number(v) > 0 && total
              ? (Number(v) / total) * (isHalf ? Math.PI : Math.PI * 2)
              : 0;
          return;
        }
        const sweep = (Number(v) / total) * (isHalf ? Math.PI : Math.PI * 2);
        const midpoint = angle + sweep / 2;
        hits.push({
          index: i,
          x: cx + Math.cos(midpoint) * radius * 0.8,
          y: cy + Math.sin(midpoint) * radius * 0.8,
        });
        ctx.beginPath();
        ctx.arc(cx, cy, radius, angle, angle + sweep);
        ctx.arc(cx, cy, radius * 0.62, angle + sweep, angle, true);
        ctx.closePath();
        ctx.fillStyle = Array.isArray(d.backgroundColor)
          ? d.backgroundColor[i % d.backgroundColor.length]
          : d.backgroundColor || VG_PALETTE[i % VG_PALETTE.length];
        ctx.fill();
        angle += sweep;
      });
      ctx.fillStyle = '#00363D';
      ctx.font = '700 14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(centerText || '', cx, cy + 4);
      return hits;
    },
    rows,
    datasets,
    {
      title,
      yFormat,
      legendItems: labels.map((label, i) => ({
        label: `${label} · ${positiveTotal ? ((Math.max(0, numberValue(d.data?.[i])) / positiveTotal) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '0'}%`,
        color: Array.isArray(d.backgroundColor)
          ? d.backgroundColor[i % d.backgroundColor.length]
          : d.backgroundColor || VG_PALETTE[i % VG_PALETTE.length],
      })),
    }
  );
}

function destroyAllCharts() {
  for (const id of [..._instances.keys()]) destroyChart(id);
}

export {
  destroyChart,
  destroyAllCharts,
  renderBarChart,
  renderLineChart,
  renderScatterChart,
  renderDonutChart,
};
