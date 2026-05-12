import {buildScenarioFromForm} from './scenario-builder.js';
import {validateScenario} from './scenario-validator.js';
import {runScenario} from './scenario-simulator.js';
import {compareScenarios} from './scenario-comparator.js';
import {saveScenario, loadSavedScenarios, deleteScenario} from './scenario-persistence.js';
function check(name,pass,message,module='phase3'){return {name,pass:!!pass,message,module,severity:pass?'ok':'error'}}
export function runPhase3BrowserChecks(companyId,baselineBundle){
  const baseCds=baselineBundle?.model?.active_cds||[];
  const scenario=buildScenarioFromForm({companyId,baselineBundle,formValues:{scenario_name:'Teste automático Fase 3',active_cds:baseCds.slice(0,Math.max(1,baseCds.length-1)),freight_multiplier:1.1,demand_multiplier:1,inventory_days:35,wacc:.15,tax_mode:'disabled'}});
  const invalid=buildScenarioFromForm({companyId,baselineBundle,formValues:{scenario_name:'inválido',active_cds:[],freight_multiplier:-1,demand_multiplier:1,inventory_days:45,wacc:.15,tax_mode:'current'}});
  const val=validateScenario({companyId,scenario,baselineBundle}); const valBad=validateScenario({companyId,scenario:invalid,baselineBundle}); const result=runScenario({companyId,scenario,baselineBundle}); const comp=compareScenarios({companyId,baselineBundle,scenarioResults:[result]});
  const temporaryScenarioId=`${scenario.scenario_id}_test_saved`;
  saveScenario(companyId,{...scenario,scenario_id:temporaryScenarioId});
  let saved=[];
  try{
    saved=loadSavedScenarios(companyId);
  }finally{
    deleteScenario(companyId,temporaryScenarioId);
  }
  return [
    check('Baseline carregado',!!baselineBundle?.model?.scenario_id,'Baseline da Fase 2 disponível.','ScenarioLibrary'),
    check('ScenarioBuilder cria company_id correto',scenario.company_id===companyId,'Cenário criado para a empresa selecionada.','ScenarioBuilder'),
    check('ScenarioValidator aprova cenário válido',val.valid,'Cenário válido aprovado.','ScenarioValidator'),
    check('ScenarioValidator bloqueia cenário inválido',!valBad.valid,'Cenário sem CD/frete negativo bloqueado.','ScenarioValidator'),
    check('ScenarioSimulator executa cenário válido',result.simulation_status==='success','Resultado calculado com sucesso.','ScenarioSimulator'),
    check('Tax mode disabled zera tributo',Number(result.costs.tax_impact)===0,'Impacto tributário zerado no cenário teste.','ScenarioSimulator'),
    check('ScenarioComparator calcula comparação',comp.comparison.length>=2,'Baseline e cenário aparecem na comparação.','ScenarioComparator'),
    check('Baseline tem saving zero',Math.abs(comp.comparison.find(r=>r.scenario_id===baselineBundle.model.scenario_id)?.saving_abs||0)<.01,'Saving do baseline é zero.','ScenarioComparator'),
    check('ScenarioPersistence salva por empresa',saved.some(s=>s.scenario_id===`${scenario.scenario_id}_test_saved`),'Cenário teste salvo no localStorage.','ScenarioPersistence'),
    check('Separação de empresas',scenario.base_scenario_id===baselineBundle.model.scenario_id,'Cenário aponta para baseline correto.','CompanyIsolation')
  ]
}
export function renderPhase3Checks(checks){return checks.map(c=>`<div class="check-item"><span class="check-result ${c.pass?'check-pass':'check-fail'}">${c.pass?'OK':'FALHA'}</span><span><span class="check-title">${c.name}</span><span class="check-detail">${c.module} · ${c.message}</span></span></div>`).join('')}
