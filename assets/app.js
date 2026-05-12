/* Fase 1 — Simulador Estático de Malha Logística
   Escopo: carregamento de catálogo, separação de empresas, qualidade, paths e validação manual.
   Não implementa motor de custo/cenário ainda. */

const PATHS = {
  catalog: 'data/catalog.json',
  proof: 'data/validation/data_presence_proof.json',
  quality: 'data/data_quality_summary.json',
  finalAudit: 'data/validation/final_v6_audit_summary.json',
  pathAudit: 'data/validation/path_resolution_report.json',
  phaseTests: 'data/validation/phase_tests.json',
  workbookInventory: 'data/validation/workbook_sheet_inventory.csv'
};

const state = {
  selectedCompany: 'empresa1',
  catalog: null,
  proof: null,
  quality: null,
  finalAudit: null,
  pathAudit: null,
  phaseTests: null,
  workbookInventory: [],
  phase2Bundles: {},
  livePathResults: {},
  logs: []
};

let secureLoader = null;
let phase2TestsModulePromise = null;

const $ = (id) => document.getElementById(id);
const SHARED_DEBUG_FEED_KEY = 'visagio_shared_debug_feed';
const SHARED_DEBUG_LIMIT = 300;
const PHASE2_MANUAL_CHECKS = [
  { id: 'fase2_abri', label: 'Abri /fase-2-baseline/', detail: 'A página Baseline precisa carregar a Fase 2 corretamente.' },
  { id: 'fase2_empresa1', label: 'Selecionei Empresa 1 e vi baseline, fluxos e custos', detail: 'A Empresa 1 deve mostrar o baseline reconstruído.' },
  { id: 'fase2_benchmark_1', label: 'Confirmei que Empresa 1 está como benchmark pendente', detail: 'Não inventar Base Fit para a Empresa 1.' },
  { id: 'fase2_empresa2', label: 'Selecionei Empresa 2 e vi baseline reconstruído', detail: 'A Empresa 2 deve mostrar o workbook e seus dados.' },
  { id: 'fase2_benchmark_2', label: 'Confirmei que Empresa 2 está com benchmark pendente', detail: 'Base Fit deve continuar explícito e auditável.' },
  { id: 'fase2_total', label: 'Conferi que o total logístico fecha com as parcelas', detail: 'Transferência + distribuição + armazenagem + estoque = total logístico.' },
  { id: 'fase2_warnings', label: 'Conferi que os avisos e limitações aparecem', detail: 'Os alertas da etapa precisam ser visíveis e claros.' },
  { id: 'fase2_no_mix', label: 'Conferi que as empresas não se misturam', detail: 'Dados da Empresa 1 e 2 precisam ficar separados.' }
];

function readSharedDebugEntries() {
  try { return JSON.parse(localStorage.getItem(SHARED_DEBUG_FEED_KEY) || '[]'); }
  catch { return []; }
}

function appendSharedDebugEntry(entry) {
  try {
    const current = readSharedDebugEntries();
    current.push({
      session_id: String(entry.session_id || entry.sessionId || 'shared').replace(/[^a-zA-Z0-9_-]/g, '_'),
      timestamp: entry.timestamp || new Date().toISOString(),
      phase: String(entry.phase || 'phase1'),
      module: String(entry.module || 'main'),
      level: String(entry.level || 'info'),
      event: String(entry.event || 'event'),
      detail: entry.detail ?? {},
      error: entry.error ? {
        name: entry.error.name || 'Error',
        message: entry.error.message || String(entry.error),
        stack: entry.error.stack || null
      } : null
    });
    localStorage.setItem(SHARED_DEBUG_FEED_KEY, JSON.stringify(current.slice(-SHARED_DEBUG_LIMIT)));
  } catch {
    // Keep the local console working if shared history cannot be written.
  }
}

function renderSharedDebugFeed() {
  const feed = $('sharedDebugFeed');
  if (!feed) return;
  const entries = readSharedDebugEntries();
  if (!entries.length) {
    feed.innerHTML = '<p class="small-note">Nenhum evento compartilhado registrado.</p>';
    return;
  }
  feed.innerHTML = `<div class="debug-entry-list">${entries.slice(-80).reverse().map((entry) => {
    const detail = escapeHtml(JSON.stringify(entry.detail ?? {}, null, 2));
    const error = entry.error ? `<p class="debug-hint"><b>Erro:</b> ${escapeHtml(entry.error.message || 'erro')}</p>` : '';
    const chipClass = entry.level === 'error' ? 'status-error' : entry.level === 'warn' ? 'status-warn' : 'status-ok';
    return `<article class="debug-entry ${escapeHtml(entry.level)}"><header><strong>${escapeHtml(entry.phase === 'phase1' ? 'Validação' : entry.phase)} · ${escapeHtml(entry.module)}</strong><span class="status-chip ${chipClass}">${escapeHtml(entry.level)}</span></header><p><b>${escapeHtml(entry.event)}</b></p><pre>${detail}</pre>${error}<small>${escapeHtml(entry.timestamp)}</small></article>`;
  }).join('')}</div>`;
}

function phase2ManualChecklistKey(companyId = state.selectedCompany) {
  return `visagio_phase2_manual_checks_${companyId}`;
}

function loadPhase2ManualChecklist(companyId = state.selectedCompany) {
  try { return JSON.parse(localStorage.getItem(phase2ManualChecklistKey(companyId)) || '{}'); }
  catch { return {}; }
}

function savePhase2ManualChecklist(companyId, values) {
  localStorage.setItem(phase2ManualChecklistKey(companyId), JSON.stringify(values));
}

function renderPhase2ManualChecklist(companyId = state.selectedCompany) {
  const container = $('phase2ManualChecklist');
  const progress = $('phase2ManualProgress');
  if (!container || !progress) return;
  const values = loadPhase2ManualChecklist(companyId);
  container.innerHTML = PHASE2_MANUAL_CHECKS.map((check) => `
    <label class="check-item manual-check">
      <input type="checkbox" data-phase2-manual-check="${escapeHtml(check.id)}" ${values[check.id] ? 'checked' : ''}>
      <span>
        <span class="check-title">${escapeHtml(check.label)}</span>
        <span class="check-detail">${escapeHtml(check.detail)}</span>
      </span>
      <span class="check-result ${values[check.id] ? 'check-pass' : 'check-pending'}">${values[check.id] ? 'feito' : 'pendente'}</span>
    </label>`).join('');
  const done = PHASE2_MANUAL_CHECKS.filter((check) => values[check.id]).length;
  progress.textContent = `${done}/${PHASE2_MANUAL_CHECKS.length} checagens manuais marcadas para ${companyId}.`;
}

async function getPhase2TestsModule() {
  if (!phase2TestsModulePromise) phase2TestsModulePromise = import('./js/phase2/phase2-tests.js');
  return phase2TestsModulePromise;
}

async function renderPhase2Validation(companyId = state.selectedCompany) {
  const autoChecks = $('phase2AutoChecks');
  const summary = $('phase2CheckSummary');
  if (!autoChecks || !summary) return;

  const bundle = state.phase2Bundles[companyId];
  if (!bundle) {
    autoChecks.innerHTML = '<p class="small-note">Abra a empresa selecionada para carregar os testes da Fase 2.</p>';
    summary.innerHTML = '<span class="status-chip status-warn">aguardando desbloqueio da empresa</span>';
    renderPhase2ManualChecklist(companyId);
    return;
  }

  const { runPhase2Checks, renderChecks } = await getPhase2TestsModule();
  const checks = runPhase2Checks(bundle, companyId);
  autoChecks.innerHTML = renderChecks(checks);
  const ok = checks.filter((check) => check.pass).length;
  summary.innerHTML = `<span class="status-chip ${ok === checks.length ? 'status-ok' : 'status-error'}">${ok}/${checks.length} testes OK</span>`;
  renderPhase2ManualChecklist(companyId);
}

function log(message, data = null) {
  const time = new Date().toLocaleTimeString('pt-BR');
  const line = data ? `[${time}] ${message}: ${JSON.stringify(data)}` : `[${time}] ${message}`;
  state.logs.push(line);
  appendSharedDebugEntry({ phase: 'phase1', module: 'app', level: 'info', event: message, detail: data || {} });
  const consoleEl = $('debugConsole');
  if (consoleEl) consoleEl.textContent = state.logs.slice(-18).join('\n');
  renderSharedDebugFeed();
}

function formatNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toLocaleString('pt-BR');
  if (value === true) return 'sim';
  if (value === false) return 'não';
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function statusClass(ok, warn = false) {
  if (ok) return 'status-ok';
  if (warn) return 'status-warn';
  return 'status-error';
}

function statusChip(label, ok = true, warn = false) {
  return `<span class="status-chip ${statusClass(ok, warn)}">${escapeHtml(label)}</span>`;
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Falha ao carregar ${path}: HTTP ${response.status}`);
  return response.json();
}

async function fetchText(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Falha ao carregar ${path}: HTTP ${response.status}`);
  return response.text();
}

function parseCsv(text) {
  const rows = [];
  let current = [];
  let cell = '';
  let insideQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (insideQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      current.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      current.push(cell);
      if (current.some((v) => v !== '')) rows.push(current);
      current = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell.length || current.length) {
    current.push(cell);
    if (current.some((v) => v !== '')) rows.push(current);
  }
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = row[idx] ?? ''; });
    return obj;
  });
}

function renderTable(rows, columns, options = {}) {
  if (!rows || !rows.length) return '<p class="small-note">Sem registros para exibir.</p>';
  const limit = options.limit || rows.length;
  const visibleRows = rows.slice(0, limit);
  const suffix = rows.length > limit ? `<p class="small-note">Mostrando ${limit} de ${rows.length} registros.</p>` : '';
  return `<table><thead><tr>${columns.map((col) => `<th>${escapeHtml(col.label || col.key)}</th>`).join('')}</tr></thead><tbody>${visibleRows.map((row) => `<tr>${columns.map((col) => {
    const raw = typeof col.value === 'function' ? col.value(row) : row[col.key];
    const cls = col.isPath ? ' class="path-cell"' : '';
    return `<td${cls}>${escapeHtml(formatNumber(raw))}</td>`;
  }).join('')}</tr>`).join('')}</tbody></table>${suffix}`;
}

function getCompany() {
  return state.catalog?.companies?.[state.selectedCompany] || null;
}

function getCompanyQuality(companyId = state.selectedCompany) {
  return state.quality?.companies?.[companyId] || {};
}

function compactPath(path) {
  return path || '—';
}

function companyShortDescription(companyId) {
  if (companyId === 'empresa1') return 'Demanda + Distância + Premissas Gerais';
  return 'Workbook de malha + custos + cenário + tributário';
}

function sumRows(files = []) {
  return files.reduce((acc, file) => acc + (Number(file.rows) || 0), 0);
}

function renderHero() {
  $('packageName').textContent = state.catalog.package || '—';
  $('packageVersion').textContent = state.catalog.version || '—';
  $('generatedAt').textContent = state.catalog.generated_at_utc || '—';
  $('heroStatus').textContent = 'Fase 1 carregada';
  $('heroStatus').className = 'status-chip status-ok';
}

function renderProofCards() {
  const proof = state.proof || {};
  const e1 = proof.empresa1_minimum_required_data || {};
  const e2 = proof.empresa2_minimum_required_data || {};
  const pathAudit = state.pathAudit || {};
  const missingPaths = pathAudit.missing_paths || [];
  const colors = proof.visagio_palette_from_uploaded_pptx?.colors || [];

  const html = [
    `<article class="card">
      ${statusChip('HTML/CSS/JS', true)}
      <h3>Site estático ativo</h3>
      <div class="metric-value">${document.querySelectorAll('script[src]').length + document.querySelectorAll('link[rel="stylesheet"]').length + 1}</div>
      <div class="metric-label">arquivos front-end carregados</div>
      <p class="metric-note">index.html, ${Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.getAttribute('href').split('/').pop()).join(', ')} e ${Array.from(document.querySelectorAll('script[src]')).map(s => s.getAttribute('src').split('/').pop()).join(', ')}.</p>
    </article>`,
    `<article class="card">
      ${statusChip('Empresa 1', true)}
      <h3>Base mínima presente</h3>
      <div class="metric-value">${formatNumber(e1.demand_records_rows || 0)}</div>
      <div class="metric-label">linhas de demanda</div>
      <p class="metric-note">${formatNumber(e1.distance_matrix_rows || 0)} rotas, ${formatNumber(e1.premissas_rows || 0)} premissas, ${formatNumber(e1.demand_ufs || 0)} UFs com demanda.</p>
    </article>`,
    `<article class="card">
      ${statusChip('Empresa 2', true)}
      <h3>Workbook mapeado</h3>
      <div class="metric-value">${formatNumber(e2.workbook_sheets || 0)}</div>
      <div class="metric-label">abas por workbook</div>
      <p class="metric-note">${formatNumber(Object.keys(e2.core_tables || {}).length)} tabelas core, incluindo cenário em blocos.</p>
    </article>`,
    `<article class="card">
      ${statusChip(missingPaths.length ? 'atenção' : 'paths OK', !missingPaths.length, !!missingPaths.length)}
      <h3>Caminhos declarados</h3>
      <div class="metric-value">${formatNumber(pathAudit.path_count_checked || 0)}</div>
      <div class="metric-label">paths checados no pacote</div>
      <p class="metric-note">Faltantes: ${formatNumber(missingPaths.length)}.</p>
    </article>`,
    `<article class="card">
      ${statusChip('Paleta Visagio', true)}
      <h3>Cores institucionais</h3>
      <div class="palette-row">${colors.map((c) => `<span title="${escapeHtml(c)}" style="background:${escapeHtml(c)}"></span>`).join('')}</div>
      <p class="metric-note">Paleta preservada no CSS da Fase 1.</p>
    </article>`
  ];
  $('proofCards').innerHTML = html.join('');
}

function renderCompanySelector() {
  document.querySelectorAll('[data-company]').forEach((button) => {
    const isActive = button.dataset.company === state.selectedCompany;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
}

function renderCompanyPanel() {
  const company = getCompany();
  if (!company) return;
  const coreFiles = company.core_files || [];
  const quality = getCompanyQuality();
  const sources = company.source_workbooks || [];

  $('companyStatus').textContent = state.selectedCompany === 'empresa1' ? 'empresa 1 isolada' : 'empresa 2 isolada';
  $('companyStatus').className = 'status-chip status-ok';
  $('companyTitle').textContent = `${company.label} — ${companyShortDescription(state.selectedCompany)}`;
  $('companyRule').textContent = company.separation_rule || 'Regra de separação não informada.';

  $('companyMiniMetrics').innerHTML = `
    <div class="mini-card"><strong>${formatNumber(coreFiles.length)}</strong><span>datasets core</span></div>
    <div class="mini-card"><strong>${formatNumber(sumRows(coreFiles))}</strong><span>linhas declaradas</span></div>
    <div class="mini-card"><strong>${formatNumber(sources.length)}</strong><span>workbooks fonte</span></div>
    <div class="mini-card"><strong>${formatNumber((quality.required_sources || sources).length || 0)}</strong><span>fontes requeridas</span></div>
  `;

  $('companySources').innerHTML = sources.map((source) => `
    <div class="source-item">
      <b>${escapeHtml(source.filename || source.source_id)}</b>
      <small>${escapeHtml(source.source_path || 'sem source_path')}</small>
      <small>abas: ${formatNumber(source.sheet_count)} · export: ${escapeHtml(source.source_export_dir || '—')}</small>
    </div>`).join('') || '<p class="small-note">Sem fontes listadas.</p>';

  $('datasetCards').innerHTML = coreFiles.map((file) => {
    const hasPath = Boolean(file.csv || file.json);
    const live = state.livePathResults[file.id];
    const liveText = live ? (live.ok ? 'path vivo OK' : 'path vivo falhou') : 'não checado ao vivo';
    return `<article class="dataset-card" data-dataset-id="${escapeHtml(file.id)}">
      ${statusChip(liveText, live ? live.ok : hasPath, !live && hasPath)}
      <h4>${escapeHtml(file.id)}</h4>
      <p>${escapeHtml(file.description || 'Sem descrição.')}</p>
      <div class="dataset-meta">
        <span>${formatNumber(file.rows)} linhas</span>
        <span>${formatNumber(file.columns)} colunas</span>
        ${file.sheet ? `<span>aba: ${escapeHtml(file.sheet)}</span>` : ''}
      </div>
      ${file.csv ? `<div class="path-line">CSV: ${escapeHtml(file.csv)}</div>` : ''}
      ${file.json ? `<div class="path-line">JSON: ${escapeHtml(file.json)}</div>` : ''}
    </article>`;
  }).join('');

  $('datasetTable').innerHTML = renderTable(coreFiles, [
    { key: 'id', label: 'Dataset' },
    { key: 'sheet', label: 'Aba' },
    { key: 'rows', label: 'Linhas' },
    { key: 'columns', label: 'Colunas' },
    { key: 'csv', label: 'CSV', isPath: true },
    { key: 'json', label: 'JSON', isPath: true },
    { key: 'description', label: 'Uso' }
  ]);
}

function renderDataQualityPanel() {
  const company = getCompany();
  const quality = getCompanyQuality();
  const required = quality.required_sources || company?.source_workbooks?.map((s) => s.filename) || [];
  const core = quality.core_files || company?.core_files || [];
  const errors = quality.errors || quality.data_errors || [];
  const warnings = quality.warnings || quality.data_warnings || [];
  const score = quality.data_quality_score ?? (errors.length ? 70 : warnings.length ? 88 : 100);
  const statusOk = errors.length === 0;

  $('dataQualityPanel').innerHTML = `
    ${statusChip(statusOk ? 'qualidade OK' : 'tem erros', statusOk, warnings.length > 0)}
    <h3>Qualidade dos dados — ${escapeHtml(company?.label || '')}</h3>
    <div class="metric-value">${formatNumber(score)}/100</div>
    <div class="metric-label">score aproximado da Fase 1</div>
    <div class="mini-metrics">
      <div class="mini-card"><strong>${formatNumber(required.length)}</strong><span>fontes requeridas</span></div>
      <div class="mini-card"><strong>${formatNumber(core.length)}</strong><span>arquivos core</span></div>
      <div class="mini-card"><strong>${formatNumber(errors.length)}</strong><span>erros</span></div>
      <div class="mini-card"><strong>${formatNumber(warnings.length)}</strong><span>warnings</span></div>
    </div>
    <details class="details-card" open>
      <summary>Fontes e alertas</summary>
      <p><b>Fontes:</b> ${required.map(escapeHtml).join(', ') || '—'}</p>
      ${warnings.length ? `<p><b>Warnings:</b> ${warnings.map(escapeHtml).join(', ')}</p>` : '<p><b>Warnings:</b> nenhum warning crítico declarado.</p>'}
      ${errors.length ? `<p><b>Erros:</b> ${errors.map(escapeHtml).join(', ')}</p>` : '<p><b>Erros:</b> nenhum erro declarado.</p>'}
    </details>
  `;
}

function renderPathAuditPanel() {
  const audit = state.pathAudit || {};
  const finalAudit = state.finalAudit || {};
  const missing = audit.missing_paths || finalAudit.missing_paths || [];
  const resultOk = missing.length === 0 && ['OK', true, 'FINAL_DEEP_AUDIT_OK'].includes(audit.result || true);
  const scenarioBlocks = state.proof?.empresa2_minimum_required_data?.core_tables?.scenario_blocks || 0;
  const scenarioTotals = state.proof?.empresa2_minimum_required_data?.core_tables?.scenario_totals || 0;
  const checked = audit.path_count_checked || finalAudit.path_count_checked || finalAudit.checked_paths || 0;
  const workbooks = finalAudit.workbooks_checked || finalAudit.workbook_count_checked || finalAudit.xlsx_workbooks_checked || 0;
  const sheets = finalAudit.sheets_checked || finalAudit.total_sheets_checked || 0;

  $('pathAuditPanel').innerHTML = `
    ${statusChip(resultOk ? 'paths OK' : 'paths com falha', resultOk)}
    <h3>Auditoria de caminhos</h3>
    <div class="metric-value">${formatNumber(checked)}</div>
    <div class="metric-label">caminhos checados nos relatórios</div>
    <div class="mini-metrics">
      <div class="mini-card"><strong>${formatNumber(missing.length)}</strong><span>paths faltantes</span></div>
      <div class="mini-card"><strong>${formatNumber(workbooks)}</strong><span>workbooks</span></div>
      <div class="mini-card"><strong>${formatNumber(sheets)}</strong><span>abas</span></div>
      <div class="mini-card"><strong>${formatNumber(scenarioBlocks)}</strong><span>blocos de cenário</span></div>
    </div>
    <details class="details-card">
      <summary>Amostra de paths auditados</summary>
      <div class="table-wrap">${renderTable((audit.paths || []).slice(0, 16), [
        { key: 'path', label: 'Path', isPath: true },
        { key: 'kind', label: 'Tipo' },
        { key: 'exists', label: 'Existe?' },
        { key: 'size_bytes', label: 'Bytes' }
      ])}</div>
    </details>
  `;
}

function renderSheetInventory() {
  const rows = state.workbookInventory || [];
  if (!rows.length) {
    $('sheetInventorySummary').innerHTML = '<article class="card"><h3>Inventário indisponível</h3><p>Não foi possível carregar o CSV de abas.</p></article>';
    return;
  }
  const byCompany = rows.reduce((acc, row) => {
    const key = row.empresa || row.company || 'sem_empresa';
    acc[key] = acc[key] || { sheets: 0, exported: 0, core: 0 };
    acc[key].sheets += 1;
    if ((row.export_csv_path || row.csv_export_path || '').trim()) acc[key].exported += 1;
    if ((row.core_files || row.core_path || row.core_csv_path || '').trim()) acc[key].core += 1;
    return acc;
  }, {});
  const cards = Object.entries(byCompany).map(([company, values]) => `
    <article class="card">
      ${statusChip(values.exported === values.sheets ? 'exports OK' : 'exports parciais', values.exported === values.sheets, values.exported < values.sheets)}
      <h3>${escapeHtml(company)}</h3>
      <div class="metric-value">${formatNumber(values.sheets)}</div>
      <div class="metric-label">abas inventariadas</div>
      <p class="metric-note">${formatNumber(values.exported)} com export CSV · ${formatNumber(values.core)} ligadas ao core.</p>
    </article>`).join('');
  $('sheetInventorySummary').innerHTML = cards;
  $('sheetInventoryTable').innerHTML = renderTable(rows, [
    { key: 'company', label: 'Empresa' },
    { key: 'source_id', label: 'Source ID' },
    { key: 'filename', label: 'Arquivo original' },
    { key: 'sheet_name', label: 'Aba' },
    { key: 'dimension', label: 'Dimensão' },
    { key: 'source_export_path', label: 'Export CSV', isPath: true },
    { key: 'core_paths', label: 'Core files', isPath: true }
  ], { limit: 80 });
}

const manualChecks = [
  { id: 'empresa1_dados', label: 'Cliquei em Empresa 1 e vi demanda, distância e premissas', detail: 'Empresa 1 deve mostrar somente os datasets dela.' },
  { id: 'empresa2_dados', label: 'Cliquei em Empresa 2 e vi os datasets da planilha de malha', detail: 'Empresa 2 deve mostrar custos, estoque, faturamento, tributário e cenários.' },
  { id: 'sem_mistura_1', label: 'Confirmei que Empresa 1 não mostra dados da Empresa 2', detail: 'Não pode aparecer faturamento_uf, estoque ou dados_tributario na Empresa 1.' },
  { id: 'sem_mistura_2', label: 'Confirmei que Empresa 2 não mostra dados da Empresa 1', detail: 'Não pode aparecer demand_records ou distance_matrix como core da Empresa 2.' },
  { id: 'paths_zero', label: 'Conferi que não há paths faltantes', detail: 'O painel de auditoria deve mostrar 0 caminhos faltantes.' },
  { id: 'cenario_blocos', label: 'Conferi que Cenários da Empresa 2 aparece como bloco especial', detail: 'Deve existir scenario_blocks e scenario_totals nos datasets.' },
  { id: 'abas', label: 'Abri o inventário das abas e vi as planilhas mapeadas', detail: 'O resumo deve mostrar as abas inventariadas por empresa.' }
];

function loadManualChecklist() {
  try { return JSON.parse(localStorage.getItem('visagio_phase1_manual_checks') || '{}'); }
  catch { return {}; }
}

function saveManualChecklist(values) {
  localStorage.setItem('visagio_phase1_manual_checks', JSON.stringify(values));
}

function renderManualChecklist() {
  const values = loadManualChecklist();
  $('manualChecklist').innerHTML = manualChecks.map((check) => `
    <label class="check-item">
      <input type="checkbox" data-manual-check="${escapeHtml(check.id)}" ${values[check.id] ? 'checked' : ''}>
      <span>
        <span class="check-title">${escapeHtml(check.label)}</span>
        <span class="check-detail">${escapeHtml(check.detail)}</span>
      </span>
      <span class="check-result ${values[check.id] ? 'check-pass' : 'check-pending'}">${values[check.id] ? 'feito' : 'pendente'}</span>
    </label>`).join('');
  updateManualProgress();
}

function updateManualProgress() {
  const values = loadManualChecklist();
  const done = manualChecks.filter((check) => values[check.id]).length;
  $('manualChecklistProgress').textContent = `${done}/${manualChecks.length} checagens manuais marcadas.`;
}

function runPhase1Checks() {
  const catalog = state.catalog || {};
  const companies = catalog.companies || {};
  const e1Files = companies.empresa1?.core_files || [];
  const e2Files = companies.empresa2?.core_files || [];
  const audit = state.pathAudit || {};
  const proof = state.proof || {};
  const requiredE1 = ['demand_records', 'distance_matrix', 'premissas'];
  const requiredE2 = ['faturamento_uf', 'distribuicao_fabrica_cd', 'dados_tributario', 'estoque', 'scenario_blocks', 'scenario_totals'];
  const e1Ids = new Set(e1Files.map((f) => f.id));
  const e2Ids = new Set(e2Files.map((f) => f.id));
  const htmlCssJs = proof.html_css_js_present || [];
  const missingPaths = audit.missing_paths || [];

  const checks = [
    {
      id: 'catalog_loaded',
      label: 'catalog.json carregado',
      detail: `${Object.keys(companies).length} empresas encontradas no catálogo.`,
      pass: Boolean(catalog.version && companies.empresa1 && companies.empresa2)
    },
    {
      id: 'front_assets_declared',
      label: 'HTML, CSS e JavaScript declarados',
      detail: htmlCssJs.join(', ') || 'Lista não encontrada no proof.',
      pass: ['index.html', 'assets/styles.css', 'assets/app.js'].every((p) => htmlCssJs.includes(p))
    },
    {
      id: 'empresa1_required_core',
      label: 'Empresa 1 tem demanda, distância e premissas',
      detail: `Encontrados: ${Array.from(e1Ids).join(', ')}`,
      pass: requiredE1.every((id) => e1Ids.has(id))
    },
    {
      id: 'empresa2_required_core',
      label: 'Empresa 2 tem datasets core de malha',
      detail: `Checando: ${requiredE2.join(', ')}`,
      pass: requiredE2.every((id) => e2Ids.has(id))
    },
    {
      id: 'no_company_mixing',
      label: 'Empresas não estão misturadas no catálogo',
      detail: 'Empresa 1 não deve ter dados_tributario; Empresa 2 não deve ter demand_records.',
      pass: !e1Ids.has('dados_tributario') && !e2Ids.has('demand_records')
    },
    {
      id: 'path_report_zero_missing',
      label: 'Relatório de paths sem faltantes',
      detail: `${missingPaths.length} paths faltantes declarados no relatório.`,
      pass: missingPaths.length === 0
    },
    {
      id: 'scenario_special_files',
      label: 'Cenários da Empresa 2 têm parser especial',
      detail: 'scenario_blocks e scenario_totals precisam estar disponíveis.',
      pass: e2Ids.has('scenario_blocks') && e2Ids.has('scenario_totals')
    },
    {
      id: 'local_storage',
      label: 'Auditoria manual consegue salvar no navegador',
      detail: 'Teste rápido de escrita/leitura em localStorage.',
      pass: testLocalStorage()
    }
  ];

  $('phase1AutoChecks').innerHTML = checks.map((check) => `
    <div class="check-item">
      <span aria-hidden="true">${check.pass ? '✅' : '❌'}</span>
      <span>
        <span class="check-title">${escapeHtml(check.label)}</span>
        <span class="check-detail">${escapeHtml(check.detail)}</span>
      </span>
      <span class="check-result ${check.pass ? 'check-pass' : 'check-fail'}">${check.pass ? 'passou' : 'falhou'}</span>
    </div>`).join('');
  const failed = checks.filter((check) => !check.pass);
  log('Testes automáticos da Fase 1 executados', { passed: checks.length - failed.length, failed: failed.length });
  return checks;
}

function testLocalStorage() {
  try {
    const key = 'visagio_phase1_storage_test';
    localStorage.setItem(key, 'ok');
    const ok = localStorage.getItem(key) === 'ok';
    localStorage.removeItem(key);
    return ok;
  } catch {
    return false;
  }
}

async function checkCorePathsLive() {
  const company = getCompany();
  const files = company?.core_files || [];
  if (!secureLoader) secureLoader = await import('./js/shared/data-loader.js');
  const manifest = await secureLoader.loadEncryptedManifest('../');
  const results = {};
  log(`Checagem ao vivo de paths iniciada para ${state.selectedCompany}`);
  for (const file of files) {
    const targets = [file.csv, file.json].filter(Boolean);
    let ok = targets.length > 0;
    const checked = [];
    for (const target of targets) {
      try {
        const normalizedTarget = String(target).replace(/^\.\.\//, '').replace(/^\/+/, '');
        const entry = (manifest.entries || []).find((item) => item.original_path === normalizedTarget);
        const requestPath = entry?.encrypted_path || normalizedTarget;
        const response = await fetch(requestPath, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        checked.push({ path: requestPath, ok: true, status: 'path-ok' });
      } catch (error) {
        checked.push({ path: target, ok: false, error: error.message });
        ok = false;
      }
    }
    results[file.id] = { ok, checked };
  }
  state.livePathResults = results;
  renderCompanyPanel();
  log('Checagem ao vivo concluída', results);
}

function renderPhaseRoadmap() {
  const tests = state.phaseTests || {};
  $('phaseRoadmap').innerHTML = Object.entries(tests).map(([phase, config]) => {
    const page = config.page || '—';
    const manualChecks = config.manual_checks || [];
    const automatedTests = config.automated_tests || [];
    return `<article class="card phase-card">
      ${statusChip('Pronta', true)}
      <h3>${escapeHtml(config.label || phase.replace('_', ' ').toUpperCase())}</h3>
      <p><b>Página:</b> <a href="${escapeHtml(page)}">${escapeHtml(page)}</a></p>
      <div class="mini-metrics">
        <div class="mini-card"><strong>${formatNumber(manualChecks.length)}</strong><span>checagens manuais</span></div>
        <div class="mini-card"><strong>${formatNumber(automatedTests.length)}</strong><span>testes automáticos</span></div>
      </div>
      <details class="details-card">
        <summary>Ver detalhes</summary>
        <p><b>Manuais:</b> ${manualChecks.map(escapeHtml).join(', ') || '—'}</p>
        <p><b>Automáticos:</b> ${automatedTests.map(escapeHtml).join(', ') || '—'}</p>
      </details>
    </article>`;
  }).join('');
}

function setCompany(companyId) {
  if (!state.catalog?.companies?.[companyId]) return;
  state.selectedCompany = companyId;
  state.livePathResults = {};
  renderCompanySelector();
  renderCompanyPanel();
  renderDataQualityPanel();
  runPhase1Checks();
  void renderPhase2Validation(companyId);
  log('Empresa selecionada', companyId);
}

async function ensureCompanyUnlocked(companyId) {
  if (!secureLoader) secureLoader = await import('./js/shared/data-loader.js');
  const bundle = await secureLoader.loadPhase2Bundle(companyId);
  state.phase2Bundles[companyId] = bundle;
  await renderPhase2Validation(companyId);
  log('Dados criptografados desbloqueados', { companyId });
}

function bindEvents() {
  document.querySelectorAll('[data-company]').forEach((button) => {
    button.addEventListener('click', () => setCompany(button.dataset.company));
  });
  $('selectEmpresa1').addEventListener('click', async () => { await ensureCompanyUnlocked('empresa1'); setCompany('empresa1'); window.location.hash = 'dados'; });
  $('selectEmpresa2').addEventListener('click', async () => { await ensureCompanyUnlocked('empresa2'); setCompany('empresa2'); window.location.hash = 'dados'; });
  $('runLivePathCheck').addEventListener('click', checkCorePathsLive);
  $('rerunPhase1Checks').addEventListener('click', runPhase1Checks);
  $('rerunPhase2Checks')?.addEventListener('click', () => void renderPhase2Validation(state.selectedCompany));
  $('clearManualChecklist').addEventListener('click', () => {
    saveManualChecklist({});
    renderManualChecklist();
    log('Auditoria manual limpa');
  });
  $('manualChecklist').addEventListener('change', (event) => {
    const id = event.target?.dataset?.manualCheck;
    if (!id) return;
    const values = loadManualChecklist();
    values[id] = event.target.checked;
    saveManualChecklist(values);
    renderManualChecklist();
  });
  $('phase2ManualChecklist')?.addEventListener('change', (event) => {
    const id = event.target?.dataset?.phase2ManualCheck;
    if (!id) return;
    const values = loadPhase2ManualChecklist();
    values[id] = event.target.checked;
    savePhase2ManualChecklist(state.selectedCompany, values);
    renderPhase2ManualChecklist();
  });
  $('clearPhase2ManualChecklist')?.addEventListener('click', () => {
    savePhase2ManualChecklist(state.selectedCompany, {});
    renderPhase2ManualChecklist();
  });
  $('toggleSheetTable').addEventListener('click', () => {
    $('sheetInventoryTable').classList.toggle('hidden');
  });
}

async function init() {
  try {
    log('Carregando arquivos principais da Fase 1');
    const [catalog, proof, quality, finalAudit, pathAudit, phaseTests, workbookCsv] = await Promise.all([
      fetchJson(PATHS.catalog),
      fetchJson(PATHS.proof),
      fetchJson(PATHS.quality),
      fetchJson(PATHS.finalAudit),
      fetchJson(PATHS.pathAudit),
      fetchJson(PATHS.phaseTests),
      fetchText(PATHS.workbookInventory)
    ]);
    state.catalog = catalog;
    state.proof = proof;
    state.quality = quality;
    state.finalAudit = finalAudit;
    state.pathAudit = pathAudit;
    state.phaseTests = phaseTests;
    state.workbookInventory = parseCsv(workbookCsv);
    renderHero();
    renderProofCards();
    renderCompanySelector();
    renderCompanyPanel();
    renderDataQualityPanel();
    renderPathAuditPanel();
    renderSheetInventory();
    renderManualChecklist();
    renderPhaseRoadmap();
    bindEvents();
    runPhase1Checks();
    void renderPhase2Validation(state.selectedCompany);
    log('Fase 1 carregada com sucesso');
    window.addEventListener('storage', (event) => {
      if (event.key === SHARED_DEBUG_FEED_KEY) renderSharedDebugFeed();
    });
  } catch (error) {
    $('heroStatus').textContent = 'erro ao carregar';
    $('heroStatus').className = 'status-chip status-error';
    appendSharedDebugEntry({ phase: 'phase1', module: 'app', level: 'error', event: 'Erro crítico', detail: { message: error.message, stack: error.stack }, error });
    log('Erro crítico', { message: error.message, stack: error.stack });
    document.body.insertAdjacentHTML('beforeend', `<div class="card" style="margin:24px;color:#b42318"><h2>Erro ao carregar Fase 1</h2><pre>${escapeHtml(error.stack || error.message)}</pre></div>`);
  }
}

init();
