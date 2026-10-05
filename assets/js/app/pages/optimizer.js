import { selectDecision, selectScenarios } from '../selectors/business-selectors.js';
import {
  emptyState,
  escapeHtml,
  formatBRL,
  formatNumber,
  formatPct,
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
  const presetControls = `<section class="ni-workspace-panel ni-optimizer-presets"><h2>Configurações salvas</h2><div class="ni-workspace-field-grid"><label class="ni-workspace-field"><span>Preset salvo</span><select name="custom_preset_select"${customPresets ? '' : ' disabled'}><option value="">${customPresets ? 'Selecione um preset' : 'Nenhum preset salvo'}</option>${customPresets}</select></label><label class="ni-workspace-field"><span>Ano fiscal da busca</span><select name="tax_year"><option value="">Ano do cenário ativo</option>${Array.from(
    { length: 8 },
    (_, index) => 2026 + index
  )
    .map(
      (year) =>
        `<option value="${year}"${Number(selectedTaxYear) === year ? ' selected' : ''}>${year}</option>`
    )
    .join(
      ''
    )}</select></label></div><button type="button" class="ni-button secondary" data-action="open-optimizer-preset-save" aria-expanded="false">Salvar preset</button><div id="optimizerPresetEditor" hidden><label class="ni-workspace-field"><span>Nome do preset</span><input name="custom_preset_name" type="text" maxlength="80"></label><div class="ni-actions"><button type="button" class="ni-button primary" data-action="save-optimizer-preset">Salvar</button><button type="button" class="ni-button secondary" data-action="cancel-optimizer-preset-save">Cancelar</button></div></div></section>`;
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

  return `<div class="ni-workspace ni-workspace-configure"><div class="ni-page-heading ni-workspace-heading" data-testid="page-optimizer-configure"><p class="ni-eyebrow">Otimizador · Configuração</p><h1>Configuração da otimização</h1><p>Defina o objetivo e as restrições para procurar configurações de malha logística comparáveis.</p></div>${sectionTabs('optimizer', state.ui.route)}<form id="niOptimizerForm" class="ni-card ni-form ni-workspace-form" data-testid="optimizer-form" novalidate>${presetControls}<div class="ni-workspace-config-grid"><section class="ni-workspace-panel ni-workspace-objectives" aria-labelledby="niOptimizerObjectiveTitle"><div class="ni-workspace-section-heading"><div><p class="ni-eyebrow">01 · Direção</p><h2 id="niOptimizerObjectiveTitle">Objetivo da otimização</h2><p>Escolha o critério que orienta a classificação das alternativas.</p></div></div><fieldset class="ni-workspace-profile-grid"><legend class="ni-workspace-sr-only">Perfil de otimização</legend>${profileCards}</fieldset><div class="ni-workspace-advanced"><details><summary>Parâmetros avançados de busca e risco</summary><div class="ni-workspace-advanced-content"><div class="ni-workspace-field-grid">${uncertaintyFields}${uncertaintyOptions}</div><p class="ni-note">A busca só será chamada de global quando o engine retornar <code>exact_search_space=true</code>. O modo tributário desligado permanece bloqueado pela política do projeto.</p></div></details></div></section><section class="ni-workspace-panel ni-workspace-restrictions" aria-labelledby="niOptimizerRestrictionsTitle"><div class="ni-workspace-section-heading"><div><p class="ni-eyebrow">02 · Limites</p><h2 id="niOptimizerRestrictionsTitle">Restrições</h2><p>Configure o tamanho da busca e os limites operacionais aplicados às alternativas.</p></div></div><div class="ni-workspace-field-grid">${coreFields}</div></section><section class="ni-workspace-panel ni-workspace-scope" aria-labelledby="niOptimizerScopeTitle"><div class="ni-workspace-section-heading"><div><p class="ni-eyebrow">03 · Escopo</p><h2 id="niOptimizerScopeTitle">Ponto de partida</h2><p>A execução usa a empresa e o baseline atualmente carregados.</p></div></div><dl class="ni-workspace-scope-list"><div><dt>Empresa</dt><dd>${escapeHtml(companyLabel)}</dd></div><div><dt>Baseline</dt><dd>${escapeHtml(baseline?.scenario_id || '—')}</dd></div><div><dt>CDs no baseline</dt><dd>${baselineCdCount == null ? '—' : formatNumber(baselineCdCount)}</dd></div><div><dt>Candidatos máximos</dt><dd>${formatNumber(optimizerConfig.max_candidates ?? 2000)}</dd></div><div><dt>Risco máximo</dt><dd>${escapeHtml(constraints.max_risk_level || 'Alto')}</dd></div></dl><p class="ni-workspace-scope-note">Cenários só entram no ranking quando passam pelas regras e pelos dados disponíveis na empresa selecionada.</p><button type="submit" class="ni-button primary ni-workspace-submit" data-testid="optimizer-run">Executar otimização<span aria-hidden="true"> →</span></button></section></div></form></div>`;
}

export function renderOptimizerResults(state) {
  const optimizer = selectDecision(state).optimizer;
  if (!optimizer)
    return `<div class="ni-workspace ni-workspace-results"><div class="ni-page-heading ni-workspace-heading" data-testid="page-optimizer-results"><p class="ni-eyebrow">Otimizador · Resultados</p><h1>Resultados da otimização</h1><p>Execute uma busca para comparar alternativas e avaliar a cobertura obtida.</p></div>${sectionTabs('optimizer', state.ui.route)}<div class="ni-workspace-empty">${emptyState('Execute uma busca antes de abrir os resultados.')}</div></div>`;

  const log = optimizer.search_log || {};
  const rankedScenarios = enrichOptimizerCandidates(state, optimizer.best_scenarios || []);
  const preferredScenario = rankedScenarios[0] || null;
  const rows = rankedScenarios.map(
    (row, index) =>
      `<tr><td><span class="ni-workspace-rank">${formatNumber(index + 1)}</span> ${escapeHtml(row.scenario_id)}</td><td>${escapeHtml(formatBRL(row.result?.total_with_tax))}</td><td>${formatOptionalNumber(row.final_score, 2)}</td><td>${escapeHtml(row.quality?.risk_level || '—')}</td></tr>`
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
    ? `<section class="ni-card ni-selection-card ni-workspace-manual"><div class="ni-workspace-section-heading"><div><p class="ni-eyebrow">Seleção final</p><h2>Escolher cenário manualmente</h2><p>Use a seleção manual quando a decisão exigir uma alternativa específica. O pipeline recalcula risco, evidências, QA e release para o cenário selecionado.</p></div></div><div class="ni-workspace-manual-fields"><label class="ni-workspace-field"><span>Opção do ranking</span><select id="niManualScenarioSelect" data-testid="manual-scenario-selector">${manualOptions}</select></label><label class="ni-workspace-field"><span>ID manual (opcional)</span><input id="niManualScenarioId" data-testid="manual-scenario-id" type="text" placeholder="Cole um ID elegível do ranking"></label></div><div class="ni-actions"><button type="button" class="ni-button primary" data-action="run-decision-manual">Executar decisão deste cenário</button></div></section>`
    : '';

  const preferredSummary = preferredScenario
    ? `<section class="ni-workspace-best" aria-labelledby="niOptimizerBestTitle"><div class="ni-workspace-best-main"><p class="ni-eyebrow">Melhor alternativa no ranking</p><h2 id="niOptimizerBestTitle">${escapeHtml(preferredScenario.scenario_name || preferredScenario.scenario_id || 'Cenário')}</h2><span class="ni-workspace-status">${escapeHtml(preferredScenario.scenario_id || '—')}</span></div><dl class="ni-workspace-best-metrics"><div><dt>Custo total</dt><dd>${escapeHtml(formatBRL(preferredScenario.result?.total_with_tax))}</dd></div><div><dt>Score</dt><dd>${formatOptionalNumber(preferredScenario.final_score, 2)}</dd></div><div><dt>CDs ativos</dt><dd>${formatOptionalNumber(getScenarioCdCount(preferredScenario))}</dd></div><div><dt>Risco</dt><dd>${escapeHtml(preferredScenario.quality?.risk_level || '—')}</dd></div></dl></section>`
    : `<section class="ni-workspace-best ni-workspace-best-empty"><p class="ni-eyebrow">Melhor alternativa no ranking</p><h2>Nenhum cenário elegível</h2><p>Revise as restrições e os dados de entrada antes de executar uma nova busca.</p></section>`;
  const whyWinner = `<section class="ni-workspace-explanation"><p class="ni-eyebrow">Leitura da busca</p><h2>Por que este resultado merece atenção</h2><div class="ni-workspace-reason-grid"><article><span class="ni-workspace-reason-index">01</span><strong>Objetivo aplicado</strong><p>O ranking segue o perfil e os pesos definidos para esta execução.</p></article><article><span class="ni-workspace-reason-index">02</span><strong>Cobertura observada</strong><p>${log.coverage_ratio == null ? 'A cobertura não foi informada pelo mecanismo de busca.' : `A busca reportou cobertura de ${escapeHtml(formatPct(log.coverage_ratio * 100))}.`}</p></article><article><span class="ni-workspace-reason-index">03</span><strong>Escopo da evidência</strong><p>${escapeHtml(optimizer.result_scope || 'O escopo não foi informado pelo mecanismo de busca.')}</p></article></div></section>`;

  const exactSearchValue =
    log.exact_search_space == null ? '—' : log.exact_search_space ? 'Sim' : 'Não';
  return `<div class="ni-workspace ni-workspace-results"><div class="ni-page-heading ni-workspace-heading" data-testid="page-optimizer-results"><p class="ni-eyebrow">Otimizador · Resultados</p><h1>Resultados da otimização</h1><p>${escapeHtml(optimizer.result_scope || 'Compare as alternativas avaliadas e confirme os limites da busca.')}</p></div>${sectionTabs('optimizer', state.ui.route)}<div class="ni-workspace-status-strip">${kpi('Status da busca', optimizer.optimizer_status || '—')}${kpi('Cobertura', log.coverage_ratio == null ? '—' : formatPct(log.coverage_ratio * 100))}${kpi('Espaço exato', exactSearchValue)}${kpi('Candidatos simulados', formatOptionalNumber(log.simulated_candidates))}</div>${preferredSummary}${whyWinner}<section class="ni-workspace-ranking" data-testid="optimizer-ranking"><div class="ni-workspace-section-heading"><div><p class="ni-eyebrow">Ranking · ${formatNumber(rankedScenarios.length)} alternativas</p><h2>Melhores cenários encontrados</h2><p>Compare custo, score e nível de risco antes de encaminhar uma decisão.</p></div></div>${table(['Cenário', 'Custo total', 'Score', 'Risco'], rows, 'Nenhum cenário elegível.')}</section>${manualSelection}<div class="ni-actions ni-workspace-actions"><a class="ni-button secondary" href="#/network/optimizer/tradeoffs" data-route="#/network/optimizer/tradeoffs">Explorar trade-offs</a><a class="ni-button primary" href="#/network/trust/validation" data-route="#/network/trust/validation">Ver validação da decisão</a></div></div>`;
}

export function renderOptimizerTradeoffs(state) {
  const optimizer = selectDecision(state).optimizer;
  if (!optimizer)
    return `<div class="ni-workspace ni-workspace-tradeoffs"><div class="ni-page-heading ni-workspace-heading" data-testid="page-optimizer-tradeoffs"><p class="ni-eyebrow">Otimizador · Trade-offs</p><h1>Trade-offs de custo e score</h1><p>Explore o posicionamento das alternativas avaliadas.</p></div>${sectionTabs('optimizer', state.ui.route)}<div class="ni-workspace-empty">${emptyState('Execute o otimizador antes de abrir a fronteira.')}</div></div>`;

  const rankedScenarios = enrichOptimizerCandidates(state, optimizer.best_scenarios || []);
  const candidates = enrichOptimizerCandidates(
    state,
    optimizer.scored_scenarios?.length ? optimizer.scored_scenarios : optimizer.best_scenarios || []
  );
  const preferredScenario = rankedScenarios[0] || null;
  const rows = rankedScenarios.map(
    (row) =>
      `<tr><td>${escapeHtml(row.scenario_id)}</td><td>${escapeHtml(formatBRL(row.result?.total_with_tax))}</td><td>${formatOptionalNumber(row.final_score, 2)}</td><td>${escapeHtml(row.data_quality?.decision_use || '—')}</td></tr>`
  );
  const activeCdCount = getScenarioCdCount(preferredScenario);
  const scenarioDetails = preferredScenario
    ? `<aside class="ni-workspace-detail-card"><div class="ni-workspace-section-heading"><div><p class="ni-eyebrow">Cenário em destaque</p><h2>${escapeHtml(preferredScenario.scenario_name || preferredScenario.scenario_id || '—')}</h2></div><span class="ni-workspace-status">${escapeHtml(preferredScenario.scenario_id || '—')}</span></div><dl class="ni-workspace-detail-metrics"><div><dt>Custo total</dt><dd>${escapeHtml(formatBRL(preferredScenario.result?.total_with_tax))}</dd></div><div><dt>Qualidade</dt><dd>${preferredScenario.quality?.quality_score == null ? '—' : escapeHtml(formatNumber(preferredScenario.quality.quality_score, 1))}</dd></div><div><dt>Risco</dt><dd>${escapeHtml(preferredScenario.quality?.risk_level || '—')}</dd></div><div><dt>CDs ativos</dt><dd>${activeCdCount == null ? '—' : escapeHtml(formatNumber(activeCdCount))}</dd></div><div><dt>Uso dos dados</dt><dd>${escapeHtml(preferredScenario.data_quality?.decision_use || '—')}</dd></div></dl></aside>`
    : `<aside class="ni-workspace-detail-card"><p class="ni-eyebrow">Cenário em destaque</p><h2>Sem cenário recomendado</h2><p>Não há uma alternativa classificada para detalhar.</p></aside>`;

  const hasQuality = candidates.some(
    (row) =>
      row.quality?.quality_score != null && Number.isFinite(Number(row.quality.quality_score))
  );
  const qualityLabel = hasQuality ? 'score de qualidade' : 'score final do ranking';
  const tradeoffPointCount = candidates.filter((row) => {
    const y = hasQuality ? row.quality?.quality_score : row.final_score;
    return (
      row.result?.total_with_tax != null &&
      Number.isFinite(Number(row.result.total_with_tax)) &&
      y != null &&
      Number.isFinite(Number(y))
    );
  }).length;
  return `<div class="ni-workspace ni-workspace-tradeoffs"><div class="ni-page-heading ni-workspace-heading" data-testid="page-optimizer-tradeoffs"><p class="ni-eyebrow">Otimizador · Trade-offs</p><h1>Trade-offs: custo e ${qualityLabel}</h1><p>Alternativas avaliadas nesta busca.</p></div>${sectionTabs('optimizer', state.ui.route)}<div class="ni-workspace-tradeoff-grid"><section class="ni-workspace-chart-card">${tradeoffPointCount ? '<canvas id="niDecisionOptimizerFrontierChart" class="ni-chart" role="img" aria-label="Gráfico interativo de custo total e métrica de qualidade disponível"></canvas>' : '<p class="ni-workspace-chart-empty" role="status">Sem candidatos com custo e score válidos nesta execução.</p>'}<p class="ni-workspace-footnote">${hasQuality ? 'Pontuação de qualidade calculada; não é uma medição observada de nível de serviço.' : 'Pontuação usada para ordenar a busca; não é uma medição observada de nível de serviço.'}</p></section>${scenarioDetails}</div><section class="ni-workspace-ranking ni-workspace-tradeoff-table"><div class="ni-workspace-section-heading"><div><p class="ni-eyebrow">Alternativas classificadas</p><h2>Melhores cenários</h2></div></div>${table(['Cenário', 'Custo total', 'Score', 'Uso dos dados'], rows, 'Nenhum candidato disponível.')}</section></div>`;
}
