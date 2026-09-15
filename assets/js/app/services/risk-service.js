export async function runRiskAnalysis({
  provider,
  selectedScenario,
  deterministicResult,
  config = {},
}) {
  if (!provider) throw new Error('Provider ausente para análise de risco.');
  return provider.runRiskSuite({ selectedScenario, deterministicResult, config });
}
