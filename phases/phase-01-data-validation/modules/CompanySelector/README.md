# CompanySelector

## Fase
Fase 1 — `phase-01-data-validation`

## O que faz
Permite alternar entre Empresa 1 e Empresa 2 mantendo isolamento total de datasets, indicadores e mensagens.

## Implementação real
`/ e /fase-1-validacao/`

## Input JSON
```json
{
  "companies": [
    {
      "id": "empresa1",
      "name": "Empresa 1",
      "description": "Demanda + Distância + Premissas"
    },
    {
      "id": "empresa2",
      "name": "Empresa 2",
      "description": "Workbook de malha logística"
    }
  ],
  "selectedCompany": "empresa1"
}
```

## Output JSON
```json
{
  "selectedCompany": "empresa2",
  "selectionChanged": true
}
```

## Funções internas
- `['renderCompanyCards(companies)', 'Monta os cards/botões das empresas.']`
- `['selectCompany(companyId)', 'Atualiza estado global e solicita rerender.']`
- `['getSelectedCompany(state)', 'Retorna a empresa ativa de forma segura.']`

## Módulos chamados
- `['DatasetPanel.render', 'Re-renderizar datasets da empresa.']`
- `['DataQualityPanel.render', 'Re-renderizar qualidade da empresa.']`
- `['ManualChecklist.render', 'Atualizar checklist sem perder estado.']`

## Testes
```json
{
  "unit": [
    "empresa1 é padrão",
    "selectCompany troca para empresa2"
  ],
  "integration": [
    "trocar empresa muda cards de datasets",
    "trocar empresa não mistura paths"
  ],
  "manual": [
    "clicar Empresa 1 e depois Empresa 2",
    "confirmar que os títulos/datasets mudam"
  ],
  "acceptance": [
    "nenhum dataset da Empresa 2 aparece quando Empresa 1 está selecionada"
  ]
}
```

## Debug
Abra `/debug/`, procure `CompanySelector` e rode os testes listados.
