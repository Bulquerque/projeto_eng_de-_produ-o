# Funções internas

- `['parseWorkbookInventory(csvText)', 'Converte o inventário CSV em linhas.']`
- `['filterInventoryByCompany(rows, companyId)', 'Filtra abas por empresa.']`
- `['detectSpecialSheets(rows)', 'Marca abas com tratamento especial, como Cenários.']`
- `['renderSheetInventoryTable(rows)', 'Mostra tabela compacta de abas e exports.']`

# Dependências externas

- `['DataLoader.fetchText', 'Carregar workbook_sheet_inventory.csv.']`
- `['PathAuditPanel.getPathStatus', 'Validar paths de exports.']`