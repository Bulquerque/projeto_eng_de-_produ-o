# ScenarioComparator

## Fase
Fase 3 — `phase-03-scenario-arena`

## O que faz
Compara múltiplos cenários da mesma empresa contra o baseline correto, mostrando custo, saving, serviço, risco e tributo.

## Implementação real
`assets/js/phase3/scenario-comparator.js`

## Input JSON
```json
{
  "baselineScenarioId": "baseline_empresa1",
  "scenarios": [
    {
      "scenarioId": "baseline_empresa1"
    },
    {
      "scenarioId": "empresa1_custom_001"
    }
  ],
  "metrics": [
    "cost",
    "saving",
    "service",
    "risk",
    "tax"
  ]
}
```

## Output JSON
```json
{
  "comparisonTable": [],
  "deltaVsBaseline": [],
  "bestByCost": "empresa1_custom_001",
  "warnings": []
}
```

## Funções internas
- `['assertSameCompany(scenarios)', 'Impede comparação entre empresas.']`
- `['computeScenarioDelta(baseline, scenario)', 'Calcula diferença contra base.']`
- `['buildComparisonTable(scenarios)', 'Monta tabela lado a lado.']`
- `['rankByMetric(scenarios, metric)', 'Ordena por métrica escolhida.']`

## Módulos chamados
- `['CostEngine', 'Usa custos calculados.']`
- `['TaxEngine', 'Usa tributos calculados.']`
- `['ScenarioQualityCheck', 'Usa scores e alertas.']`

## Testes
```json
{
  "unit": [
    "baseline saving = 0",
    "cross-company bloqueado"
  ],
  "integration": [
    "cenários criados aparecem na tabela"
  ],
  "manual": [
    "comparar Base, 3 CDs e ES"
  ],
  "acceptance": [
    "saving sempre usa baseline da mesma empresa"
  ]
}
```

## Debug
Abra `/debug/`, procure `ScenarioComparator` e rode os testes listados.
