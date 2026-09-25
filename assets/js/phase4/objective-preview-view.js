import { escapeHtml } from '../core/common.js';

export function buildObjectivePreviewHtml({ objective, previewText }) {
  return `<strong>${escapeHtml(objective.objective_name)}</strong><p>${escapeHtml(previewText)}</p>${objective.valid ? '<span class="status-chip status-ok">objetivo válido</span>' : `<div class="alert-box error">${escapeHtml(objective.errors.join('; '))}</div>`}`;
}
