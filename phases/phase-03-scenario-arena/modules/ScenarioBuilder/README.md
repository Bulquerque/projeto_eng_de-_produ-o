# ScenarioBuilder

## Fase
Fase 3 — `phase-03-scenario-arena`

## O que faz
Permite criar cenários manuais a partir do baseline, mudando CDs ativos, alocação, frete, estoque, demanda, modo tributário e outras premissas controladas.

## Implementação real
`assets/js/phase3/scenario-builder.js`

## Input JSON
```json
{
  "baselineScenario": {
    "scenarioId": "baseline_empresa1"
  },
  "changes": {
    "activeCds": [
      "RJ",
      "SP",
      "ES"
    ],
    "freightMultiplier": 1.1,
    "inventoryDays": 35,
    "taxMode": "current"
  }
}
```

## Output JSON
```json
{
  "scenario": {
    "scenarioId": "empresa1_custom_001",
    "company": "empresa1",
    "isBaseline": false,
    "changesApplied": []
  },
  "validation": {
    "valid": true,
    "errors": [],
    "warnings": []
  }
}
```

## Funções internas
- `['createScenarioFromBaseline(baseline)', 'Clona baseline com versionamento.']`
- `['applyScenarioChanges(scenario, changes)', 'Aplica alterações do usuário.']`
- `['rebuildScenarioFlows(scenario)', 'Recalcula fluxos quando CD/alocação muda.']`
- `['nameScenario(scenario, name)', 'Define nome legível e ID.']`

## Módulos chamados
- `['ScenarioValidator', 'Valida alterações.']`
- `['FlowBuilder', 'Recria fluxos.']`
- `['CostEngine', 'Calcula custos do cenário.']`
- `['TaxEngine', 'Calcula tributos se ligado.']`

## Testes
```json
{
  "unit": [
    "cenário mantém company",
    "changesApplied registra mudanças"
  ],
  "integration": [
    "cenário criado aparece no comparador"
  ],
  "manual": [
    "fechar um CD e conferir mudança visual"
  ],
  "acceptance": [
    "cenário inválido gera erro claro"
  ]
}
```

## Debug
Abra `/debug/`, procure `ScenarioBuilder` e rode os testes listados.
