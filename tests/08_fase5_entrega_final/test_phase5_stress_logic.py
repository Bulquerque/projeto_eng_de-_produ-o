from pathlib import Path
import subprocess
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tests.crypto_helpers import NODE_DECRYPT_HELPER
ROOT=Path(__file__).resolve().parents[2]
code=NODE_DECRYPT_HELPER + r'''
import fs from 'fs';
import {buildObjective} from './assets/js/phase4/objective-builder.js';
import {runOptimization} from './assets/js/phase4/scenario-optimizer.js';
import {selectFinalScenario} from './assets/js/phase5/final-scenario-selector.js';
import {buildStressCaseLibrary} from './assets/js/phase5/stress-case-library.js';
import {applyStressCaseToScenario,runStressTests} from './assets/js/phase5/stress-test-engine.js';
import {runSensitivity} from './assets/js/phase5/sensitivity-engine.js';
for (const companyId of ['empresa1','empresa2']) {
 const bundle=decryptJson(`data/${companyId}/phase2/phase2_bundle.json`);
 const objective=buildObjective({companyId,objectiveName:'Teste',weights:{total_cost:30,service_quality:25,operational_risk:20,tax_impact:15,inventory_efficiency:10}});
 const opt=runOptimization({companyId,baselineBundle:bundle,objective,constraints:{min_active_cds:1,max_active_cds:999,max_cd_volume_share:1,max_risk_level:'high',allow_tax_disabled:true},optimizerConfig:{method:'exact_discrete',max_candidates:5000,seed:42}});
 const sel=selectFinalScenario({companyId,optimizerResult:opt,selectionMode:'best_by_score'});
 if(!sel.selected_scenario) throw new Error('no selected scenario');
 const scenario=sel.selected_scenario.scenario;
 const original=JSON.stringify(scenario);
 const cases=buildStressCaseLibrary({companyId}).stress_cases;
 if(cases.length<7) throw new Error('not enough stress cases');
 const stressed=applyStressCaseToScenario({scenario,stressCase:cases.find(c=>c.case_id==='frete_mais_20')});
 if(JSON.stringify(scenario)!==original) throw new Error('stress mutated original');
 if(!(stressed.changes.freight_multiplier > (scenario.changes.freight_multiplier||1))) throw new Error('freight stress not applied');
 const stress=runStressTests({companyId,selectedScenario:scenario,baselineBundle:bundle,stressCases:cases});
 if(stress.stress_results.length!==cases.length) throw new Error('stress count mismatch');
 if(!stress.stress_results.some(r=>r.case_id==='frete_mais_20')) throw new Error('missing freight case');
 const sens=runSensitivity({companyId,selectedScenario:scenario,baselineBundle:bundle,sensitivityConfig:{variable:'freight_multiplier',values:[0.9,1,1.2]}});
 if(sens.sensitivity_results.length!==3) throw new Error('sensitivity count mismatch');
 if(sens.sensitivity_results[2].total_with_tax < sens.sensitivity_results[0].total_with_tax) throw new Error('freight sensitivity not monotonic enough');
}
console.log('PHASE5_NODE_STRESS_OK');
'''
res=subprocess.run(['node','--input-type=module','-e',code],cwd=ROOT,text=True,capture_output=True,timeout=120)
assert res.returncode==0, res.stderr+res.stdout
print(res.stdout.strip())
print('PHASE5_STRESS_LOGIC_OK')
