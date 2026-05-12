# PathAuditPanel

## Fase
Fase 1 — `phase-01-data-validation`

## O que faz
Mostra a auditoria dos caminhos do pacote: quantidade checada, faltantes, abas auditadas e arquivos core obrigatórios.

## Implementação real
`/ e /fase-1-validacao/`

## Input JSON
```json
{
  "pathReport": {
    "result": "OK",
    "path_count_checked": 55,
    "missing_paths": []
  },
  "auditSummary": {
    "workbooks_checked": 5,
    "sheets_checked": 53
  }
}
```

## Output JSON
```json
{
  "auditStatus": "OK",
  "missingCount": 0,
  "checkedPaths": 55,
  "workbooksChecked": 5,
  "sheetsChecked": 53
}
```

## Funções internas
- `['getPathStatus(path, report)', 'Retorna OK/missing para um path.']`
- `['summarizeAudit(report, summary)', 'Cria indicadores de auditoria.']`
- `['renderAuditBadges(summary)', 'Mostra badges visuais de OK/warning/error.']`
- `['renderMissingPaths(paths)', 'Lista paths faltantes quando existirem.']`

## Módulos chamados
- nenhum declarado

## Testes
```json
{
  "unit": [
    "missing_paths vazio gera OK",
    "missing_paths > 0 gera error"
  ],
  "integration": [
    "path report é exibido na página"
  ],
  "manual": [
    "confirmar visualmente missing_paths = 0"
  ],
  "acceptance": [
    "nenhum caminho crítico pode ficar invisível"
  ]
}
```

## Debug
Abra `/debug/`, procure `PathAuditPanel` e rode os testes listados.
