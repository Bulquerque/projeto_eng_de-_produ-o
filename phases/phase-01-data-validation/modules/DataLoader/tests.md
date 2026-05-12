# Testes

```json
{
  "unit": [
    "fetchJson rejeita JSON inválido com mensagem clara",
    "parseCsv preserva cabeçalhos"
  ],
  "integration": [
    "catalog.json carrega",
    "workbook_sheet_inventory.csv carrega"
  ],
  "manual": [
    "abrir DevTools e confirmar ausência de 404 nos arquivos principais"
  ],
  "acceptance": [
    "falha de um arquivo aparece na tela e não some silenciosamente"
  ]
}
```
