import { escapeHtml, formatBRL, formatNumber, formatPct, statusClass } from '../core/common.js';

export { escapeHtml, formatBRL, formatNumber, formatPct, statusClass };

export function safeJson(value) {
  return escapeHtml(JSON.stringify(value ?? {}, null, 2));
}

export function statusChip(status, label = status || '—') {
  return `<span class="ni-status ${statusClass(status)}">${escapeHtml(label)}</span>`;
}

export function emptyState(message = 'Dados ainda não disponíveis.') {
  return `<div class="ni-empty"><strong>Sem dados para exibir</strong><p>${escapeHtml(message)}</p></div>`;
}

export function card(title, body, { eyebrow = '', testId = '' } = {}) {
  const attr = testId ? ` data-testid="${escapeHtml(testId)}"` : '';
  return `<article class="ni-card"${attr}>${eyebrow ? `<p class="ni-eyebrow">${escapeHtml(eyebrow)}</p>` : ''}<h2>${escapeHtml(title)}</h2>${body}</article>`;
}

export function kpi(label, value, note = '', testId = '') {
  const attr = testId ? ` data-testid="${escapeHtml(testId)}"` : '';
  return `<article class="ni-kpi"${attr}><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>${note ? `<small>${escapeHtml(note)}</small>` : ''}</article>`;
}

export function table(headers, rows, empty = 'Nenhuma linha disponível.') {
  if (!rows.length) return emptyState(empty);
  return `<div class="ni-table-wrap"><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

export function metricValue(value, formatter = String) {
  return value === null || value === undefined || value === '' ? '—' : formatter(value);
}
