export const DEFAULT_OBJECTIVE_PROFILES = [
  {profile_id:'balanced',profile_name:'Perfil Balanceado',description:'Equilibra custo, qualidade, risco, tributo e estoque.',weights:{total_cost:0.30,service_quality:0.25,operational_risk:0.20,tax_impact:0.15,inventory_efficiency:0.10}},
  {profile_id:'cfo',profile_name:'Perfil CFO',description:'Prioriza custo total, impacto tributário e capital parado.',weights:{total_cost:0.50,service_quality:0.10,operational_risk:0.10,tax_impact:0.20,inventory_efficiency:0.10}},
  {profile_id:'supply',profile_name:'Perfil Supply',description:'Prioriza qualidade operacional, serviço e risco.',weights:{total_cost:0.20,service_quality:0.40,operational_risk:0.25,tax_impact:0.05,inventory_efficiency:0.10}},
  {profile_id:'fiscal',profile_name:'Perfil Fiscal',description:'Dá peso maior ao impacto tributário, sem ignorar custo e risco.',weights:{total_cost:0.25,service_quality:0.10,operational_risk:0.15,tax_impact:0.40,inventory_efficiency:0.10}},
  {profile_id:'conservative',profile_name:'Perfil Conservador',description:'Prioriza baixo risco e qualidade mesmo com saving menor.',weights:{total_cost:0.20,service_quality:0.30,operational_risk:0.35,tax_impact:0.05,inventory_efficiency:0.10}},
  {profile_id:'growth',profile_name:'Perfil Crescimento',description:'Prioriza serviço e flexibilidade operacional.',weights:{total_cost:0.20,service_quality:0.45,operational_risk:0.15,tax_impact:0.05,inventory_efficiency:0.15}}
];
export function loadDefaultProfiles(){return DEFAULT_OBJECTIVE_PROFILES.map(p=>({...p,weights:{...p.weights}}))}
export function getProfileById(profileId){const p=DEFAULT_OBJECTIVE_PROFILES.find(x=>x.profile_id===profileId); return p?{...p,weights:{...p.weights}}:null}
export function validateProfileWeights(profile){const sum=Object.values(profile?.weights||{}).reduce((a,b)=>a+Number(b||0),0); return {valid:Math.abs(sum-1)<1e-6,weights_sum:sum}}
export function cloneProfileAsObjective(profileId,companyId){const p=getProfileById(profileId)||getProfileById('balanced'); return {objective_name:p.profile_name,company_id:companyId,weights:{...p.weights},source_profile:p.profile_id}}
export function renderProfileDescription(profile){return `${profile.profile_name}: ${profile.description}`}
