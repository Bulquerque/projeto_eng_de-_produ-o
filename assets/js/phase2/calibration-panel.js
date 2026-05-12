import {escapeHtml,formatBRL,formatPct,renderTable,statusClass} from '../shared/common.js';

function n(value){const parsed=Number(value); return Number.isFinite(parsed)?parsed:null}

function buildReferenceRows(fit,costs){
  const directRows=Array.isArray(fit?.errors_by_metric)?fit.errors_by_metric:[];
  if(directRows.length)return directRows;
  const referenceResults=costs?.reference_results||null;
  const simulated=costs?.costs||{};
  if(!referenceResults||!Object.keys(referenceResults).length)return [];
  return Object.entries(referenceResults).map(([metric,reference])=>{
    const simulatedValue=n(simulated[metric]);
    const referenceValue=n(reference);
    const absoluteError=simulatedValue==null||referenceValue==null?null:simulatedValue-referenceValue;
    const percentageError=referenceValue===0||simulatedValue==null||referenceValue==null?null:((simulatedValue-referenceValue)/referenceValue)*100;
    const absPct=percentageError==null?null:Math.abs(percentageError);
    const status=absPct==null?'sem_referencia':absPct<=3?'OK':absPct<=10?'atenção':'alto_desvio';
    return {metric,reference:referenceValue,simulated:simulatedValue,absolute_error:absoluteError,percentage_error:percentageError,status};
  });
}

function buildComparisonSource(fit,costs){
  if(fit?.reference_source)return fit.reference_source;
  if(costs?.cost_basis==='computed_proxy')return 'Baseline estrutural proxy calculado a partir de demanda, distância e premissas.';
  if(costs?.cost_basis)return costs.cost_basis;
  return 'Sem referência consolidada disponível.';
}

export function renderCalibrationPanel(fit,costs=null){
  const rows=buildReferenceRows(fit,costs);
  const score=fit?.base_fit_score==null?'pendente':`${fit.base_fit_score}/100`;
  const source=buildComparisonSource(fit,costs);
  const pendingNote=rows.length?'<p class="small-note">Comparação real exibida a partir da referência canônica disponível; o Base Fit Score oficial segue pendente.</p>':'<p class="benchmark-pending">Benchmark histórico pendente: existe baseline estrutural proxy, mas não há custo histórico consolidado para fechar o score oficial.</p>';
  return `<div class="fit-score-layout"><div class="fit-score-card ${statusClass(fit?.status)}"><span class="metric-label">Base Fit Score</span><strong class="fit-score-value">${escapeHtml(score)}</strong><span class="status-chip ${statusClass(fit?.status)}">${escapeHtml(fit?.status||'sem status')}</span><p>${escapeHtml(source)}</p>${rows.length&&fit?.status==='benchmark_pending'?'<p class="small-note">A comparação real está disponível, mas o score continua pendente por não haver benchmark independente.</p>':''}</div><div class="fit-table-wrap">${rows.length?renderTable(rows,[{label:'Métrica',value:'metric'},{label:'Referência',value:r=>formatBRL(r.reference,true)},{label:'Simulado',value:r=>formatBRL(r.simulated,true)},{label:'Erro',value:r=>r.percentage_error==null?'—':formatPct(r.percentage_error,2)},{label:'Status',value:'status'}],20):pendingNote}</div></div>`;
}

export function buildCalibrationWarnings(fit,costs=null){
  if(!fit)return ['Base Fit ausente.'];
  const rows=buildReferenceRows(fit,costs);
  if(fit.status==='benchmark_pending'){
    return rows.length
      ? ['Comparação real disponível via referência canônica; Base Fit Score permanece pendente sem benchmark independente.']
      : [costs?.cost_basis==='computed_proxy'
          ? 'Baseline estrutural proxy calculado a partir de demanda, distância e premissas; Base Fit histórico permanece pendente.'
          : 'Sem benchmark consolidado: a comparação é contra baseline calculado, não contra histórico real.'];
  }
  return rows.filter(r=>String(r.status||'').toLowerCase()!=='ok').map(r=>`${r.metric}: erro ${r.percentage_error}%`);
}
