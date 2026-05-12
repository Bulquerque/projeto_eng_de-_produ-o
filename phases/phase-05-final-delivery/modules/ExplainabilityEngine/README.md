# ExplainabilityEngine

## Fase
Fase 5 — `phase-05-final-delivery`

## O que faz
Gera explicações textuais simples e auditáveis sobre por que um cenário ganhou, perdeu ou ficou arriscado.

## Implementação real
`/fase-5-entrega-final`

## Input JSON
```json
{
  "baselineResults": {},
  "scenarioResults": {},
  "delta": {},
  "qualityAlerts": [],
  "stressResults": []
}
```

## Output JSON
```json
{
  "explanation": "O cenário reduziu armazenagem, mas aumentou distribuição.",
  "mainDrivers": [
    "redução de armazenagem",
    "aumento de distância média"
  ],
  "riskNarrative": "Cenário concentra volume em um CD."
}
```

## Funções internas
- `['identifyMainDrivers(delta)', 'Escolhe maiores variações.']`
- `['describeTradeoffs(delta, alerts)', 'Gera texto de trade-off.']`
- `['describeStressBehavior(stressResults)', 'Resume robustez.']`
- `['guardAgainstOverclaim(text, evidence)', 'Evita afirmações sem dado.']`

## Módulos chamados
- `['ScenarioComparator', 'Recebe delta.']`
- `['ScenarioQualityCheck', 'Recebe alertas.']`
- `['StressTestEngine', 'Recebe stress.']`
- `['ExecutiveReport', 'Envia narrativa final.']`

## Testes
```json
{
  "unit": [
    "se armazenagem cai, texto menciona queda",
    "se risco alto, texto menciona risco"
  ],
  "integration": [
    "relatório inclui explicação"
  ],
  "manual": [
    "ler explicação e conferir com gráficos"
  ],
  "acceptance": [
    "não dizer que é melhor se score/robustez não sustentam"
  ]
}
```

## Debug
Abra `/debug/`, procure `ExplainabilityEngine` e rode os testes listados.
