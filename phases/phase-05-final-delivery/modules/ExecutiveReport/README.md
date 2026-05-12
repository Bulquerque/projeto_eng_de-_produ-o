# ExecutiveReport

## Fase
Fase 5 — `phase-05-final-delivery`

## O que faz
Monta relatório executivo do cenário: resumo, comparação, saving, riscos, stress, premissas e recomendação defendível.

## Implementação real
`/fase-5-entrega-final`

## Input JSON
```json
{
  "company": "empresa1",
  "baseline": {},
  "selectedScenario": {},
  "comparison": {},
  "stress": {},
  "explanation": {},
  "audit": {}
}
```

## Output JSON
```json
{
  "report": {
    "title": "Relatório Executivo - Empresa 1",
    "sections": [
      "Resumo",
      "Comparação",
      "Riscos",
      "Stress",
      "Premissas"
    ]
  },
  "exportFormats": [
    "html",
    "json",
    "csv_summary"
  ]
}
```

## Funções internas
- `['buildExecutiveSummary(inputs)', 'Cria resumo de decisão.']`
- `['buildCostWaterfallData(comparison)', 'Prepara decomposição de saving.']`
- `['buildRiskSection(alerts)', 'Monta seção de riscos.']`
- `['buildAssumptionsSection(audit)', 'Lista premissas.']`
- `['renderReport(report)', 'Renderiza relatório.']`

## Módulos chamados
- `['ExplainabilityEngine', 'Recebe narrativa.']`
- `['AuditTrail', 'Recebe premissas/fontes.']`
- `['ExportEngine', 'Exporta arquivos.']`

## Testes
```json
{
  "unit": [
    "relatório tem empresa e cenário",
    "relatório inclui saving e premissas"
  ],
  "integration": [
    "relatório gera após stress"
  ],
  "manual": [
    "ler relatório e ver se conta a história"
  ],
  "acceptance": [
    "relatório não pode faltar audit trail"
  ]
}
```

## Debug
Abra `/debug/`, procure `ExecutiveReport` e rode os testes listados.
