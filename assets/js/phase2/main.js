import {$, escapeHtml, formatBRL, formatNumber, metric} from '../shared/common.js';
import {loadCatalog, loadPhase2Bundle, loadPhase2Report} from '../shared/data-loader.js';
import {renderDashboard} from './baseline-dashboard.js';
import {appendSharedDebugEntry,createDebugSession, renderDebugEntries} from '../shared/debug-tools.js';
import {normalizePhase2Bundle, validateNormalizedInput} from './baseline-data-adapter.js';
import {buildBaselineScenario, checkBaselineCompleteness} from './baseline-builder.js';
import {runPhase2Checks, renderChecks} from './phase2-tests.js';

// loadCompany is the page entrypoint used by the company tabs after encrypted data is unlocked.
const state={selectedCompany:'empresa1', catalog:null, report:null, bundles:{}, isLoading:false, logs:[], debug:createDebugSession({phase:'phase2',module:'main',enabled:false})};
function log(msg,data=null){state.debug.info(msg,data||{}); appendSharedDebugEntry({phase:'phase2',module:'main',level:'info',event:msg,detail:data||{}}); const line=`[${new Date().toLocaleTimeString('pt-BR')}] ${msg}${data?`: ${JSON.stringify(data)}`:''}`; state.logs.push(line); const el=$('phase2DebugConsole'); if(el)el.textContent=state.logs.slice(-25).join('\n'); const rich=$('phase2DebugStructured'); if(rich)rich.innerHTML=renderDebugEntries(state.debug.entries)}
function logError(msg,error,data=null){state.debug.error(msg,error,data||{}); appendSharedDebugEntry({phase:'phase2',module:'main',level:'error',event:msg,detail:data||{},error}); const rich=$('phase2DebugStructured'); if(rich)rich.innerHTML=renderDebugEntries(state.debug.entries); const raw=$('phase2DebugConsole'); if(raw)raw.textContent=state.logs.concat(`[erro] ${msg}: ${error?.message||error}`).slice(-30).join('\n')}
function setCompanyButtonsDisabled(disabled){document.querySelectorAll('[data-company]').forEach(btn=>{btn.disabled=disabled; btn.style.opacity=disabled?'0.5':''; btn.title=disabled?'Aguarde o carregamento da empresa atual...':''})}
function renderTests(bundle, companyId) {
  const checks = runPhase2Checks(bundle, companyId);
  const passed = checks.filter(check => check.pass).length;
  const summary = $('phase2CheckSummary');
  const list = $('phase2AutoChecks');
  if (summary) summary.textContent = `${passed}/${checks.length} validações automáticas OK`;
  if (list) list.innerHTML = renderChecks(checks);
}
async function loadCompany(companyId){if(state.isLoading){log('loadCompany ignorado — carregamento em andamento',{companyId}); return;} state.isLoading=true; state.selectedCompany=companyId; updateTabs(); setCompanyButtonsDisabled(true); const loading=$('phase2Loading'); const workspace=$('phase2Workspace'); if(loading)loading.classList.remove('hidden'); if(workspace)workspace.classList.add('hidden'); try{if(!state.bundles[companyId])state.bundles[companyId]=await loadPhase2Bundle(companyId); const bundle=state.bundles[companyId]; const normalized=normalizePhase2Bundle(bundle,companyId); const baseline=buildBaselineScenario(normalized); const normalizedCheck=validateNormalizedInput(normalized); const baselineCheck=checkBaselineCompleteness(baseline); log('baseline:normalized',{companyId,valid:normalizedCheck.valid,baselineReady:baseline.baseline_ready}); if(!normalizedCheck.valid||!baselineCheck.valid){state.debug.warn('baseline:validation-warning',{normalizedCheck,baselineCheck});} renderDashboard(bundle,companyId); renderTests(bundle,companyId); if(loading)loading.classList.add('hidden'); if(workspace)workspace.classList.remove('hidden'); log('Empresa carregada',{companyId,flows:bundle.flows.length,total:bundle.costs.costs.total_with_tax})}catch(e){if(loading)loading.classList.add('hidden'); if(workspace)workspace.classList.remove('hidden'); const warning=$('warningPanel'); if(warning)warning.innerHTML=`<div class="alert-box error"><strong>Erro ao carregar Fase 2</strong><p>${escapeHtml(e.message)}</p></div>`; logError('loadCompany:error',e,{companyId})}finally{state.isLoading=false; setCompanyButtonsDisabled(false)}}
function updateTabs(){document.querySelectorAll('[data-company]').forEach(btn=>{const active=btn.dataset.company===state.selectedCompany; btn.classList.toggle('active',active); btn.setAttribute('aria-selected',active?'true':'false')})}
function companyContextCard(companyId){
  const bundle=state.bundles[companyId];
  const report=state.report?.companies?.[companyId]||{};
  const model=bundle?.model||{};
  const costs=bundle?.costs?.costs||{};
  const fit=bundle?.base_fit||{};
  const activeCds=model.active_cds||[];
  const origins=model.origins||[];
  const destinations=model.destinations||[];
  const total=costs.total_with_tax??report.total_with_tax;
  const rawFitStatus=fit.status||report.base_fit_status||'benchmark_pending';
  const fitLabel=fit.base_fit_score!==null&&fit.base_fit_score!==undefined?`Base Fit ${fit.base_fit_score}`:String(rawFitStatus).includes('pending')||String(rawFitStatus).includes('pendente')?'pendente':rawFitStatus;
  const reconciliationLabel=bundle?.reconciliation?.overall?.label||fitLabel;
  const reconciliationStatus=bundle?.reconciliation?.overall?.status||rawFitStatus;
  return `<article class="card company-context-card">
    <div class="panel-toolbar"><div><p class="eyebrow">${companyId==='empresa2'?'Empresa 2':'Empresa 1'}</p><h3>Dados disponíveis</h3></div><span class="status-chip ${report.baseline_ready?'status-ok':'status-warn'}">${report.baseline_ready?'baseline pronto':'em análise'}</span></div>
    <div class="metric-grid compact">
      ${metric('CDs ativos',formatNumber(activeCds.length||0),activeCds.slice(0,3).join(' · ')||'—')}
      ${metric('Origens',formatNumber(origins.length||0),'detectadas')}
      ${metric('Destinos',formatNumber(destinations.length||0),'cobertura')}
      ${metric('Fluxos',formatNumber((bundle?.flows||[]).length||report.flow_count||0),'linhas processadas')}
      ${metric('Total com tributo',formatBRL(total,true),'baseline')}
      ${metric('Reconciliação',reconciliationLabel,reconciliationStatus)}
    </div>
  </article>`;
}
function renderProof(){const r=state.report; $('packageName').textContent=state.catalog?.package||'pacote'; $('packageVersion').textContent=state.catalog?.version||'—'; $('phase2Status').textContent=r?.result==='OK'?'Fase 2 implementada':'Fase 2 em validação'; $('phase2ProofCards').innerHTML=[companyContextCard('empresa1'),companyContextCard('empresa2')].join('')}
function setup(){document.querySelectorAll('[data-company]').forEach(b=>b.addEventListener('click',()=>loadCompany(b.dataset.company)))}
async function init(){try{setup(); [state.catalog,state.report]=await Promise.all([loadCatalog(),loadPhase2Report()]); renderProof(); await loadCompany('empresa1')}catch(e){$('phase2Loading').innerHTML=`<div class="alert-box error"><strong>Falha ao inicializar</strong><p>${escapeHtml(e.message)}</p></div>`; logError('init:error',e,{stage:'init'})}}
init();
