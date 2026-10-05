import { $, escapeHtml } from '../core/common.js';
import { readStorageJSON, writeStorageJSON } from '../core/browser-storage.js';

const MANUAL_CHECKS = [
  {
    id: 'fase2_abri',
    label: 'Abri /fase-2-baseline/',
    detail: 'A página Baseline precisa carregar a Fase 2 corretamente.',
  },
  {
    id: 'fase2_empresa1',
    label: 'Selecionei Empresa 1 e vi baseline, fluxos e custos',
    detail: 'A Empresa 1 deve mostrar o baseline reconstruído.',
  },
  {
    id: 'fase2_benchmark_1',
    label: 'Confirmei que Empresa 1 está como benchmark pendente',
    detail: 'Não inventar Base Fit para a Empresa 1.',
  },
  {
    id: 'fase2_empresa2',
    label: 'Selecionei Empresa 2 e vi baseline reconstruído',
    detail: 'A Empresa 2 deve mostrar o workbook e seus dados.',
  },
  {
    id: 'fase2_benchmark_2',
    label: 'Confirmei que Empresa 2 está com benchmark pendente',
    detail: 'Base Fit deve continuar explícito e auditável.',
  },
  {
    id: 'fase2_total',
    label: 'Conferi que o total logístico fecha com as parcelas',
    detail: 'Transferência + distribuição + armazenagem + estoque = total logístico.',
  },
  {
    id: 'fase2_warnings',
    label: 'Conferi que os avisos e limitações aparecem',
    detail: 'Os alertas da etapa precisam ser visíveis e claros.',
  },
  {
    id: 'fase2_no_mix',
    label: 'Conferi que as empresas não se misturam',
    detail: 'Dados da Empresa 1 e 2 precisam ficar separados.',
  },
];

function checklistKey(companyId) {
  return `visagio_phase2_manual_checks_${companyId}`;
}

export function loadPhase2ManualChecklist(companyId) {
  return readStorageJSON('local', checklistKey(companyId), {});
}

export function savePhase2ManualChecklist(companyId, values) {
  writeStorageJSON('local', checklistKey(companyId), values);
}

export function renderPhase2ManualChecklist(companyId) {
  const container = $('phase2ManualChecklist');
  const progress = $('phase2ManualProgress');
  if (!container || !progress) return;

  const values = loadPhase2ManualChecklist(companyId);
  container.innerHTML = MANUAL_CHECKS.map(
    (check) => `
    <label class="check-item manual-check">
      <input type="checkbox" data-phase2-manual-check="${escapeHtml(check.id)}" ${values[check.id] ? 'checked' : ''}>
      <span>
        <span class="check-title">${escapeHtml(check.label)}</span>
        <span class="check-detail">${escapeHtml(check.detail)}</span>
      </span>
      <span class="check-result ${values[check.id] ? 'check-pass' : 'check-pending'}">${values[check.id] ? 'feito' : 'pendente'}</span>
    </label>`
  ).join('');

  const done = MANUAL_CHECKS.filter((check) => values[check.id]).length;
  progress.textContent = `${done}/${MANUAL_CHECKS.length} checagens manuais marcadas para ${companyId}.`;
}
