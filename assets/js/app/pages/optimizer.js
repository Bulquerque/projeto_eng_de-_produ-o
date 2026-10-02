import { selectBaseline } from '../selectors/business-selectors.js';
import { escapeHtml, sectionTabs } from '../view-helpers.js';

const OBJECTIVES = [
  ['balanced', 'Equilibrado', 'Pondera custo, serviço, risco e tributos.'],
  ['cfo', 'Eficiência financeira', 'Prioriza custo total e capital.'],
  ['supply', 'Continuidade operacional', 'Valoriza serviço e risco.'],
  ['fiscal', 'Eficiência tributária', 'Considera o impacto tributário.'],
  ['conservative', 'Conservador', 'Prefere menor risco.'],
];

function value(draft, name, fallback) {
  if (draft?.[name] != null) return draft[name];
  if (draft?.constraints?.[name] != null) return draft.constraints[name];
  if (draft?.risk_config?.[name.replace(/^risk_/, '')] != null)
    return draft.risk_config[name.replace(/^risk_/, '')];
  return fallback;
}

function field(name, label, current, { min, max, step = '1' } = {}) {
  const attrs = `${min == null ? '' : ` min="${min}"`}${max == null ? '' : ` max="${max}"`}`;
  return `<label class="ni-workspace-field"><span>${label}</span><input name="${name}" type="number"${attrs} step="${step}" value="${escapeHtml(current)}"></label>`;
}

function selectField(name, label, options, selected) {
  return `<label class="ni-workspace-field"><span>${label}</span><select name="${name}">${options.map(([id, text]) => `<option value="${escapeHtml(id)}"${String(id) === String(selected) ? ' selected' : ''}>${text}</option>`).join('')}</select></label>`;
}

export function renderOptimizerConfigure(state) {
  const registry =
    selectBaseline(state)?.complements?.scenario_registry ||
    selectBaseline(state)?.tax_results?.tax_source_context?.scenario_registry ||
    [];
  const fiscalCapabilities =
    state.meta?.capabilities?.fiscal || state.meta?.provider_snapshot?.capabilities?.fiscal;
  const hasTaxScenarios =
    fiscalCapabilities?.tax_reform_scenarios ??
    registry.some((item) =>
      ['tax_reform_transition', 'tax_reform_full'].includes(item.scenario_type)
    );
  const taxScenarios = hasTaxScenarios
    ? [
        [2026, 'Ano-teste'],
        [2027, 'CBS, IBS-teste e IS'],
        [2028, 'CBS, IBS-teste e IS'],
        [2029, 'IBS: 10% da transição'],
        [2030, 'IBS: 20% da transição'],
        [2031, 'IBS: 30% da transição'],
        [2032, 'IBS: 40% da transição'],
        [2033, 'Novo sistema integral'],
      ]
    : [];
  const selectedScenario = state.data?.selected_scenario || state.ui?.scenario_draft;
  const defaultTaxYear = Number(selectedScenario?.changes?.tax_year) || 2027;
  const activeTaxYear = Number(
    state.ui?.optimizer_tax_year ||
      selectedScenario?.changes?.tax_year ||
      state.ui?.optimizer_draft?.tax_year ||
      defaultTaxYear
  );
  const draft =
    state.ui?.optimizer_drafts?.[String(activeTaxYear)] ||
    (Number(state.ui?.optimizer_draft?.tax_year) === activeTaxYear ? state.ui.optimizer_draft : {});
  const constraints = state.data?.optimizer?.constraints || {};
  const baseline = selectBaseline(state)?.model || {};
  const activeCount = Array.isArray(baseline.active_cds) ? baseline.active_cds.length : null;
  const objectives = OBJECTIVES.map(
    ([id, title, description]) =>
      `<label class="ni-workspace-profile"><input type="radio" name="profile_id" value="${id}"${String(draft.profile_id || 'balanced') === id ? ' checked' : ''}><span class="ni-workspace-profile-content"><strong>${title}</strong><span>${description}</span></span></label>`
  ).join('');
  const taxScenarioControl = taxScenarios.length
    ? `<label class="ni-workspace-field ni-optimization-tax-scenario"><span>Cenário da reforma tributária</span><select name="tax_year" data-testid="optimizer-tax-scenario">${taxScenarios
        .map(
          ([year, label]) =>
            `<option value="${year}"${year === activeTaxYear ? ' selected' : ''}>${year} · ${escapeHtml(label)}</option>`
        )
        .join(
          ''
        )}</select><small>A busca compara alternativas da malha para este ano da reforma.</small></label>`
    : '';
  const customPresets = (state.ui?.optimizer_presets || [])
    .map(
      (preset) =>
        `<option value="${escapeHtml(preset.preset_id)}">${escapeHtml(preset.name)}</option>`
    )
    .join('');
  const hasCustomPresets = (state.ui?.optimizer_presets || []).length > 0;
  const essential = [
    field(
      'min_active_cds',
      'CDs ativos mínimos',
      value(draft, 'min_active_cds', constraints.min_active_cds ?? 1),
      { min: '1' }
    ),
    field(
      'max_active_cds',
      'CDs ativos máximos',
      value(
        draft,
        'max_active_cds',
        constraints.max_active_cds ??
          selectedScenario?.changes?.active_cds?.length ??
          activeCount ??
          999
      ),
      { min: '1' }
    ),
    field(
      'max_cd_volume_share',
      'Concentração máxima por CD',
      value(draft, 'max_cd_volume_share', constraints.max_cd_volume_share ?? 0.75),
      { min: '0.01', max: '1', step: '0.01' }
    ),
    selectField(
      'max_risk_level',
      'Risco máximo',
      [
        ['low', 'Baixo'],
        ['medium', 'Moderado'],
        ['high', 'Alto'],
      ],
      value(draft, 'max_risk_level', constraints.max_risk_level || 'high')
    ),
  ].join('');
  const technical = [
    field(
      'max_candidates',
      'Candidatos máximos',
      value(draft, 'max_candidates', constraints.max_candidates ?? 2000),
      { min: '100', max: '10000', step: '100' }
    ),
    field('seed', 'Seed da busca', value(draft, 'seed', 42)),
    field('risk_iterations', 'Iterações de risco', value(draft, 'risk_iterations', 300), {
      min: '50',
      max: '5000',
      step: '50',
    }),
    field('risk_seed', 'Seed de risco', value(draft, 'risk_seed', 42)),
    selectField(
      'risk_profile',
      'Perfil de incerteza',
      [
        ['balanced', 'Equilibrado'],
        ['conservative', 'Conservador'],
        ['broad', 'Amplo'],
      ],
      value(draft, 'risk_profile', 'balanced')
    ),
    selectField(
      'risk_scatter_driver',
      'Fator de análise',
      [
        ['freight_multiplier', 'Frete'],
        ['demand_multiplier', 'Demanda'],
        ['inventory_days', 'Dias de estoque'],
        ['wacc', 'Custo de capital'],
        ...(state.context.provider_kind === 'mock' ? [] : [['tax_multiplier', 'Tributos']]),
      ],
      value(draft, 'risk_scatter_driver', 'freight_multiplier')
    ),
    selectField(
      'stress_profile',
      'Perfil de estresse',
      [
        ['standard', 'Padrão'],
        ['conservative', 'Conservador'],
      ],
      value(draft, 'stress_profile', 'standard')
    ),
    selectField(
      'sensitivity_variable',
      'Variável de sensibilidade',
      [
        ['freight_multiplier', 'Frete'],
        ['demand_multiplier', 'Demanda'],
        ['inventory_days', 'Dias de estoque'],
        ['wacc', 'Custo de capital'],
      ],
      value(draft, 'sensitivity_variable', 'freight_multiplier')
    ),
    selectField(
      'sensitivity_x',
      'Eixo horizontal',
      [
        ['freight_multiplier', 'Frete'],
        ['demand_multiplier', 'Demanda'],
        ['inventory_days', 'Dias de estoque'],
        ['wacc', 'Custo de capital'],
      ],
      value(draft, 'sensitivity_x', 'freight_multiplier')
    ),
    selectField(
      'sensitivity_y',
      'Eixo vertical',
      [
        ['demand_multiplier', 'Demanda'],
        ['freight_multiplier', 'Frete'],
        ['inventory_days', 'Dias de estoque'],
        ['wacc', 'Custo de capital'],
      ],
      value(draft, 'sensitivity_y', 'demand_multiplier')
    ),
  ].join('');
  return `<section class="ni-workspace ni-workspace-page ni-optimization" data-testid="page-optimizer-configure"><header class="ni-page-heading"><h1>Otimização</h1></header>${sectionTabs('optimizer', state.ui?.route)}<form id="niOptimizerForm" class="ni-card ni-form ni-workspace-form" data-testid="optimizer-form" novalidate>${taxScenarioControl}<fieldset class="ni-workspace-panel ni-workspace-objectives"><legend>Perfil do ranking</legend><div class="ni-workspace-profile-grid">${objectives}</div><div class="ni-optimizer-presets"><label class="ni-workspace-field"><span>Configuração salva</span><select name="custom_preset_select"${hasCustomPresets ? '' : ' disabled'}><option value="">${hasCustomPresets ? 'Carregar configuração salva' : 'Nenhum preset salvo'}</option>${customPresets}</select></label><button type="button" class="ni-button secondary" data-action="open-optimizer-preset-save" aria-expanded="false" aria-controls="optimizerPresetEditor">Salvar configuração atual</button></div><div class="ni-optimizer-preset-editor" id="optimizerPresetEditor" data-testid="optimizer-preset-editor" hidden><label class="ni-workspace-field"><span>Nome do preset</span><input name="custom_preset_name" maxlength="48" placeholder="Ex.: Fiscal conservador"></label><button type="button" class="ni-button primary" data-action="save-optimizer-preset">Salvar</button><button type="button" class="ni-button secondary" data-action="cancel-optimizer-preset-save">Cancelar</button></div></fieldset><fieldset class="ni-workspace-panel ni-workspace-restrictions"><legend>Limites operacionais</legend><div class="ni-workspace-field-grid">${essential}</div></fieldset><details class="ni-workspace-advanced"><summary>Configuração técnica</summary><div class="ni-workspace-field-grid">${technical}</div></details><div class="ni-actions"><button type="submit" class="ni-button primary" data-testid="optimizer-run">Executar otimização</button></div></form></section>`;
}
