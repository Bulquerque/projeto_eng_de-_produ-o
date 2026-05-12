from pathlib import Path
import subprocess, textwrap
ROOT=Path(__file__).resolve().parents[2]
code=r'''
import {buildObjective} from './assets/js/phase4/objective-builder.js';
import {validateObjective} from './assets/js/phase4/objective-validator.js';
import {normalizeMetrics} from './assets/js/phase4/metric-normalizer.js';
import {scoreScenarios} from './assets/js/phase4/scenario-scoring.js';
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
console.log('PHASE4_NODE_SCORING_OK');
'''
res=subprocess.run(['node','--input-type=module','-e',code],cwd=ROOT,text=True,capture_output=True)
assert res.returncode==0, res.stderr+res.stdout
print(res.stdout.strip())
print('PHASE4_SCORING_LOGIC_OK')
