# AppBootstrap

## Fase
Fase 1 — `phase-01-data-validation`

## O que faz
Inicializa o site estático, carrega os artefatos mínimos da Fase 1 e dispara a primeira renderização segura da interface.

## Implementação real
`/ e /fase-1-validacao/`

## Input JSON
```json
{
  "rootElementId": "app",
  "paths": {
    "catalog": "data/catalog.json",
    "qualitySummary": "data/data_quality_summary.json",
    "pathReport": "data/validation/path_resolution_report.json",
    "auditSummary": "data/validation/final_v6_audit_summary.json",
    "workbookInventory": "data/validation/workbook_sheet_inventory.csv"
  },
  "defaultCompany": "empresa1"
}
```

## Output JSON
```json
{
  "appState": {
    "selectedCompany": "empresa1",
    "loaded": true,
    "loadErrors": []
  },
  "renderedSections": [
    "company-selector",
    "dataset-panel",
    "quality-panel",
    "audit-panel",
    "manual-checklist"
  ]
}
```

## Funções internas
- `['initApp()', 'Cria o estado inicial e coordena a sequência de carregamento.']`
- `['loadPhase1Artifacts(paths)', 'Busca catálogo, qualidade, auditoria e inventário.']`
- `['renderApp(state)', 'Renderiza a interface conforme a empresa selecionada.']`
- `['showFatalError(error)', 'Mostra erro visível quando a inicialização falha.']`

## Módulos chamados
- `['DataLoader.fetchJson', 'Carregar JSONs declarados em paths.']`
- `['CompanySelector.render', 'Renderizar seleção Empresa 1 / Empresa 2.']`
- `['DatasetPanel.render', 'Mostrar datasets da empresa selecionada.']`
- `['PathAuditPanel.render', 'Mostrar status dos caminhos auditados.']`

## Testes
```json
{
  "unit": [
    "initApp cria estado inicial com empresa1",
    "showFatalError não deixa a página em branco"
  ],
  "integration": [
    "site abre via http.server",
    "todos os artefatos da Fase 1 são carregados"
  ],
  "manual": [
    "abrir / e confirmar que os painéis aparecem",
    "abrir /fase-1-validacao/ e confirmar que redireciona/mostra o mesmo app"
  ],
  "acceptance": [
    "não usa path absoluto",
    "não quebra se um painel tiver warning"
  ]
}
```

## Debug
Abra `/debug/`, procure `AppBootstrap` e rode os testes listados.
