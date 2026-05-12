export function selectFinalScenario({ companyId, optimizerResult, selectionMode = 'best_by_score', manualScenarioId = null } = {}) {
  if (!companyId) return { company_id: companyId, selected_scenario: null, errors: ['company_id ausente'], warnings: [] };

  // Módos automáticos operam sobre o top-10 já ranqueado.
  // Modo manual precisa do conjunto completo para não descartar IDs fora do top-10.
  const autoPool = optimizerResult?.best_scenarios || optimizerResult?.scored_scenarios || [];
  const fullPool = optimizerResult?.scored_scenarios?.length
    ? optimizerResult.scored_scenarios
    : optimizerResult?.best_scenarios || [];

  const pool = selectionMode === 'manual' ? fullPool : autoPool;
  const usingLimitedPool = selectionMode === 'manual' && !optimizerResult?.scored_scenarios?.length;

  if (!pool.length) return { company_id: companyId, selected_scenario: null, errors: ['nenhum cenário disponível para seleção'], warnings: [] };

  const candidates = pool.filter(s => (s.company_id || s.scenario?.company_id || s.result?.company_id) === companyId || !s.company_id);
  let selected = null;
  let selection_reason = '';
  if (selectionMode === 'manual') {
    selected = candidates.find(s => s.scenario_id === manualScenarioId || s.scenario?.scenario_id === manualScenarioId || s.result?.scenario_id === manualScenarioId);
    selection_reason = `Cenário escolhido manualmente: ${manualScenarioId}`;
  } else if (selectionMode === 'best_by_cost') {
    selected = [...candidates].sort((a, b) => Number(a.result?.total_with_tax ?? a.total_with_tax ?? Infinity) - Number(b.result?.total_with_tax ?? b.total_with_tax ?? Infinity))[0];
    selection_reason = 'Cenário com menor total estimado.';
  } else if (selectionMode === 'best_by_robustness') {
    selected = [...candidates].sort((a, b) => Number(b.robustness?.robustness_score ?? b.quality?.quality_score ?? 0) - Number(a.robustness?.robustness_score ?? a.quality?.quality_score ?? 0))[0];
    selection_reason = 'Cenário com melhor proxy de robustez/qualidade disponível.';
  } else {
    selected = [...candidates].sort((a, b) => Number(b.final_score ?? 0) - Number(a.final_score ?? 0))[0];
    selection_reason = 'Cenário com maior score final no objetivo selecionado.';
  }
  const warnings = [];
  if (usingLimitedPool) warnings.push('scored_scenarios ausente: seleção manual restrita ao top-10 (best_scenarios).');
  if (!selected) return { company_id: companyId, selected_scenario: null, errors: ['cenário selecionado não encontrado'], warnings };
  if ((selected.quality?.risk_level || '').toLowerCase() === 'high') warnings.push('Cenário selecionado tem risco alto.');
  return {
    company_id: companyId,
    selected_scenario_id: selected.scenario_id || selected.scenario?.scenario_id || selected.result?.scenario_id,
    selected_scenario: selected,
    selection_mode: selectionMode,
    selection_reason,
    warnings,
    errors: []
  };
}
