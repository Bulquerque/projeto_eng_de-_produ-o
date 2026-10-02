import { selectBaseline, selectScenarios } from '../selectors/business-selectors.js';
import { escapeHtml, sectionTabs, table } from '../view-helpers.js';
import { MODEL_DEFAULTS } from '../../core/model-configuration.js';
import { getTaxReformConfig } from '../../core/tax-reform-config.js';

const PARAMETER_FIELDS = [
  [
    'freight_multiplier',
    'Frete (multiplicador)',
    { min: '0.1', step: '0.01' },
    'freight_multiplier',
  ],
  [
    'demand_multiplier',
    'Demanda (multiplicador)',
    { min: '0.1', step: '0.01' },
    'demand_multiplier',
  ],
  ['inventory_days', 'Dias de estoque', { min: '0', step: '1' }, 'inventory_days'],
  ['wacc', 'Custo de capital (taxa anual)', { min: '0', step: '0.01' }, 'wacc'],
];

function renderNumberField(name, label, value, reference, attrs = {}, disabled = false) {
  const limits = Object.entries(attrs)
    .map(([key, attrValue]) => ` ${key}="${escapeHtml(attrValue)}"`)
    .join('');
  const referenceText = reference == null ? '—' : escapeHtml(String(reference));
  return `<label class="ni-workspace-field"><span>${label}</span><input name="${name}" type="number"${limits} value="${value == null ? '' : escapeHtml(value)}"${disabled ? ' disabled' : ''}><small>Referência: ${referenceText}</small></label>`;
}

function availableCds(state, baselineModel) {
  const all = [
    ...(Array.isArray(baselineModel.available_cds) ? baselineModel.available_cds : []),
    ...(Array.isArray(baselineModel.all_cds) ? baselineModel.all_cds : []),
    ...(Array.isArray(baselineModel.active_cds) ? baselineModel.active_cds : []),
    ...(selectBaseline(state)?.flows || []).map((flow) => flow.cd),
    ...selectScenarios(state).flatMap((scenario) => scenario?.changes?.active_cds || []),
  ];
  return [...new Set(all.filter((cd) => typeof cd === 'string' && cd.trim()))];
}

function baselineReference(state, field) {
  const baseline = selectBaseline(state) || {};
  const model = baseline.model || {};
  const changes = model.changes || {};
  const candidates = [
    changes[field],
    model[field],
    baseline[field],
    baseline.parameters?.[field],
    baseline.assumptions?.[field],
    baseline.tax_results?.tax_results?.[field],
  ];
  candidates.push(
    state.data?.scenarios?.find((scenario) => scenario.scenario_type === 'baseline')?.changes?.[
      field
    ]
  );
  candidates.push(
    {
      freight_multiplier: 1,
      demand_multiplier: 1,
      inventory_days: MODEL_DEFAULTS.inventory_days,
      wacc: MODEL_DEFAULTS.reference_wacc,
      tax_mode: 'current',
    }[field]
  );
  return candidates.find((value) => value !== undefined && value !== null && value !== '') ?? null;
}

function scenarioStatus(state) {
  const capabilities =
    state.meta?.capabilities || state.meta?.provider_snapshot?.capabilities || {};
  return capabilities.scenario === false || capabilities.edit_scenarios === false
    ? ' disabled'
    : '';
}

export function renderScenarioBuild(state) {
  const baseline = selectBaseline(state);
  const model = baseline?.model || {};
  const draft = state.ui?.scenario_draft || {};
  const changes = draft.changes || {};
  const cds = availableCds(state, model);
  const selectedCds = new Set(
    Array.isArray(changes.active_cds) ? changes.active_cds : model.active_cds || []
  );
  const disabled = scenarioStatus(state);
  const saved = state.data?.saved_scenarios || [];
  const savedRows = saved.map(
    (scenario) =>
      `<tr><td>${escapeHtml(scenario.scenario_name || 'Cenário salvo')}</td><td><button type="button" class="ni-button secondary" data-action="delete-saved-scenario" data-scenario-id="${escapeHtml(scenario.scenario_id)}">Excluir</button></td></tr>`
  );
  const cdChoices = cds.length
    ? `<fieldset class="ni-workspace-cd-list"><legend>Centros de distribuição ativos</legend>${cds
        .map(
          (cd) =>
            `<label><input type="checkbox" name="active_cds" value="${escapeHtml(cd)}"${selectedCds.has(cd) ? ' checked' : ''}${disabled}>${escapeHtml(cd)}</label>`
        )
        .join('')}</fieldset>`
    : `<p class="ni-note">Centros de distribuição indisponíveis para esta empresa.</p>`;
  const fields = PARAMETER_FIELDS.map(([name, label, attrs, field]) =>
    renderNumberField(
      name,
      label,
      changes[name] ?? baselineReference(state, field),
      baselineReference(state, field),
      attrs,
      Boolean(disabled)
    )
  ).join('');
  const regimes = Object.entries(getTaxReformConfig().regimes).filter(
    ([id]) => id !== 'disabled' && (state.context.provider_kind !== 'mock' || id === 'current')
  );
  const regime = changes.tax_regime || changes.tax_mode || 'current';
  const fiscal = `<label class="ni-workspace-field"><span>Regime tributário</span><select name="tax_regime">${regimes.map(([id, item]) => `<option value="${id}"${id === regime ? ' selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}</select></label>`;
  const reallocation = `<label class="ni-workspace-field"><span>Redistribuição dos fluxos</span><select name="reallocation_rule"><option value="nearest_available_cd"${changes.reallocation_rule !== 'first_available_cd' ? ' selected' : ''}>CD disponível mais próximo</option><option value="first_available_cd"${changes.reallocation_rule === 'first_available_cd' ? ' selected' : ''}>Primeiro CD disponível</option></select></label>`;
  const advanced = `<details class="ni-workspace-advanced"><summary>Salvar, importar ou exportar</summary><div class="ni-workspace-advanced-content"><div class="ni-actions"><button type="button" class="ni-button secondary" data-action="save-current-scenario" data-testid="scenario-save"${state.data?.scenario_result ? '' : ' disabled'}>Salvar cenário simulado</button><button type="button" class="ni-button secondary" data-action="export-current-scenario" data-testid="scenario-export"${state.data?.scenario_result ? '' : ' disabled'}>Exportar JSON</button><button type="button" class="ni-button secondary" data-action="import-scenario">Importar JSON</button><input id="networkScenarioImport" type="file" accept="application/json,.json" hidden data-testid="scenario-import"></div><section data-testid="saved-scenarios"><h2>Cenários salvos</h2>${table(['Nome', 'Ações'], savedRows, 'Nenhum cenário salvo.')}${saved.length ? '<button type="button" class="ni-button secondary" data-action="clear-saved-scenarios" data-testid="scenario-clear-saved">Excluir todos os cenários salvos</button>' : ''}</section></div></details>`;
  const form = `<form id="niScenarioForm" class="ni-card ni-form ni-workspace-form" data-testid="scenario-form" novalidate><label class="ni-workspace-field"><span>Nome da simulação</span><input name="scenario_name" value="${escapeHtml(draft.scenario_name ?? 'Nova simulação')}" required${disabled}></label>${cdChoices}<div class="ni-workspace-field-grid">${fields}${fiscal}</div><div class="ni-actions"><button type="submit" class="ni-button primary" data-testid="scenario-run"${disabled}>Simular cenário</button><button type="button" class="ni-button secondary" data-action="reset-scenario-draft">Restaurar referência</button></div><details class="ni-workspace-advanced"><summary>Regra de redistribuição</summary>${reallocation}</details>${advanced}</form>`;
  return `<section class="ni-workspace ni-workspace-page ni-simulation" data-testid="page-scenarios-build"><header class="ni-page-heading"><h1>Simulação</h1></header>${sectionTabs('scenarios', state.ui?.route)}${form}</section>`;
}
