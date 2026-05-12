# WorkbookInventoryPanel

## Fase
Fase 1 — `phase-01-data-validation`

## O que faz
Mostra o inventário de abas dos workbooks, especialmente para provar que as abas da Empresa 2 foram exportadas e mapeadas.

## Implementação real
`/ e /fase-1-validacao/`

## Input JSON
```json
{
  "inventoryRows": [
    {
      "empresa": "empresa2",
      "workbook": "Analise_Malha_Empresa2(1).xlsx",
      "sheet": "Cenários",
      "csv_export_path": "data/empresa2/source_exports/.../Cenários.csv"
    }
  ],
  "selectedCompany": "empresa2"
}
```

## Output JSON
```json
{
  "visibleSheets": [
    {
      "sheet": "Cenários",
      "status": "mapped",
      "coreMapping": [
        "scenario_blocks.json",
        "scenario_totals.json"
      ]
    }
  ],
  "sheetCount": 25
}
```

## Funções internas
- `['parseWorkbookInventory(csvText)', 'Converte o inventário CSV em linhas.']`
- `['filterInventoryByCompany(rows, companyId)', 'Filtra abas por empresa.']`
- `['detectSpecialSheets(rows)', 'Marca abas com tratamento especial, como Cenários.']`
- `['renderSheetInventoryTable(rows)', 'Mostra tabela compacta de abas e exports.']`

## Módulos chamados
- `['DataLoader.fetchText', 'Carregar workbook_sheet_inventory.csv.']`
- `['PathAuditPanel.getPathStatus', 'Validar paths de exports.']`

## Testes
```json
{
  "unit": [
    "Cenários é detectada como special sheet",
    "filtro por empresa não mistura workbooks"
  ],
  "integration": [
    "inventário mostra 53 abas auditadas",
    "Empresa 2 mostra 25 abas por workbook"
  ],
  "manual": [
    "verificar se Cenários mostra scenario_blocks/scenario_totals"
  ],
  "acceptance": [
    "toda aba auditada precisa ter export ou justificativa"
  ]
}
```

## Debug
Abra `/debug/`, procure `WorkbookInventoryPanel` e rode os testes listados.
