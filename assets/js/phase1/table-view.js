import { escapeHtml, formatNumber } from '../core/common.js';

export function renderTable(rows, columns, options = {}) {
  if (!rows || !rows.length) return '<p class="small-note">Sem registros para exibir.</p>';
  const limit = options.limit || rows.length;
  const visibleRows = rows.slice(0, limit);
  const suffix =
    rows.length > limit
      ? `<p class="small-note">Mostrando ${limit} de ${rows.length} registros.</p>`
      : '';
  return `<table><thead><tr>${columns.map((col) => `<th>${escapeHtml(col.label || col.key)}</th>`).join('')}</tr></thead><tbody>${visibleRows
    .map(
      (row) =>
        `<tr>${columns
          .map((col) => {
            const raw =
              typeof col.value === 'function' ? col.value(row) : row[col.key ?? col.value];
            const value = typeof raw === 'number' ? formatNumber(raw) : (raw ?? '—');
            const cls = col.isPath ? ' class="path-cell"' : '';
            return `<td${cls}>${escapeHtml(String(value))}</td>`;
          })
          .join('')}</tr>`
    )
    .join('')}</tbody></table>${suffix}`;
}
