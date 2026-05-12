# ScenarioQualityCheck

## Fase
Fase 3 — `phase-03-scenario-arena`

## O que faz
Avalia plausibilidade operacional do cenário, separando cenário barato de cenário realmente executável.

## Implementação real
`assets/js/phase3/scenario-quality-check.js`

## Input JSON
```json
{
  "scenario": {},
  "results": {},
  "constraints": {
    "maxConcentration": 0.65,
    "maxCdUtilization": 0.9,
    "maxDistanceIncreasePct": 20
  }
}
```

## Output JSON
```json
{
  "qualityScore": 78,
  "alerts": [
    {
      "severity": "warning",
      "message": "CD ES concentra 82% do volume"
    }
  ],
  "riskFlags": []
}
```

## Funções internas
- `['calculateConcentrationRisk(scenario)', 'Mede dependência de poucos CDs.']`
- `['calculateCapacityRisk(scenario, constraints)', 'Mede estouro de capacidade.']`
- `['calculateServiceProxy(scenario)', 'Usa distância/lead time proxy.']`
- `['aggregateQualityScore(parts)', 'Agrega qualidade 0-100.']`

## Módulos chamados
- `['ScenarioValidator', 'Recebe validade básica.']`
- `['ScenarioScoring', 'Entrega qualityScore para ranking.']`
- `['ExplainabilityEngine', 'Entrega alertas para explicação.']`

## Testes
```json
{
  "unit": [
    "100% volume em um CD gera alerta",
    "capacidade acima do limite gera severidade alta"
  ],
  "integration": [
    "Comparator mostra qualityScore"
  ],
  "manual": [
    "centralizar tudo e conferir alerta"
  ],
  "acceptance": [
    "custo baixo não apaga risco alto"
  ]
}
```

## Debug
Abra `/debug/`, procure `ScenarioQualityCheck` e rode os testes listados.
