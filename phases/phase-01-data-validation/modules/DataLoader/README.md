# DataLoader

## Fase
Fase 1 — `phase-01-data-validation`

## O que faz
Centraliza a leitura dos arquivos estáticos JSON/CSV usados pela interface. É o módulo que garante que os dados vêm dos caminhos relativos corretos.

## Implementação real
`global`

## Input JSON
```json
{
  "requests": [
    {
      "key": "catalog",
      "path": "data/catalog.json",
      "type": "json"
    },
    {
      "key": "inventory",
      "path": "data/validation/workbook_sheet_inventory.csv",
      "type": "csv"
    }
  ]
}
```

## Output JSON
```json
{
  "loaded": {
    "catalog": {},
    "inventory": []
  },
  "errors": [],
  "missing": []
}
```

## Funções internas
- `['fetchJson(path)', 'Carrega JSON e retorna objeto parseado com erro amigável.']`
- `['fetchText(path)', 'Carrega CSV/texto sem tentar converter automaticamente.']`
- `['parseCsv(text)', 'Converte CSV simples para array de objetos quando necessário.']`
- `['loadAll(requests)', 'Executa as leituras essenciais e acumula erros.']`

## Módulos chamados
- nenhum declarado

## Testes
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

## Debug
Abra `/debug/`, procure `DataLoader` e rode os testes listados.
