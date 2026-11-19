import { escapeHtml, formatPct } from '../core/common.js';

export function renderTaxPeriodsHtml(contract = {}) {
  const selected = contract.selected_period || {};
  const dataPeriod = contract.current_reference_data_period || {};
  const observed = contract.observed_data_coverage || {};
  const rows = (contract.available_periods || [])
    .map(
      (period) =>
        `<tr><td>${escapeHtml(String(period.year ?? '—'))}</td><td>${escapeHtml(period.phase || '—')}</td><td>${period.current_tax_weight == null ? '—' : formatPct(period.current_tax_weight * 100)}</td><td>${period.reform_tax_weight == null ? '—' : formatPct(period.reform_tax_weight * 100)}</td><td>${escapeHtml(period.source_confidence || '—')}</td><td>${escapeHtml(period.data_status || '—')}</td></tr>`
    )
    .join('');
  return `<p><strong>Selecionado:</strong> ${escapeHtml(String(selected.year || '—'))} · ${escapeHtml(selected.source_status || '—')} · ${escapeHtml(selected.source_ref || selected.bridge_source_ref || '—')}</p><p><strong>Matriz atual:</strong> ${escapeHtml(`${dataPeriod.period_start || '—'} a ${dataPeriod.period_end || 'aberto'} · ${dataPeriod.source_file || '—'}`)}</p><p><strong>Dados transacionais observados:</strong> ${escapeHtml(`${observed.status || '—'}; período não informado quando ausente na fonte.`)}</p><table><thead><tr><th>Ano</th><th>Fase</th><th>Atual</th><th>IBS</th><th>Fonte</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Cronograma oficial não carregado.</td></tr>'}</tbody></table><p class="small-note">A tabela separa cronograma oficial, matriz de referência e histórico transacional. A ausência de período observado não é preenchida por hipótese.</p>`;
}
