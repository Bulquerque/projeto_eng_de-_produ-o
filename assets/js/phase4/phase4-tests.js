import {buildObjective} from './objective-builder.js';
import {validateObjective} from './objective-validator.js';
import {validateConstraintConfig} from './constraint-engine.js';
import {normalizeMetrics} from './metric-normalizer.js';
import {scoreScenarios} from './scenario-scoring.js';
import {generateCandidateScenarios} from './candidate-scenario-generator.js';
import {runOptimization} from './scenario-optimizer.js';
export function runPhase4BrowserChecks(companyId,baselineBundle){
  const checks=[]; const add=(name,pass,module,message)=>checks.push({name,pass:Boolean(pass),module,message});
  const obj=buildObjective({companyId,objectiveName:'Teste',weights:{total_cost:40,service_quality:20,operational_risk:15,tax_impact:15,inventory_efficiency:10}});
  add('Objective válido',obj.valid,'ObjectiveBuilder',`soma ${obj.weights_sum}`);
  const bad=buildObjective({companyId,objectiveName:'Bad',weights:{total_cost:-1}}); add('Peso negativo bloqueado',!bad.valid,'ObjectiveValidator',bad.errors.join('; '));
  const metrics=[{scenario_id:'a',total_cost:100,service_quality:50,operational_risk:10,tax_impact:20,inventory_efficiency:60},{scenario_id:'b',total_cost:90,service_quality:40,operational_risk:30,tax_impact:10,inventory_efficiency:70}];
  const norm=normalizeMetrics({companyId,scenarioMetrics:metrics}); add('Normalização 0-100',norm.normalized_metrics.every(r=>Object.keys(r).filter(k=>k.endsWith('_score')).every(k=>r[k]>=0&&r[k]<=100)),'MetricNormalizer','scores dentro do intervalo');
  const sc=scoreScenarios({companyId,objective:obj,normalizedMetrics:norm.normalized_metrics}); add('Score calculado',sc.scored_scenarios.length===2 && sc.scored_scenarios[0].rank===1,'ScenarioScoring',`${sc.scored_scenarios.length} cenários`);
  const gen=generateCandidateScenarios({companyId,baselineBundle,generationConfig:{max_candidates:8}}); add('Candidatos gerados',gen.candidate_scenarios.length>0 && gen.candidate_scenarios.every(s=>s.company_id===companyId),'CandidateScenarioGenerator',`${gen.candidate_scenarios.length} candidatos`);
  const badConstraints=validateConstraintConfig({min_active_cds:5,max_active_cds:2,max_cd_volume_share:0.2}); add('Restrições inválidas bloqueadas',!badConstraints.valid,'ConstraintEngine',badConstraints.errors.join('; '));
  const opt=runOptimization({companyId,baselineBundle,objective:obj,constraints:{min_active_cds:1,max_active_cds:999,max_cd_volume_share:1,max_risk_level:'high',allow_tax_disabled:true},optimizerConfig:{method:'exact_discrete',max_candidates:2000,seed:42}});
  add('Otimizador exato roda',opt.optimizer_status==='success' && opt.search_log.simulated_candidates>0 && opt.search_log.method_applied==='exact_discrete','ScenarioOptimizer',`${opt.search_log.valid_candidates} válidos`);
  add('Search log consistente',opt.search_log.valid_candidates+opt.search_log.invalid_candidates===opt.search_log.simulated_candidates && !opt.search_log.space_limited,'SearchLogPanel','válidos + inválidos = simulados');
  add('Estratégia e cobertura expostas',opt.search_log.search_strategy==='broad_then_refine' && Number(opt.search_log.coverage_ratio)>=0 && opt.search_log.refinement_rounds===2,'ScenarioOptimizer',`${opt.search_log.search_strategy} · cobertura ${opt.search_log.coverage_ratio}`);
  add('Melhor por custo exposto',!!opt.search_log.best_by_total_cost_scenario_id && opt.best_by_total_cost?.scenario_id===opt.search_log.best_by_total_cost_scenario_id,'ScenarioOptimizer',opt.search_log.best_by_total_cost_scenario_id||'—');
  return checks;
}
export function renderPhase4Checks(checks){return checks.map(c=>`<div class="check-item"><span class="check-result ${c.pass?'check-pass':'check-fail'}">${c.pass?'OK':'FALHA'}</span><span><span class="check-title">${c.name}</span><span class="check-detail">${c.module} · ${c.message}</span></span></div>`).join('')}
