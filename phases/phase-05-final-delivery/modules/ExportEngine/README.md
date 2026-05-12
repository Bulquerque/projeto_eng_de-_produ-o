# ExportEngine

## Fase
Fase 5 — `phase-05-final-delivery`

## O que faz
Exporta resultados, cenários, auditoria e relatórios em formatos simples para entrega ou reuso.

## Implementação real
`/fase-5-entrega-final`

## Input JSON
```json
{
  "payload": {},
  "format": "json|csv|html",
  "filename": "resultado_empresa1_cenario3.json"
}
```

## Output JSON
```json
{
  "downloadReady": true,
  "filename": "resultado_empresa1_cenario3.json",
  "mimeType": "application/json"
}
```

## Funções internas
- `['toJson(payload)', 'Serializa JSON.']`
- `['toCsv(rows)', 'Converte linhas para CSV.']`
- `['toHtml(report)', 'Gera HTML exportável.']`
- `['triggerDownload(blob, filename)', 'Dispara download no navegador.']`

## Módulos chamados
- `['ExecutiveReport', 'Exporta relatório.']`
- `['AuditTrail', 'Exporta auditoria.']`
- `['ScenarioPersistence', 'Exporta/importa cenários.']`

## Testes
```json
{
  "unit": [
    "JSON exportado é parseável",
    "CSV contém cabeçalho"
  ],
  "integration": [
    "botão exportar gera arquivo"
  ],
  "manual": [
    "baixar arquivo e abrir"
  ],
  "acceptance": [
    "export não pode sair vazio"
  ]
}
```

## Debug
Abra `/debug/`, procure `ExportEngine` e rode os testes listados.
