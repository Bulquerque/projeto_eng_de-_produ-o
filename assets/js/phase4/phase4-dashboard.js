import {loadPhase2Bundle} from '../shared/data-loader.js';
import {$,escapeHtml} from '../shared/common.js';
import {loadDefaultProfiles,cloneProfileAsObjective} from './objective-profile-library.js';
import {buildObjective,buildObjectivePreviewText} from './objective-builder.js';
import {runOptimization} from './scenario-optimizer.js';
import {renderSearchLog} from './search-log-panel.js';
import {explainRanking} from './ranking-explainer.js';
import {buildTradeoffFrontier} from './tradeoff-frontier.js';
import {validateConstraintConfig} from './constraint-engine.js';
import {renderRankingChart, renderTradeoffChart} from './charts.js';
import {buildBaselineCardsHtml, buildOptimizerInputTableHtml, buildRankingTableHtml, buildTradeoffTableHtml} from './phase4-dashboard-templates.js';
import {appendSharedDebugEntry} from '../shared/debug-tools.js';
import { resolveTaxRegime } from '../shared/tax-reform-config.js';
const state={companyId:'empresa1',bundle:null,objective:null,optimizer:null,frontier:null,isLoading:false};
function log(label,obj){appendSharedDebugEntry({phase:'phase4',module:'phase4-dashboard',level:'info',event:label,detail:typeof obj==='string'?{message:obj}:obj||{}}); const el=$('phase4DebugConsole'); if(el)el.textContent=`${new Date().toLocaleTimeString()} · ${label}\n${typeof obj==='string'?obj:JSON.stringify(obj,null,2)}`}
function logError(label,obj){appendSharedDebugEntry({phase:'phase4',module:'phase4-dashboard',level:'error',event:label,detail:typeof obj==='string'?{message:obj}:obj||{},error:typeof obj==='string'?new Error(obj):obj}); const el=$('phase4DebugConsole'); if(el)el.textContent=`${new Date().toLocaleTimeString()} · ${label}\n${typeof obj==='string'?obj:JSON.stringify(obj,null,2)}`}
function label(cid){return cid==='empresa2'?'Empresa 2':'Empresa 1'}
function renderTabs(){document.querySelectorAll('[data-company]').forEach(btn=>{const active=btn.dataset.company===state.companyId; btn.classList.toggle('active',active); btn.setAttribute('aria-selected',String(active))}); $('phase4CompanyLabel').textContent=label(state.companyId)}
function currentWeights(){const ids=['total_cost','service_quality','operational_risk','tax_impact','inventory_efficiency']; const w={}; ids.forEach(id=>w[id]=Number($(`weight_${id}`)?.value||0)/100); return w}
function setWeights(weights){for(const [k,v] of Object.entries(weights||{})){const el=$(`weight_${k}`); if(el)el.value=Math.round(Number(v)*100)} renderObjectivePreview()}
function renderObjectivePreview(){state.objective=buildObjective({companyId:state.companyId,objectiveName:$('objectiveName')?.value||'Objetivo customizado',weights:currentWeights()}); $('objectivePreview').innerHTML=`<strong>${escapeHtml(state.objective.objective_name)}</strong><p>${escapeHtml(buildObjectivePreviewText(state.objective))}</p>${state.objective.valid?'<span class="status-chip status-ok">objetivo válido</span>':`<div class="alert-box error">${escapeHtml(state.objective.errors.join('; '))}</div>`}`}
function renderBaseline(){ $('baselinePhase4Cards').innerHTML=buildBaselineCardsHtml({bundle:state.bundle,companyId:state.companyId}); renderOptimizerInputTable()}
function renderOptimizerInputTable(){ const el=$('optimizerInputTable'); if(el)el.innerHTML=buildOptimizerInputTableHtml({bundle:state.bundle,companyId:state.companyId,constraints:constraints(),optimizerConfig:optimizerConfig(),searchLog:state.optimizer?.search_log})}
function renderProfiles(){const profiles=loadDefaultProfiles(); $('objectiveProfiles').innerHTML=profiles.map(p=>`<button type="button" class="profile-card" data-profile="${p.profile_id}"><strong>${escapeHtml(p.profile_name)}</strong><span>${escapeHtml(p.description)}</span></button>`).join('')}
function renderOptimizer(){if(!state.optimizer){$('searchLogPanel').innerHTML='<div class="empty-state">Rode a otimização exata para ver o log.</div>'; $('rankingPanel').innerHTML='<div class="empty-state">Sem ranking ainda.</div>'; $('rankingExplanation').innerHTML='<div class="empty-state">Sem explicação ainda.</div>'; $('tradeoffPanel').innerHTML='<div class="empty-state">Sem fronteira ainda.</div>'; renderRankingChart([]); renderTradeoffChart(null); return}
  renderOptimizerInputTable();
  const opt=state.optimizer;
  if(opt.optimizer_status!=='success'){
    $('searchLogPanel').innerHTML=`<div class="alert-box error"><strong>Otimização não concluída</strong><p>${escapeHtml((opt.errors||[]).join('; ')||'Falha na busca exata.')}</p></div>${renderSearchLog(opt.search_log)}`;
    $('rankingPanel').innerHTML='<div class="empty-state">Sem ranking disponível.</div>';
    $('rankingExplanation').innerHTML='<div class="empty-state">Sem explicação disponível.</div>';
    $('tradeoffPanel').innerHTML='<div class="empty-state">Sem fronteira disponível.</div>';
    renderRankingChart([]);
    renderTradeoffChart(null);
    return;
  }
  $('searchLogPanel').innerHTML=renderSearchLog(opt.search_log);
  $('rankingPanel').innerHTML=buildRankingTableHtml(opt.best_scenarios);
  const exp=explainRanking({objective:state.objective,scoredScenario:opt.best_scenarios[0]}); $('rankingExplanation').innerHTML=`<ul>${exp.ranking_explanation.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>`;
  state.frontier=buildTradeoffFrontier({companyId:state.companyId,scenarioRecords:opt.scenario_records,scoredScenarios:opt.scored_scenarios}); $('tradeoffPanel').innerHTML=buildTradeoffTableHtml(state.frontier);
  renderRankingChart(opt.best_scenarios);
  renderTradeoffChart(state.frontier);
}
function constraints(){return {min_active_cds:Number($('minActiveCds').value||1),max_active_cds:Number($('maxActiveCds').value||999),max_cd_volume_share:Number($('maxCdShare').value||100)/100,max_risk_level:$('maxRiskLevel').value,allow_tax_disabled:$('allowTaxDisabled').checked}}
function optimizerConfig(){const taxMode=$('optimizationTaxMode').value; const taxRegime=resolveTaxRegime({taxMode}); return {method:'exact_discrete',max_candidates:Number($('maxCandidates').value||2000),seed:Number($('optimizerSeed').value||42),base_tax_mode:taxMode,base_tax_regime:taxRegime,allow_tax_disabled:$('allowTaxDisabled').checked}}
function runOpt(){
  renderObjectivePreview();
  if(!state.objective.valid){alert('Objetivo inválido. Corrija os pesos.'); return}
  const constraintValidation=validateConstraintConfig(constraints());
  if(!constraintValidation.valid){
    const message=constraintValidation.errors.join('; ');
    state.optimizer=null;
    renderOptimizer();
    log('Restrições inválidas',message);
    alert(message);
    return;
  }
  $('runOptimizer').disabled=true;
  $('runOptimizer').textContent='Rodando otimização exata...';
  setTimeout(()=>{
    try{
      state.optimizer=runOptimization({companyId:state.companyId,baselineBundle:state.bundle,objective:state.objective,constraints:constraints(),optimizerConfig:optimizerConfig()});
      renderOptimizer();
      if(state.optimizer.optimizer_status!=='success'){
        log('Otimizador bloqueado',state.optimizer.errors||[]);
        alert((state.optimizer.errors||['Falha na otimização']).join('; '));
        return;
      }
      log('Otimização exata executada',state.optimizer.search_log)
    }catch(e){
    logError('Erro no otimizador',e.message);
      alert(e.message)
    } finally {
      $('runOptimizer').disabled=false;
      $('runOptimizer').textContent='Rodar otimização exata'
    }
  },20)
}
function setCompanyButtonsDisabled(disabled){document.querySelectorAll('[data-company]').forEach(btn=>{btn.disabled=disabled; btn.style.opacity=disabled?'0.5':''; btn.title=disabled?'Aguarde o carregamento da empresa atual...':""})};
export async function loadPhase4Company(companyId){if(state.isLoading){log('loadPhase4Company ignorado — carregamento em andamento',{companyId}); return;} state.isLoading=true; state.companyId=companyId; renderTabs(); setCompanyButtonsDisabled(true); const loading=$('phase4Loading'); if(loading)loading.classList.remove('hidden'); try{state.bundle=await loadPhase2Bundle(companyId); state.optimizer=null; renderBaseline(); renderObjectivePreview(); renderOptimizer(); if(loading)loading.classList.add('hidden'); log('Empresa carregada',{companyId})}catch(e){if(loading)loading.innerHTML=`<div class="alert-box error"><strong>Erro</strong><p>${escapeHtml(e.message)}</p></div>`; logError('erro',e.message)}finally{state.isLoading=false; setCompanyButtonsDisabled(false)}}
export function setupPhase4(){renderProfiles(); document.querySelectorAll('[data-company]').forEach(btn=>btn.addEventListener('click',()=>loadPhase4Company(btn.dataset.company))); document.body.addEventListener('click',e=>{const prof=e.target.closest('[data-profile]'); if(prof){const obj=cloneProfileAsObjective(prof.dataset.profile,state.companyId); $('objectiveName').value=obj.objective_name; setWeights(obj.weights)}}); ['objectiveName','weight_total_cost','weight_service_quality','weight_operational_risk','weight_tax_impact','weight_inventory_efficiency'].forEach(id=>$(id)?.addEventListener('input',renderObjectivePreview)); ['minActiveCds','maxActiveCds','maxCdShare','maxRiskLevel','allowTaxDisabled','optimizationTaxMode','maxCandidates','optimizerSeed'].forEach(id=>$(id)?.addEventListener('input',renderOptimizerInputTable)); $('runOptimizer')?.addEventListener('click',runOpt); loadPhase4Company('empresa1')}
