import { resolveTaxRegime, taxRegimeLabel } from '../shared/tax-reform-config.js';
function pct(v){return Number.isFinite(Number(v))?`${Number(v).toLocaleString('pt-BR',{maximumFractionDigits:2})}%`:'—'}
export function explainScenarioChanges({baselineBundle,scenario,comparisonRow,quality}){
  const c=scenario?.changes||{}; const out=[]; const drivers=[];
  if((c.closed_cds||[]).length){out.push(`CDs fechados: ${c.closed_cds.join(', ')}.`); drivers.push('fechamento de CD')}
  if(Number(c.freight_multiplier)!==1){out.push(`Frete multiplicado por ${c.freight_multiplier}.`); drivers.push('alteração de frete')}
  if(Number(c.demand_multiplier)!==1){out.push(`Demanda multiplicada por ${c.demand_multiplier}.`); drivers.push('alteração de demanda')}
  if(Number(c.inventory_days)!==45){out.push(`Política de estoque ajustada para ${c.inventory_days} dias.`); drivers.push('estoque')}
  const taxRegime=resolveTaxRegime({taxMode:c.tax_mode,taxRegime:c.tax_regime,year:c.tax_year});
  if(c.tax_mode==='disabled' || c.tax_regime==='disabled'){out.push('Camada tributária desligada para análise isolada do custo logístico.'); drivers.push('tributário desligado')}
  else if(String(c.tax_mode).startsWith('reform_') || String(taxRegime).startsWith('transition_') || String(taxRegime).startsWith('reform_')){
    out.push(`Regime fiscal selecionado: ${taxRegimeLabel(taxRegime)}.`);
    const explanation = comparisonRow?.tax_explanation || '';
    if(explanation) out.push(explanation);
    drivers.push('reforma tributária');
  }
  if(!out.length)out.push('Nenhuma alteração estrutural relevante foi aplicada contra o baseline.');
  const saving=Number(comparisonRow?.saving_pct||0); const result=saving>0?`O cenário gera saving estimado de ${pct(saving)} contra o baseline.`:saving<0?`O cenário aumenta custo em ${pct(Math.abs(saving))} contra o baseline.`:'O cenário fica empatado com o baseline em custo total.';
  const risk=quality?.risk_level?` Risco operacional: ${quality.risk_level}.`:'';
  return {scenario_id:scenario?.scenario_id,change_summary:out,result_summary:result+risk,main_drivers:drivers.length?drivers:['sem driver dominante']}
}
