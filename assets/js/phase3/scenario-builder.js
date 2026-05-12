import { resolveTaxRegime, resolveTaxModeForRegime, taxRegimeLabel } from '../shared/tax-reform-config.js';
function slugify(value){return String(value||'cenario').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,72)||'cenario'}
function unique(arr){return Array.from(new Set((arr||[]).filter(v=>v!==null&&v!==undefined&&String(v).trim()!=='')))}
export function createScenarioId(companyId,name){return `${companyId}_${slugify(name)}_${Date.now().toString(36)}`}
export function deriveClosedCds(baseCds,activeCds){const active=new Set(activeCds||[]); return (baseCds||[]).filter(cd=>!active.has(cd))}
export function sanitizeScenarioName(name){const clean=String(name||'').trim(); return clean||'Cenário customizado'}
export function buildScenarioFromForm({companyId,baselineBundle,formValues={},scenarioId=null}){
  const base=baselineBundle?.model||{};
  const baseCds=base.active_cds||[];
  const requested=unique(formValues.active_cds||baseCds);
  const scenarioName=sanitizeScenarioName(formValues.scenario_name);
  const taxMode=String(formValues.tax_mode||'current');
  const taxRegime=resolveTaxRegime({taxMode, taxRegime: formValues.tax_regime, year: formValues.tax_year});
  const changes={
    active_cds:requested,
    closed_cds:deriveClosedCds(baseCds,requested),
    freight_multiplier:Number(formValues.freight_multiplier??1),
    demand_multiplier:Number(formValues.demand_multiplier??1),
    inventory_days:Number(formValues.inventory_days??45),
    wacc:Number(formValues.wacc??0.15),
    tax_mode:taxMode,
    tax_regime:taxRegime,
    tax_regime_label:taxRegimeLabel(taxRegime),
    reallocation_rule:String(formValues.reallocation_rule||'nearest_available_cd')
  };
  if (formValues.tax_year != null) {
    changes.tax_year = Number(formValues.tax_year);
  }
  return {
    scenario_id:scenarioId||createScenarioId(companyId,scenarioName),
    scenario_name:scenarioName,
    company_id:companyId,
    base_scenario_id:base.scenario_id,
    scenario_type:formValues.scenario_type||'manual',
    changes,
    scenario_ready:true,
    metadata:{phase:3,source:'ScenarioBuilder',created_at:'browser_runtime',tax_mode:resolveTaxModeForRegime(taxRegime),tax_regime:taxRegime},
    warnings:[],
    errors:[]
  }
}
export function buildChangeLog(scenario){const c=scenario?.changes||{}; const out=[]; if((c.closed_cds||[]).length)out.push(`CDs fechados: ${c.closed_cds.join(', ')}`); if(Number(c.freight_multiplier)!==1)out.push(`Frete x${c.freight_multiplier}`); if(Number(c.demand_multiplier)!==1)out.push(`Demanda x${c.demand_multiplier}`); if(Number(c.inventory_days)!==45)out.push(`Estoque: ${c.inventory_days} dias`); if(c.tax_mode==='disabled')out.push('Tributário desligado'); if(c.tax_regime&&c.tax_regime!=='legacy_current')out.push(`Regime fiscal: ${taxRegimeLabel(c.tax_regime)}`); return out}
