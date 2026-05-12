# ScenarioPersistence

## Fase
Fase 3 — `phase-03-scenario-arena`

## O que faz
Salva cenários criados pelo usuário no navegador e permite exportar/importar JSON de cenário.

## Implementação real
`assets/js/phase3/scenario-persistence.js`

## Input JSON
```json
{
  "scenario": {},
  "storageKey": "savedScenarios_empresa1",
  "operation": "save|load|delete|export|import"
}
```

## Output JSON
```json
{
  "savedScenarios": [],
  "exportJson": {},
  "status": "OK"
}
```

## Funções internas
- `['saveScenario(scenario)', 'Salva no localStorage por empresa.']`
- `['loadScenarios(company)', 'Lê cenários da empresa.']`
- `['deleteScenario(id)', 'Remove cenário.']`
- `['exportScenario(id)', 'Gera JSON baixável.']`
- `['importScenario(json)', 'Importa e valida cenário.']`

## Módulos chamados
- `['ScenarioValidator', 'Valida antes de salvar/importar.']`
- `['AuditTrail', 'Registra origem do cenário importado/exportado.']`

## Testes
```json
{
  "unit": [
    "salva e carrega por empresa",
    "delete remove só o cenário escolhido"
  ],
  "integration": [
    "cenário salvo aparece após reload"
  ],
  "manual": [
    "salvar cenário, recarregar, conferir"
  ],
  "acceptance": [
    "cenários da Empresa 1 não aparecem na Empresa 2"
  ]
}
```

## Debug
Abra `/debug/`, procure `ScenarioPersistence` e rode os testes listados.
