import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
code = r"""
import {buildObjective} from './assets/js/phase4/objective-builder.js';
import {validateObjective} from './assets/js/phase4/objective-validator.js';
import {normalizeMetrics} from './assets/js/phase4/metric-normalizer.js';
import {scoreScenarios} from './assets/js/phase4/scenario-scoring.js';
import {attachBaselineReference,compareExactRanking} from './assets/js/phase4/optimizer-utils.js';
import {MODEL_ASSUMPTIONS} from './assets/js/shared/model-assumptions.js';
const objective=buildObjective({companyId:'empresa1',objectiveName:'Teste',weights:{total_cost:40,service_quality:20,operational_risk:15,tax_impact:15,inventory_efficiency:10}});
if(!objective.valid) throw new Error('valid objective rejected');
if(Math.abs(objective.weights_sum-1)>1e-6) throw new Error('weights not normalized');
const bad=buildObjective({companyId:'empresa1',objectiveName:'Bad',weights:{total_cost:-1,service_quality:1}});
if(bad.valid) throw new Error('negative weight accepted');
const direct=validateObjective({...objective,company_id:null});
if(direct.valid) throw new Error('objective without company accepted');
const metrics=[
 {scenario_id:'a',scenario_name:'A',total_cost:100,service_quality:50,operational_risk:10,tax_impact:20,inventory_efficiency:60},
 {scenario_id:'b',scenario_name:'B',total_cost:90,service_quality:40,operational_risk:30,tax_impact:10,inventory_efficiency:70}
];
const norm=normalizeMetrics({companyId:'empresa1',scenarioMetrics:metrics});
for (const row of norm.normalized_metrics) for (const [k,v] of Object.entries(row)) if(k.endsWith('_score') && (v<0 || v>100)) throw new Error('normalization out of range');
const a=norm.normalized_metrics.find(x=>x.scenario_id==='a');
const b=norm.normalized_metrics.find(x=>x.scenario_id==='b');
if(!(b.total_cost_score>a.total_cost_score)) throw new Error('lower cost did not score higher');
if(!(a.operational_risk_score>b.operational_risk_score)) throw new Error('lower risk did not score higher');
const scored=scoreScenarios({companyId:'empresa1',objective,normalizedMetrics:norm.normalized_metrics});
if(scored.scored_scenarios.length!==2) throw new Error('scoring length mismatch');
if(scored.scored_scenarios.some(s=>s.final_score<0 || s.final_score>100)) throw new Error('score out of range');
const referenced=attachBaselineReference(
 {scenario_id:'candidate',total_with_tax:90,costs:{transfer_proxy_sensitivity:{points:[{delta_from_reference:5}]}}},
 {scenario_id:'baseline_reform',total_with_tax:100,tax_results:{tax_mode:'reform_2033',tax_regime:'reform_2033'}}
);
if(referenced.saving_abs!==10 || referenced.saving_pct!==10) throw new Error('same-regime baseline arithmetic failed');
if(referenced.baseline_reference.tax_regime!=='reform_2033') throw new Error('baseline regime metadata missing');
if(referenced.costs.transfer_proxy_sensitivity.points[0].saving_abs!==5) throw new Error('proxy sensitivity baseline arithmetic failed');

const profileMetrics=[
 {scenario_id:'custo',scenario_name:'Custo mínimo',total_cost:70,service_quality:35,operational_risk:80,tax_impact:35,inventory_efficiency:45},
 {scenario_id:'equilibrado',scenario_name:'Equilibrado',total_cost:85,service_quality:70,operational_risk:45,tax_impact:25,inventory_efficiency:70},
 {scenario_id:'servico',scenario_name:'Qualidade e serviço',total_cost:115,service_quality:100,operational_risk:10,tax_impact:20,inventory_efficiency:90}
];
const profileNorm=normalizeMetrics({companyId:'empresa1',scenarioMetrics:profileMetrics});
const profiles=[
 ['custo_minimo',MODEL_ASSUMPTIONS.scoring.objective_profiles.cost_minimum],
 ['equilibrado',MODEL_ASSUMPTIONS.scoring.objective_profiles.balanced],
 ['conservador',MODEL_ASSUMPTIONS.scoring.objective_profiles.conservative],
 ['qualidade_servico',MODEL_ASSUMPTIONS.scoring.objective_profiles.quality_service]
];
const winners=profiles.map(([name,weights])=>{
 const profileObjective=buildObjective({companyId:'empresa1',objectiveName:name,weights});
 return scoreScenarios({companyId:'empresa1',objective:profileObjective,normalizedMetrics:profileNorm.normalized_metrics}).scored_scenarios[0].scenario_id;
});
if(new Set(winners).size<2) throw new Error('weight sensitivity did not change the synthetic winner');

const withExtreme=normalizeMetrics({
 companyId:'empresa1',
 scenarioMetrics:[...metrics,{scenario_id:'extreme',scenario_name:'Extreme',total_cost:1000,service_quality:0,operational_risk:100,tax_impact:100,inventory_efficiency:0}]
});
const originalA=norm.normalized_metrics.find(row=>row.scenario_id==='a').total_cost_score;
const expandedA=withExtreme.normalized_metrics.find(row=>row.scenario_id==='a').total_cost_score;
if(originalA===expandedA) throw new Error('candidate-set sensitivity was not observable');
if(!withExtreme.candidate_set_dependent) throw new Error('candidate-set dependence metadata missing');
const withMissing=normalizeMetrics({companyId:'empresa1',scenarioMetrics:[
 {scenario_id:'missing',scenario_name:'Missing',total_cost:null,service_quality:null,operational_risk:null,tax_impact:null,inventory_efficiency:null},
 {scenario_id:'valid',scenario_name:'Valid',total_cost:100,service_quality:80,operational_risk:20,tax_impact:10,inventory_efficiency:70}
]});
const missingRow=withMissing.normalized_metrics.find(row=>row.scenario_id==='missing');
if(Object.entries(missingRow).some(([key,value])=>key.endsWith('_score') && value!==50)) throw new Error('missing metric must remain neutral, not numeric zero');
if(!(compareExactRanking(
 {final_score:90,result:{total_with_tax:null},quality:{risk_level:'low',quality_score:90},scenario_id:'missing'},
 {final_score:90,result:{total_with_tax:100},quality:{risk_level:'low',quality_score:90},scenario_id:'valid'}
)>0)) throw new Error('missing total must not outrank a finite total');
console.log('PHASE4_NODE_SCORING_OK');
"""
res = subprocess.run(['node', '--input-type=module', '-e', code], cwd=ROOT, text=True, capture_output=True)
assert res.returncode == 0, res.stderr + res.stdout
print(res.stdout.strip())
print('PHASE4_SCORING_LOGIC_OK')
