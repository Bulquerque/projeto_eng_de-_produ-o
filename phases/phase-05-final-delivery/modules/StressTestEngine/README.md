# StressTestEngine

## Fase
Fase 5 — `phase-05-final-delivery`

## O que faz
Aplica choques de frete, demanda, WACC, armazenagem, capacidade e tributo para testar robustez do cenário.

## Implementação real
`/fase-5-entrega-final`

## Input JSON
```json
{
  "scenario": {},
  "stressCases": [
    {
      "name": "frete_mais_20",
      "changes": {
        "freightMultiplier": 1.2
      }
    }
  ],
  "baseline": {}
}
```

## Output JSON
```json
{
  "stressResults": [
    {
      "case": "frete_mais_20",
      "totalCost": 11000000,
      "savingVsBase": 0.03,
      "stillPositive": true
    }
  ],
  "robustnessScore": 74,
  "alerts": []
}
```

## Funções internas
- `['applyStressCase(scenario, stressCase)', 'Cria versão estressada.']`
- `['runStressCase(stressedScenario)', 'Calcula cenário sob choque.']`
- `['compareStressVsBaseline(result)', 'Mede saving e piora.']`
- `['calculateRobustnessScore(results)', 'Agrega robustez.']`

## Módulos chamados
- `['ScenarioBuilder', 'Aplicar mudanças temporárias.']`
- `['CostEngine', 'Recalcular custos.']`
- `['TaxEngine', 'Recalcular tributo.']`
- `['ScenarioComparator', 'Comparar contra base.']`

## Testes
```json
{
  "unit": [
    "frete +20% aumenta transporte",
    "demanda +15% aumenta volume/custo variável"
  ],
  "integration": [
    "stress roda nos top cenários"
  ],
  "manual": [
    "rodar stress no cenário vencedor"
  ],
  "acceptance": [
    "saving negativo em stress gera alerta"
  ]
}
```

## Debug
Abra `/debug/`, procure `StressTestEngine` e rode os testes listados.
