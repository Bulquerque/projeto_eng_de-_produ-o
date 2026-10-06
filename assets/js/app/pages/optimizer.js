import { selectDecision, selectScenarios } from '../selectors/business-selectors.js';
import {
  emptyState,
  escapeHtml,
  formatBRL,
  formatNumber,
  kpi,
  sectionTabs,
  table,
} from '../view-helpers.js';

const OBJECTIVE_PROFILES = [
  {
    value: 'balanced',
    label: 'Equilibrado',
    description: 'Pondera custo, serviço, risco, tributos e estoque.',
  },
  {
    value: 'cfo',
    label: 'Eficiência financeira',
    description: 'Dá prioridade ao custo total, impacto fiscal e capital.',
  },
  {
    value: 'supply',
    label: 'Continuidade operacional',
    description: 'Valoriza nível de serviço, qualidade e risco.',
  },
  {
    value: 'fiscal',
    label: 'Eficiência fiscal',
    description: 'Dá maior peso ao impacto tributário da configuração.',
  },
  {
    value: 'conservative',
    label: 'Conservador',
    description: 'Prefere risco menor e qualidade, mesmo com menos saving.',
  },
];

const UNCERTAINTY_FIELDS = [
  ['risk_iterations', 'Iterações Monte Carlo', '50', '5000', '50', '300'],
  ['risk_seed', 'Seed Monte Carlo', undefined, undefined, '1', '42'],
];

const UNCERTAINTY_OPTIONS = [
  [
    'risk_profile',
    'Perfil de incerteza',
    [
      ['balanced', 'Equilibrado'],
      ['conservative', 'Conservador'],
      ['broad', 'Amplo'],
    ],
  ],
  [
    'risk_scatter_driver',
    'Driver do scatter',
    [
      ['freight_multiplier', 'Frete'],
      ['demand_multiplier', 'Demanda'],
      ['inventory_days', 'Dias de estoque'],
      ['wacc', 'WACC'],
      ['tax_multiplier', 'Tributo'],
    ],
  ],
  [
    'stress_profile',
    'Perfil de stress',
    [
      ['standard', 'Padrão'],
      ['conservative', 'Conservador'],
    ],
  ],
  [
    'sensitivity_variable',
    'Variável de sensibilidade',
    [
      ['freight_multiplier', 'Frete'],
      ['demand_multiplier', 'Demanda'],
      ['inventory_days', 'Dias de estoque'],
      ['wacc', 'WACC'],
    ],
  ],
  [
    'sensitivity_x',
    'Eixo X da matriz',
    [
      ['freight_multiplier', 'Frete'],
      ['demand_multiplier', 'Demanda'],
      ['inventory_days', 'Dias de estoque'],
      ['wacc', 'WACC'],
    ],
  ],
  [
    'sensitivity_y',
    'Eixo Y da matriz',
    [
      ['demand_multiplier', 'Demanda'],
      ['freight_multiplier', 'Frete'],
      ['inventory_days', 'Dias de estoque'],
      ['wacc', 'WACC'],
    ],
  ],
];

function renderSelect(name, label, options, selectedValue) {
  const selected = selectedValue == null ? options[0]?.[0] : String(selectedValue);
  return `<label class="ni-workspace-field"><span>${label}</span><select name="${name}">${options
    .map(
      ([value, optionLabel]) =>
        `<option value="${escapeHtml(value)}"${String(value) === selected ? ' selected' : ''}>${escapeHtml(optionLabel)}</option>`
    )
    .join('')}</select></label>`;
}

function renderNumberField(name, label, value, { min, max, step = '1', required = true } = {}) {
  const bounds = `${min == null ? '' : ` min="${escapeHtml(min)}"`}${max == null ? '' : ` max="${escapeHtml(max)}"`}`;
  return `<label class="ni-workspace-field"><span>${label}</span><input name="${name}" type="number"${bounds} step="${escapeHtml(step)}" value="${escapeHtml(value)}"${required ? ' required' : ''}></label>`;
}

function getScenarioCdCount(scenario) {
  return (
    scenario?.scenario?.changes?.active_cds?.length ??
    scenario?.changes?.active_cds?.length ??
    scenario?.active_cds?.length ??
    null
  );
}

function formatOptionalNumber(value, digits = 0) {
  return value == null ? '—' : escapeHtml(formatNumber(value, digits));
}

function optimizerLabel(value) {
  const labels = {
    success: 'Concluído',
    success_with_limited_space: 'Concluído · busca limitada',
    exact_declared_space: 'Espaço declarado integralmente',
    conditional_declared_catalog: 'Catálogo declarado sob condições',
    exploratory_only: 'Exploratório',
    low: 'Baixo',
    medium: 'Médio',
    high: 'Alto',
  };
  return labels[value] || value || '—';
}

function enrichOptimizerCandidates(state, candidates = []) {
  const companyId = state.context?.company_id;
  const scenarioById = new Map(
    selectScenarios(state)
      .filter((scenario) => scenario.company_id === companyId)
      .map((scenario) => [scenario.scenario_id, scenario])
  );
  return candidates
    .filter((candidate) => !candidate.company_id || candidate.company_id === companyId)
    .map((candidate) => {
      const scenario = scenarioById.get(candidate.scenario_id);
      const candidateResult = candidate.result;
      const resultIsSameCompany =
        candidateResult &&
        (!candidateResult.company_id || candidateResult.company_id === companyId);
      const storedResult =
        scenario?.company_id === companyId &&
        (!scenario.result?.company_id || scenario.result.company_id === companyId)
          ? scenario.result
          : null;
      return {
        ...scenario,
        ...candidate,
        result: resultIsSameCompany ? candidateResult : storedResult,
        scenario: candidate.scenario || scenario,
        scenario_name:
          candidate.scenario_name || scenario?.scenario_name || scenario?.result?.scenario_name,
        quality: candidate.quality || scenario?.quality,
        data_quality: candidate.data_quality || scenario?.result?.data_quality,
      };
    });
}

function renderAppliedOptimizerConfig(state, optimizer) {
  const config = state.ui.optimizer_config || optimizer?.requested_config || {};
  const nestedConfig = config.optimizer_config || config;
  const constraints = config.constraints || optimizer?.constraints || {};
  const profiles = Object.fromEntries(OBJECTIVE_PROFILES.map(({ value, label }) => [value, label]));
  const profile = config.profile_id || optimizer?.objective?.profile_id || '—';
  const details = [
    ['Perfil', profiles[profile] || profile],
    ['Limite de candidatos', nestedConfig.max_candidates],
    ['Seed da busca', nestedConfig.seed],
    [
      'CDs ativos',
      constraints.min_active_cds == null && constraints.max_active_cds == null
        ? null
        : `${constraints.min_active_cds ?? '—'} a ${constraints.max_active_cds ?? '—'}`,
    ],
    ['Risco máximo', optimizerLabel(constraints.max_risk_level)],
  ].filter(([, value]) => value != null && value !== '');
  if (!details.length) return '';
  return `<section class="ni-workspace-detail-card ni-workspace-config-summary" aria-label="Configuração aplicada"><p class="ni-eyebrow">Contexto da busca</p><dl class="ni-workspace-detail-metrics">${details
    .map(
      ([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
    )
    .join('')}</dl></section>`;
}

export function renderOptimizerConfigure(state) {
  const lastConfig = state.ui.optimizer_config || state.data.optimizer?.requested_config || {};
  const constraints = lastConfig.constraints || state.data.optimizer?.constraints || {};
  const optimizerConfig = lastConfig.optimizer_config || lastConfig;
  const riskConfig = state.ui.risk_config || lastConfig.risk_config || {};
  const baseline = state.data.baseline?.model;
  const baselineCdCount = Array.isArray(baseline?.active_cds) ? baseline.active_cds.length : null;
  const companyId = state.context?.company_id || '—';
  const companyLabel =
    companyId === 'empresa1'
      ? 'Empresa 1'
      : companyId === 'empresa2'
        ? 'Empresa 2'
        : companyId === 'empresa_mock'
          ? 'Empresa Falsa'
          : companyId;
  const selectedTaxYear =
    Number(state.ui.scenario_draft?.changes?.tax_year || lastConfig.tax_year) || '';
  const customPresets = (state.ui.optimizer_presets || [])
    .map(
      (preset) =>
        `<option value="${escapeHtml(preset.preset_id)}">${escapeHtml(preset.name || preset.preset_id)}</option>`
    )
    .join('');
  const presetControls = `<details class="ni-workspace-panel ni-optimizer-presets"><summary>Presets e ano fiscal</summary><div class="ni-workspace-field-grid"><label class="ni-workspace-field"><span>Preset salvo</span><select name="custom_preset_select"${customPresets ? '' : ' disabled'}><option value="">${customPresets ? 'Selecione um preset' : 'Nenhum preset salvo'}</option>${customPresets}</select></label><label class="ni-workspace-field"><span>Ano fiscal da busca</span><select name="tax_year"><option value="">Ano do cenário ativo</option>${Array.from(
    { length: 8 },
    (_, index) => 2026 + index
  )
    .map(
      (year) =>
        `<option value="${year}"${Number(selectedTaxYear) === year ? ' selected' : ''}>${year}</option>`
    )
    .join(
      ''
    )}</select></label></div><button type="button" class="ni-button secondary" data-action="open-optimizer-preset-save" aria-expanded="false">Salvar preset</button><div id="optimizerPresetEditor" hidden><label class="ni-workspace-field"><span>Nome do preset</span><input name="custom_preset_name" type="text" maxlength="80"></label><div class="ni-actions"><button type="button" class="ni-button primary" data-action="save-optimizer-preset">Salvar</button><button type="button" class="ni-button secondary" data-action="cancel-optimizer-preset-save">Cancelar</button></div></div></details>`;
  const selectedProfile =
    lastConfig.profile_id ||
    state.data.optimizer?.objective?.profile_id ||
    state.data.optimizer?.objective?.source_profile ||
    'balanced';
  const profileCards = OBJECTIVE_PROFILES.map(
    ({ value, label, description }) =>
      `<label class="ni-workspace-profile"><input type="radio" name="profile_id" value="${value}"${value === selectedProfile ? ' checked' : ''}><span class="ni-workspace-profile-content"><strong>${label}</strong><span>${description}</span></span></label>`
  ).join('');
  const coreFields = [
    renderNumberField(
      'max_candidates',
      'Candidatos máximos',
      optimizerConfig.max_candidates ?? 2000,
      {
        min: '100',
        max: '10000',
        step: '100',
      }
    ),
    renderNumberField('seed', 'Seed da busca', optimizerConfig.seed ?? 42),
    renderNumberField('min_active_cds', 'CDs ativos mínimos', constraints.min_active_cds ?? 1, {
      min: '1',
    }),
    renderNumberField('max_active_cds', 'CDs ativos máximos', constraints.max_active_cds ?? 999, {
      min: '1',
    }),
    renderNumberField(
      'max_cd_volume_share',
      'Concentração máxima por CD',
      constraints.max_cd_volume_share ?? 0.75,
      { min: '0.01', max: '1', step: '0.01' }
    ),
    renderSelect(
      'max_risk_level',
      'Nível de risco máximo',
      [
        ['low', 'Baixo'],
        ['medium', 'Médio'],
        ['high', 'Alto'],
      ],
      constraints.max_risk_level || 'high'
    ),
  ].join('');
  const uncertaintyFields = UNCERTAINTY_FIELDS.map(([name, label, min, max, step, fallback]) => {
    const value =
      name === 'risk_iterations'
        ? (riskConfig.iterations ?? fallback)
        : (riskConfig.seed ?? fallback);
    return renderNumberField(name, label, value, { min, max, step, required: false });
  }).join('');
  const uncertaintyOptions = UNCERTAINTY_OPTIONS.map(([name, label, options]) => {
    const configKey = name.replace(/^risk_/, '');
    const selected =
      riskConfig[configKey] ||
      riskConfig[name] ||
      (name === 'stress_profile' ? 'standard' : options[0]?.[0]);
    return renderSelect(name, label, options, selected);
  }).join('');

  return `<div class="ni-workspace ni-workspace-configure"><div class="ni-page-heading ni-workspace-heading" data-testid="page-optimizer-configure"><p class="ni-eyebrow">Avaliação de alternativas · Configuração</p><h1>Avaliar alternativas</h1><p>Escolha o perfil e classifique configurações de malha logística.</p></div>${sectionTabs('optimizer', state.ui.route)}<form id="niOptimizerForm" class="ni-card ni-form ni-workspace-form" data-testid="optimizer-form" novalidate><section class="ni-workspace-panel ni-workspace-objectives" aria-labelledby="niOptimizerObjectiveTitle"><div class="ni-workspace-section-heading"><div><p class="ni-eyebrow">Critério</p><h2 id="niOptimizerObjectiveTitle">Perfil de avaliação</h2></div></div><fieldset class="ni-workspace-profile-grid"><legend class="ni-workspace-sr-only">Perfil de avaliação</legend>${profileCards}</fieldset><button type="submit" class="ni-button primary ni-workspace-submit" data-testid="optimizer-run">Avaliar alternativas<span aria-hidden="true"> →</span></button></section><details class="ni-workspace-panel ni-workspace-restrictions"><summary>Restrições da busca</summary><p>Limites aplicados às alternativas avaliadas.</p><div class="ni-workspace-field-grid">${coreFields}</div></details><details class="ni-workspace-panel ni-workspace-scope"><summary>Escopo desta avaliação</summary><p>A execução usa a empresa e o baseline atualmente carregados. Só entram no ranking cenários compatíveis com os dados e as regras.</p><dl class="ni-workspace-scope-list"><div><dt>Empresa</dt><dd>${escapeHtml(companyLabel)}</dd></div><div><dt>Baseline</dt><dd>${escapeHtml(baseline?.scenario_id || '—')}</dd></div><div><dt>CDs no baseline</dt><dd>${baselineCdCount == null ? '—' : formatNumber(baselineCdCount)}</dd></div></dl></details>${presetControls}<details class="ni-workspace-advanced"><summary>Parâmetros avançados de busca e risco</summary><div class="ni-workspace-advanced-content"><div class="ni-workspace-field-grid">${uncertaintyFields}${uncertaintyOptions}</div><p class="ni-note">A busca cobre todo o espaço declarado apenas quando o mecanismo confirma <code>exact_search_space=true</code> e cobertura completa. O modo tributário desligado permanece bloqueado pela política do projeto.</p></div></details></form></div>`;
}

export function renderOptimizerResults(state) {
  const optimizer = selectDecision(state).optimizer;
  if (!optimizer)
    return `<div class="ni-workspace ni-workspace-results"><div class="ni-page-heading ni-workspace-heading" data-testid="page-optimizer-results"><p class="ni-eyebrow">Avaliação de alternativas · Resultados</p><h1>Ranking da avaliação</h1><p>Compare as alternativas classificadas nesta busca.</p></div>${sectionTabs('optimizer', state.ui.route)}<div class="ni-workspace-empty">${emptyState('Execute a avaliação para comparar as alternativas.')}</div></div>`;

  const log = optimizer.search_log || {};
  const rankedScenarios = enrichOptimizerCandidates(state, optimizer.best_scenarios || []);
  const preferredScenario = rankedScenarios[0] || null;
  const rows = rankedScenarios.map(
    (row, index) =>
      `<tr><td><span class="ni-workspace-rank">${formatNumber(index + 1)}</span> ${escapeHtml(row.scenario_name || row.scenario?.scenario_name || row.scenario_id)}</td><td>${escapeHtml(formatBRL(row.result?.total_with_tax))}</td><td>${formatOptionalNumber(row.final_score, 2)}</td><td>${escapeHtml(optimizerLabel(row.quality?.risk_level))}</td></tr>`
  );
  const candidates = enrichOptimizerCandidates(
    state,
    optimizer.scored_scenarios?.length ? optimizer.scored_scenarios : optimizer.best_scenarios || []
  );
  const manualOptions = candidates
    .slice(0, 200)
    .map(
      (row) =>
        `<option value="${escapeHtml(row.scenario_id)}">${escapeHtml(row.scenario_name || row.scenario_id)}</option>`
    )
    .join('');
  const manualSelection = candidates.length
    ? `<section class="ni-card ni-selection-card ni-workspace-manual"><div class="ni-workspace-section-heading"><div><p class="ni-eyebrow">Seleção final</p><h2>Escolher alternativa</h2><p>Selecione uma alternativa do ranking para encaminhar a decisão.</p></div></div><div class="ni-workspace-manual-fields"><label class="ni-workspace-field"><span>Opção do ranking</span><select id="niManualScenarioSelect" data-testid="manual-scenario-selector">${manualOptions}</select></label><label class="ni-workspace-field"><span>ID manual (opcional)</span><input id="niManualScenarioId" data-testid="manual-scenario-id" type="text" placeholder="Cole um ID elegível do ranking"></label></div><div class="ni-actions"><button type="button" class="ni-button primary" data-action="run-decision-manual">Executar decisão</button></div></section>`
    : '';

  const preferredSummary = preferredScenario
    ? `<section class="ni-workspace-best" aria-labelledby="niOptimizerBestTitle"><div class="ni-workspace-best-main"><p class="ni-eyebrow">Alternativa mais bem classificada</p><h2 id="niOptimizerBestTitle">${escapeHtml(preferredScenario.scenario_name || preferredScenario.scenario_id || 'Cenário')}</h2></div><dl class="ni-workspace-best-metrics"><div><dt>Custo total</dt><dd>${escapeHtml(formatBRL(preferredScenario.result?.total_with_tax))}</dd></div><div><dt>Pontuação</dt><dd>${formatOptionalNumber(preferredScenario.final_score, 2)}</dd></div><div><dt>CDs ativos</dt><dd>${formatOptionalNumber(getScenarioCdCount(preferredScenario))}</dd></div><div><dt>Risco</dt><dd>${escapeHtml(optimizerLabel(preferredScenario.quality?.risk_level))}</dd></div></dl></section>`
    : `<section class="ni-workspace-best ni-workspace-best-empty"><p class="ni-eyebrow">Alternativa mais bem classificada</p><h2>Nenhum cenário elegível</h2><p>Revise as restrições e os dados de entrada antes de executar uma nova busca.</p></section>`;
  return `<div class="ni-workspace ni-workspace-results"><div class="ni-page-heading ni-workspace-heading" data-testid="page-optimizer-results"><p class="ni-eyebrow">Avaliação de alternativas · Resultados</p><h1>Ranking da avaliação</h1></div>${sectionTabs('optimizer', state.ui.route)}<div class="ni-workspace-status-strip">${kpi('Status da avaliação', optimizerLabel(optimizer.optimizer_status))}${kpi('Alternativas avaliadas', formatOptionalNumber(log.simulated_candidates))}</div>${renderAppliedOptimizerConfig(state, optimizer)}${preferredSummary}<section class="ni-workspace-chart-card ni-workspace-ranking-chart"><h2>Pontuação das melhores alternativas</h2><canvas id="niRankingChart" class="ni-chart" role="img" aria-label="Gráfico de pontuação das melhores alternativas avaliadas"></canvas></section><section class="ni-workspace-ranking" data-testid="optimizer-ranking"><div class="ni-workspace-section-heading"><div><p class="ni-eyebrow">Classificação · ${formatNumber(rankedScenarios.length)} ${rankedScenarios.length === 1 ? 'alternativa' : 'alternativas'}</p><h2>Alternativas mais bem classificadas</h2><p>Compare custo, pontuação e risco antes de encaminhar uma decisão.</p></div></div>${table(['Alternativa', 'Custo total', 'Pontuação', 'Risco'], rows, 'Nenhuma alternativa elegível.')}</section>${manualSelection}<div class="ni-actions ni-workspace-actions"><a class="ni-button secondary" href="#/network/optimizer/tradeoffs" data-route="#/network/optimizer/tradeoffs">Explorar custo × pontuação</a></div></div>`;
}

export function renderOptimizerTradeoffs(state) {
  const optimizer = selectDecision(state).optimizer;
  if (!optimizer)
    return `<div class="ni-workspace ni-workspace-tradeoffs"><div class="ni-page-heading ni-workspace-heading" data-testid="page-optimizer-tradeoffs"><p class="ni-eyebrow">Avaliação de alternativas · Trade-offs</p><h1>Compromissos entre custo e pontuação</h1><p>Explore o posicionamento das alternativas avaliadas.</p></div>${sectionTabs('optimizer', state.ui.route)}<div class="ni-workspace-empty">${emptyState('Execute a avaliação antes de comparar as alternativas.')}</div></div>`;

  const rankedScenarios = enrichOptimizerCandidates(state, optimizer.best_scenarios || []);
  const candidates = enrichOptimizerCandidates(
    state,
    optimizer.scored_scenarios?.length ? optimizer.scored_scenarios : optimizer.best_scenarios || []
  );
  const preferredScenario = rankedScenarios[0] || null;
  const rows = rankedScenarios.map(
    (row) =>
      `<tr><td>${escapeHtml(row.scenario_name || row.scenario?.scenario_name || row.scenario_id)}</td><td>${escapeHtml(formatBRL(row.result?.total_with_tax))}</td><td>${formatOptionalNumber(row.final_score, 2)}</td><td>${formatOptionalNumber(getScenarioCdCount(row))}</td></tr>`
  );
  const activeCdCount = getScenarioCdCount(preferredScenario);
  const scenarioDetails = preferredScenario
    ? `<aside class="ni-workspace-detail-card"><div class="ni-workspace-section-heading"><div><p class="ni-eyebrow">Alternativa em destaque</p><h2>${escapeHtml(preferredScenario.scenario_name || preferredScenario.scenario_id || '—')}</h2></div></div><dl class="ni-workspace-detail-metrics"><div><dt>Custo total</dt><dd>${escapeHtml(formatBRL(preferredScenario.result?.total_with_tax))}</dd></div><div><dt>Risco</dt><dd>${escapeHtml(optimizerLabel(preferredScenario.quality?.risk_level))}</dd></div><div><dt>CDs ativos</dt><dd>${activeCdCount == null ? '—' : escapeHtml(formatNumber(activeCdCount))}</dd></div></dl></aside>`
    : `<aside class="ni-workspace-detail-card"><p class="ni-eyebrow">Cenário em destaque</p><h2>Sem cenário recomendado</h2><p>Não há uma alternativa classificada para detalhar.</p></aside>`;

  const qualityLabel = 'pontuação';
  const tradeoffPointCount = candidates.filter((row) => {
    const y = row.final_score;
    return (
      row.result?.total_with_tax != null &&
      Number.isFinite(Number(row.result.total_with_tax)) &&
      y != null &&
      Number.isFinite(Number(y))
    );
  }).length;
  return `<div class="ni-workspace ni-workspace-tradeoffs"><div class="ni-page-heading ni-workspace-heading" data-testid="page-optimizer-tradeoffs"><p class="ni-eyebrow">Avaliação de alternativas · Trade-offs</p><h1>Custo × pontuação</h1></div>${sectionTabs('optimizer', state.ui.route)}${renderAppliedOptimizerConfig(state, optimizer)}<div class="ni-workspace-tradeoff-grid"><section class="ni-workspace-chart-card"><h2>Custo total × ${qualityLabel}</h2>${tradeoffPointCount ? '<canvas id="niDecisionOptimizerFrontierChart" class="ni-chart" role="img" aria-label="Gráfico interativo de custo total e pontuação"></canvas>' : '<p class="ni-workspace-chart-empty" role="status">Sem candidatos com custo e pontuação válidos nesta execução.</p>'}<p class="ni-workspace-footnote">Pontuação calculada para as alternativas.</p></section>${scenarioDetails}</div><section class="ni-workspace-ranking ni-workspace-tradeoff-table"><div class="ni-workspace-section-heading"><div><p class="ni-eyebrow">Alternativas classificadas</p><h2>Alternativas mais bem classificadas</h2></div></div>${table(['Alternativa', 'Custo total', 'Pontuação', 'CDs ativos'], rows, 'Nenhuma alternativa disponível.')}</section></div>`;
}
