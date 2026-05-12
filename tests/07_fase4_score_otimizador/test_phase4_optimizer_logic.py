from pathlib import Path
import subprocess
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tests.crypto_helpers import NODE_DECRYPT_HELPER
ROOT=Path(__file__).resolve().parents[2]
code=NODE_DECRYPT_HELPER + r'''
import fs from 'fs';
import {buildObjective} from './assets/js/phase4/objective-builder.js';
import {generateCandidateScenarios} from './assets/js/phase4/candidate-scenario-generator.js';
import {runOptimization} from './assets/js/phase4/scenario-optimizer.js';
import {buildTradeoffFrontier} from './assets/js/phase4/tradeoff-frontier.js';
for (const companyId of ['empresa1','empresa2']) {
 const bundle=decryptJson(`data/${companyId}/phase2/phase2_bundle.json`);
 const objective=buildObjective({companyId,objectiveName:'Teste',weights:{total_cost:40,service_quality:20,operational_risk:15,tax_impact:15,inventory_efficiency:10}});
 const gen=generateCandidateScenarios({companyId,baselineBundle:bundle,generationConfig:{max_candidates:15}});
 if(gen.candidate_scenarios.length===0) throw new Error('no candidates');
 if(gen.candidate_scenarios.length>15) throw new Error('max_candidates ignored');
 if(gen.candidate_scenarios.some(s=>s.company_id!==companyId)) throw new Error('company mismatch in candidates');
 if(gen.candidate_scenarios.some(s=>(s.changes.active_cds||[]).length===0)) throw new Error('candidate without CD');
 const opt=runOptimization({companyId,baselineBundle:bundle,objective,constraints:{min_active_cds:1,max_active_cds:999,max_cd_volume_share:1,max_risk_level:'high',allow_tax_disabled:true},optimizerConfig:{method:'exact_discrete',max_candidates:5000,seed:77}});
 const opt2=runOptimization({companyId,baselineBundle:bundle,objective,constraints:{min_active_cds:1,max_active_cds:999,max_cd_volume_share:1,max_risk_level:'high',allow_tax_disabled:true},optimizerConfig:{method:'exact_discrete',max_candidates:5000,seed:77}});
 if(opt.optimizer_status!=='success') throw new Error('optimizer failed');
 if(opt.search_log.valid_candidates+opt.search_log.invalid_candidates!==opt.search_log.simulated_candidates) throw new Error('search log inconsistent');
 if(opt.search_log.method_applied!=='exact_discrete' || opt.search_log.space_limited) throw new Error('optimizer not exact');
 if(!opt.best_scenarios.length) throw new Error('no best scenarios');
 if(opt.best_scenarios[0].scenario_id!==opt2.best_scenarios[0].scenario_id) throw new Error('seed not reproducible');
 const frontier=buildTradeoffFrontier({companyId,scenarioRecords:opt.scenario_records,scoredScenarios:opt.scored_scenarios});
 if(frontier.frontier_points.some(p=>!p.scenario_id)) throw new Error('frontier without scenario_id');
}
console.log('PHASE4_NODE_OPTIMIZER_OK');
'''
res=subprocess.run(['node','--input-type=module','-e',code],cwd=ROOT,text=True,capture_output=True)
assert res.returncode==0, res.stderr+res.stdout
print(res.stdout.strip())
print('PHASE4_OPTIMIZER_LOGIC_OK')
