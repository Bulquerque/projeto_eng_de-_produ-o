# phase-04-scoring-optimizer

Organização por feature da Fase 4.

- [`CandidateScenarioGenerator`](modules/CandidateScenarioGenerator/README.md) — Gera candidatos automaticamente combinando CDs ativos, frete, estoque, demanda e modo tributário.
- [`ConstraintEngine`](modules/ConstraintEngine/README.md) — Aplica restrições de CDs, concentração, risco e modo tributário antes de ranquear cenários.
- [`MetricNormalizer`](modules/MetricNormalizer/README.md) — Normaliza métricas heterogêneas para escala 0-100 usando min-max e direção de preferência.
- [`ObjectiveBuilder`](modules/ObjectiveBuilder/README.md) — Cria função objetivo com pesos customizados, normaliza pesos e gera preview da fórmula.
- [`ObjectiveProfileLibrary`](modules/ObjectiveProfileLibrary/README.md) — Fornece perfis prontos de decisão: CFO, Supply, Fiscal, Conservador, Crescimento e Balanceado.
- [`ObjectiveValidator`](modules/ObjectiveValidator/README.md) — Valida se a função objetivo tem empresa, métricas conhecidas e pesos coerentes.
- [`Phase4Dashboard`](modules/Phase4Dashboard/README.md) — Renderiza a página /fase-4-score-otimizador/ com objective builder, ranking, otimizador e validação.
- [`Phase4TestPanel`](modules/Phase4TestPanel/README.md) — Executa testes automáticos da Fase 4 na interface.
- [`RankingExplainer`](modules/RankingExplainer/README.md) — Explica por que o cenário ranqueado venceu ou quais componentes pesaram no score.
- [`ScenarioMetricExtractor`](modules/ScenarioMetricExtractor/README.md) — Extrai métricas comparáveis dos cenários simulados: custo, qualidade, risco, tributo e eficiência de estoque.
- [`ScenarioOptimizer`](modules/ScenarioOptimizer/README.md) — Roda busca leve no navegador, simula candidatos, aplica restrições, normaliza métricas e ranqueia.
- [`ScenarioScoring`](modules/ScenarioScoring/README.md) — Calcula score ponderado e ranking final dos cenários.
- [`SearchLogPanel`](modules/SearchLogPanel/README.md) — Renderiza log da busca com candidatos gerados, simulados, válidos, inválidos e melhor score.
- [`TradeoffFrontier`](modules/TradeoffFrontier/README.md) — Monta uma fronteira simples de trade-off entre custo total e qualidade.
