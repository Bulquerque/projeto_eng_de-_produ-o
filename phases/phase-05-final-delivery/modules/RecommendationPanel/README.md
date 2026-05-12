# RecommendationPanel

## Fase
Fase 5 — `phase-05-final-delivery`

## O que faz
Apresenta recomendação final com ressalvas: melhor cenário por objetivo, robustez, riscos e próximos passos.

## Implementação real
`/fase-5-entrega-final`

## Input JSON
```json
{
  "rankedScenarios": [],
  "stressResults": [],
  "explanations": [],
  "objective": {}
}
```

## Output JSON
```json
{
  "recommendation": {
    "recommendedScenarioId": "cenario_3cds",
    "confidence": "medium",
    "why": [],
    "caveats": []
  }
}
```

## Funções internas
- `['selectRecommendedScenario(ranked, stress)', 'Seleciona cenário equilibrando score e robustez.']`
- `['buildCaveats(alerts)', 'Monta ressalvas.']`
- `['classifyConfidence(evidence)', 'Classifica confiança.']`
- `['renderRecommendation(rec)', 'Mostra recomendação visual.']`

## Módulos chamados
- `['ScenarioScoring', 'Recebe ranking.']`
- `['StressTestEngine', 'Recebe robustez.']`
- `['ExplainabilityEngine', 'Recebe drivers e trade-offs.']`

## Testes
```json
{
  "unit": [
    "cenário com score alto e stress ruim recebe ressalva",
    "sem evidência suficiente => confiança baixa"
  ],
  "integration": [
    "recomendação aparece no relatório"
  ],
  "manual": [
    "conferir se recomendação não ignora riscos"
  ],
  "acceptance": [
    "recomendação precisa citar caveats quando existirem"
  ]
}
```

## Debug
Abra `/debug/`, procure `RecommendationPanel` e rode os testes listados.
