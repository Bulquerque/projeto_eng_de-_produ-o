# DataQualityPanel

## Fase
Fase 1 — `phase-01-data-validation`

## O que faz
Exibe score de qualidade, contagens, warnings e erros já apurados na preparação dos dados.

## Implementação real
`/ e /fase-1-validacao/`

## Input JSON
```json
{
  "selectedCompany": "empresa1",
  "qualitySummary": {
    "empresa1": {
      "score": 92,
      "errors": [],
      "warnings": []
    }
  }
}
```

## Output JSON
```json
{
  "qualityViewModel": {
    "score": 92,
    "status": "OK",
    "errors": [],
    "warnings": []
  }
}
```

## Funções internas
- `['getQualityForCompany(summary, companyId)', 'Obtém o bloco de qualidade da empresa.']`
- `['classifyQualityStatus(score, errors)', 'Traduz score e erros em OK/warning/error.']`
- `['renderQualityMetric(metric)', 'Renderiza indicador principal.']`
- `['renderWarnings(warnings)', 'Lista alertas sem esconder informação.']`

## Módulos chamados
- `['DatasetPanel.getCompanyDatasets', 'Cruzar qualidade com datasets exibidos, se necessário.']`

## Testes
```json
{
  "unit": [
    "erro gera status error",
    "score baixo gera warning"
  ],
  "integration": [
    "painel muda ao trocar empresa"
  ],
  "manual": [
    "verificar se warnings aparecem em amarelo e erros em vermelho"
  ],
  "acceptance": [
    "não esconder problemas de dados"
  ]
}
```

## Debug
Abra `/debug/`, procure `DataQualityPanel` e rode os testes listados.
