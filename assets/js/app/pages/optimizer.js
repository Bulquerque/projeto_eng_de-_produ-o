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
  const draft = state.ui?.optimizer_draft || {};
  const constraints = state.data?.optimizer?.constraints || {};
  const baseline = selectBaseline(state)?.model || {};
  const activeCount = Array.isArray(baseline.active_cds) ? baseline.active_cds.length : null;
  const objectives = OBJECTIVES.map(
    ([id, title, description]) =>
      `<label class="ni-workspace-profile"><input type="radio" name="profile_id" value="${id}"${String(draft.profile_id || 'balanced') === id ? ' checked' : ''}><span class="ni-workspace-profile-content"><strong>${title}</strong><span>${description}</span></span></label>`
  ).join('');
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
      value(draft, 'max_active_cds', constraints.max_active_cds ?? activeCount ?? 999),
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
  return `<section class="ni-workspace ni-workspace-page ni-optimization" data-testid="page-optimizer-configure"><header class="ni-page-heading"><h1>Otimização</h1></header>${sectionTabs('optimizer', state.ui?.route)}<form id="niOptimizerForm" class="ni-card ni-form ni-workspace-form" data-testid="optimizer-form" novalidate><fieldset class="ni-workspace-panel ni-workspace-objectives"><legend>Objetivo</legend><div class="ni-workspace-profile-grid">${objectives}</div></fieldset><fieldset class="ni-workspace-panel ni-workspace-restrictions"><legend>Limites operacionais</legend><div class="ni-workspace-field-grid">${essential}</div></fieldset><details class="ni-workspace-advanced"><summary>Configuração técnica</summary><div class="ni-workspace-field-grid">${technical}</div></details><div class="ni-actions"><button type="submit" class="ni-button primary" data-testid="optimizer-run">Executar otimização</button></div></form></section>`;
}
