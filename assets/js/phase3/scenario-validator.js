import { resolveTaxRegime, resolveTaxModeForRegime, listTaxModes } from '../shared/tax-reform-config.js';
const VALID_TAX_MODES=new Set(listTaxModes());
const VALID_TAX_REGIMES=new Set(['legacy_current','disabled','reform_2026','reform_2027_2028','transition_2029','transition_2030','transition_2031','transition_2032','reform_full_2033']);
const VALID_REALLOCATION=new Set(['nearest_available_cd','first_available_cd','keep_if_active_else_first']);
function check(cond,code,message,severity='error'){return cond?null:{code,message,severity}}
export function validateScenario({companyId,scenario,baselineBundle,constraints={}}){
  const errors=[]; const warnings=[]; const checks=[];
  function add(result){if(!result)return; (result.severity==='warning'?warnings:errors).push(result); checks.push({check:result.code,status:'failed',severity:result.severity,message:result.message})}
  const base=baselineBundle?.model||{}; const c=scenario?.changes||{};
  const rawTaxMode = c.tax_mode != null ? String(c.tax_mode) : null;
  const rawTaxRegime = c.tax_regime != null ? String(c.tax_regime) : null;
  const resolvedTaxRegime=resolveTaxRegime({taxMode:c.tax_mode, taxRegime:c.tax_regime, year:c.tax_year});
  add(check(!!scenario,'SCENARIO_REQUIRED','Cenário ausente.'));
  add(check(scenario?.company_id===companyId,'COMPANY_MATCH','O cenário não pertence à empresa selecionada.'));
  add(check(scenario?.base_scenario_id===base.scenario_id,'BASELINE_MATCH','O cenário não usa o baseline correto.'));
  add(check(Array.isArray(c.active_cds)&&c.active_cds.length>0,'ACTIVE_CD_REQUIRED','O cenário precisa ter pelo menos um CD ativo.'));
  add(check((c.active_cds||[]).every(cd=>(base.active_cds||[]).includes(cd)),'ACTIVE_CD_KNOWN','Todos os CDs ativos precisam existir no baseline.'));
  add(check(Number(c.freight_multiplier)>0,'FREIGHT_POSITIVE','Multiplicador de frete precisa ser maior que zero.'));
  add(check(Number(c.demand_multiplier)>0,'DEMAND_POSITIVE','Multiplicador de demanda precisa ser maior que zero.'));
  add(check(Number(c.inventory_days)>=0,'INVENTORY_NON_NEGATIVE','Dias de estoque não podem ser negativos.'));
  add(check(Number(c.wacc)>=0,'WACC_NON_NEGATIVE','WACC não pode ser negativo.'));
  add(check(Boolean(resolvedTaxRegime),'TAX_MODE_VALID','Modo tributário inválido.'));
  const taxModeCandidate = String(c.tax_mode || resolveTaxModeForRegime(resolvedTaxRegime));
  add(check(!rawTaxMode || VALID_TAX_MODES.has(taxModeCandidate),'TAX_MODE_KNOWN','Modo tributário inválido.'));
  add(check(!rawTaxRegime || VALID_TAX_REGIMES.has(rawTaxRegime),'TAX_REGIME_VALID','Regime tributário inválido.'));
  add(check(VALID_REALLOCATION.has(String(c.reallocation_rule||'nearest_available_cd')),'REALLOCATION_RULE_VALID','Regra de realocação inválida.'));
  if((c.closed_cds||[]).length){warnings.push({code:'REALLOCATION_REQUIRED',severity:'warning',message:'Um ou mais CDs foram fechados; fluxos serão realocados.'})}
  if((c.active_cds||[]).length===1){warnings.push({code:'SINGLE_CD_CONCENTRATION',severity:'warning',message:'Cenário com um único CD pode concentrar risco operacional.'})}
  checks.push({check:'basic_structure',status:errors.length?'failed':'passed',severity:errors.length?'error':'ok',message:errors.length?'Corrigir erros antes de simular.':'Estrutura mínima válida.'});
  return {scenario_id:scenario?.scenario_id,valid:errors.length===0,severity:errors.length?'error':(warnings.length?'warning':'ok'),errors,warnings,checks,validation_summary:{active_cds_count:(c.active_cds||[]).length,closed_cds_count:(c.closed_cds||[]).length,requires_reallocation:(c.closed_cds||[]).length>0}}
}
