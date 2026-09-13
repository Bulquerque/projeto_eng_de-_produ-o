import {
  createDebugSession,
  readSharedDebugEntries,
  summarizeDebugEntries,
} from '../../core/debug-tools.js';
import { getSafeStateSnapshot } from '../state.js';
import { escapeHtml, safeJson, statusChip } from '../view-helpers.js';

function sanitize(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (/password|secret|key|cipher|raw_payload/i.test(key)) return [key, '[redacted]'];
      if (/path|stack/i.test(key)) return [key, '[sanitized]'];
      return [key, sanitize(item)];
    })
  );
}

export function createNetworkDebugModel(state) {
  const session = createDebugSession({
    phase: 'network-intelligence',
    module: 'app',
    enabled: Boolean(state?.dev?.enabled),
  });
  const entries = readSharedDebugEntries();
  return {
    status: state?.meta?.status || 'unknown',
    health: {
      company_id: state?.context?.company_id,
      provider_kind: state?.context?.provider_kind,
      runtime_mode: state?.context?.runtime_mode,
      app_status: state?.meta?.status,
    },
    summary: summarizeDebugEntries(entries),
    events: sanitize(entries.slice(-30)),
    snapshot: getSafeStateSnapshot(state),
    session,
  };
}

export function renderDevConsolePage(state, route = null) {
  if (!state?.dev?.enabled) {
    return `<div class="ni-page-heading" data-testid="page-dev-console"><p class="ni-eyebrow">Dev Mode</p><h1>Console indisponível</h1></div><div class="ni-card"><p>O console técnico está desabilitado neste runtime.</p></div>`;
  }
  const model = createNetworkDebugModel(state);
  const tab = route?.query?.get('tab') || 'all';
  const events =
    tab === 'errors'
      ? model.events.filter((entry) =>
          /error|warn|fail/i.test(`${entry?.level || ''} ${entry?.event || ''}`)
        )
      : model.events;
  const tabLabel = tab === 'errors' ? ' · erros' : '';
  return `<div class="ni-page-heading" data-testid="page-dev-console"><p class="ni-eyebrow">Dev Mode</p><h1>Console técnico${tabLabel}</h1><p>Diagnóstico limitado a metadados e eventos sanitizados. Estado protegido, resultados e payloads descriptografados não são exibidos.</p></div><div class="ni-kpi-grid">${statusChip(model.status, `status: ${model.status}`)}${statusChip(state.context.provider_kind, `provider: ${state.context.provider_kind}`)}${statusChip(state.context.runtime_mode, `runtime: ${state.context.runtime_mode}`)}</div><div class="ni-grid two"><div class="ni-card"><h2>Health</h2><pre class="ni-json">${safeJson(model.health)}</pre></div><div class="ni-card"><h2>Eventos${tabLabel}</h2><pre class="ni-json">${safeJson(events)}</pre></div></div><div class="ni-card"><h2>Snapshot seguro</h2><pre class="ni-json">${safeJson(model.snapshot)}</pre></div>`;
}

export function sanitizeError(error) {
  return {
    code: error?.code || 'APP_ERROR',
    message: escapeHtml(error?.message || String(error || 'Erro desconhecido.')),
  };
}
