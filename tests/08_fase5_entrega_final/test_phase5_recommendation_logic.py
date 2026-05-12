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
import {runStressTests} from './assets/js/phase5/stress-test-engine.js';
import {calculateRobustness} from './assets/js/phase5/robustness-scorer.js';
import {buildRecommendation} from './assets/js/phase5/recommendation-engine.js';
for (const companyId of ['empresa1','empresa2']) {
 const bundle=decryptJson(`data/${companyId}/phase2/phase2_bundle.json`);
 const objective=buildObjective({companyId,objectiveName:'Teste',weights:{total_cost:30,service_quality:25,operational_risk:20,tax_impact:15,inventory_efficiency:10}});
 const opt=runOptimization({companyId,baselineBundle:bundle,objective,constraints:{min_active_cds:1,max_active_cds:999,max_cd_volume_share:1,max_risk_level:'high',allow_tax_disabled:true},optimizerConfig:{method:'exact_discrete',max_candidates:5000,seed:11}});
 const sel=selectFinalScenario({companyId,optimizerResult:opt,selectionMode:'best_by_score'});
 const selected=sel.selected_scenario;
 const stress=runStressTests({companyId,selectedScenario:selected.scenario,baselineBundle:bundle});
 const robustness=calculateRobustness({companyId,scenarioId:selected.scenario_id,stressResults:stress.stress_results,quality:selected.quality});
 if(!(robustness.robustness_score>=0 && robustness.robustness_score<=100)) throw new Error('bad robustness');
 const baseline=Number(bundle.costs.costs.total_with_tax); const total=Number(selected.result.total_with_tax); const comp={saving_abs:baseline-total,saving_pct:baseline?((baseline-total)/baseline*100):0};
 const rec=buildRecommendation({companyId,selectedScenario:selected,comparison:comp,quality:selected.quality,robustness,objective});
 if(!['recommended','recommended_with_warnings','not_recommended'].includes(rec.recommendation_status)) throw new Error('bad recommendation status');
 if(!rec.executive_summary) throw new Error('missing executive summary');
 if(comp.saving_pct<0 && rec.recommendation_status==='recommended') throw new Error('negative saving cannot be clean recommended');
}
console.log('PHASE5_NODE_RECOMMENDATION_OK');
'''
res=subprocess.run(['node','--input-type=module','-e',code],cwd=ROOT,text=True,capture_output=True,timeout=120)
assert res.returncode==0, res.stderr+res.stdout
print(res.stdout.strip())
print('PHASE5_RECOMMENDATION_LOGIC_OK')
