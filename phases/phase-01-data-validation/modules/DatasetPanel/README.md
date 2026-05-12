# DatasetPanel

## Fase
Fase 1 — `phase-01-data-validation`

## O que faz
Mostra os datasets core e arquivos brutos vinculados à empresa selecionada, com caminhos relativos visíveis para auditoria manual.

## Implementação real
`/ e /fase-1-validacao/`

## Input JSON
```json
{
  "selectedCompany": "empresa1",
  "catalog": {
    "companies": {
      "empresa1": {
        "coreDatasets": []
      }
    }
  },
  "pathReport": {
    "missing_paths": []
  }
}
```

## Output JSON
```json
{
  "visibleDatasets": [
    {
      "name": "demand_records",
      "path": "data/empresa1/core/demand_records.json",
      "status": "OK"
    }
  ],
  "missingDatasets": []
}
```

## Funções internas
- `['getCompanyDatasets(catalog, companyId)', 'Filtra datasets pela empresa selecionada.']`
- `['normalizeDatasetRecord(record)', 'Padroniza nome, descrição, formato e path.']`
- `['renderDatasetCard(dataset)', 'Cria o card visual do dataset.']`
- `['markDatasetStatus(dataset, pathReport)', 'Marca OK/warning/error conforme auditoria de paths.']`

## Módulos chamados
- `['PathAuditPanel.getPathStatus', 'Checar se o caminho está em missing_paths.']`
- `['DataLoader.fetchJson', 'Opcionalmente carregar metadados dos datasets.']`

## Testes
```json
{
  "unit": [
    "getCompanyDatasets filtra corretamente",
    "path absoluto é sinalizado"
  ],
  "integration": [
    "Empresa 1 mostra demanda/distância/premissas",
    "Empresa 2 mostra tabelas core e scenario_blocks"
  ],
  "manual": [
    "copiar um caminho exibido e conferir que existe na pasta"
  ],
  "acceptance": [
    "todo dataset obrigatório tem path visível"
  ]
}
```

## Debug
Abra `/debug/`, procure `DatasetPanel` e rode os testes listados.
