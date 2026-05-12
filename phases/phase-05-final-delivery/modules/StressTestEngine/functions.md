# Funções internas

- `['applyStressCase(scenario, stressCase)', 'Cria versão estressada.']`
- `['runStressCase(stressedScenario)', 'Calcula cenário sob choque.']`
- `['compareStressVsBaseline(result)', 'Mede saving e piora.']`
- `['calculateRobustnessScore(results)', 'Agrega robustez.']`

# Dependências externas

- `['ScenarioBuilder', 'Aplicar mudanças temporárias.']`
- `['CostEngine', 'Recalcular custos.']`
- `['TaxEngine', 'Recalcular tributo.']`
- `['ScenarioComparator', 'Comparar contra base.']`