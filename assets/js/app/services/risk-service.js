export async function runRiskAnalysis({
  provider,
  selectedScenario,
  deterministicResult,
  config = {},
}) {
  if (!provider) throw new Error('Provider ausente para análise de risco.');
  return provider.runRiskSuite({ selectedScenario, deterministicResult, config });
}

export function buildRiskViewModel(risk = {}) {
  return {
    monte_carlo: risk.monte_carlo || null,
    stress: risk.stress || null,
    sensitivity: risk.sensitivity || null,
    sensitivity_matrix: risk.sensitivity_matrix || null,
    robustness: risk.robustness || null,
    warnings: [
      ...(risk.monte_carlo?.warnings || []),
      ...(risk.stress?.warnings || []),
      ...(risk.sensitivity?.warnings || []),
      ...(risk.robustness?.warnings || []),
    ],
  };
}
