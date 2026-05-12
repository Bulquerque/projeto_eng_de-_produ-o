# ScenarioLibrary

## Fase
Fase 3 — `phase-03-scenario-arena`

## O que faz
Carrega baseline, cenários exemplo e cenários salvos por empresa.

## Implementação real
`assets/js/phase3/scenario-library.js`

## Input JSON
```json
{
  "company_id": "empresa1|empresa2",
  "scenario": "{}",
  "baseline_bundle": "{}"
}
```

## Output JSON
```json
{
  "result": "{}",
  "warnings": "[]",
  "errors": "[]"
}
```

## Funções internas
- `ver arquivo JS para funções exportadas e helpers internos`

## Módulos chamados
- `módulos phase2/phase3 conforme implementação`

## Testes
```json
{
  "unit": [
    "test_phase3_logic.py"
  ],
  "integration": [
    "test_phase3_http_server.py"
  ],
  "manual": [
    "checklist na página /fase-3-cenarios/"
  ],
  "acceptance": [
    "tests/run_all_tests.py deve terminar com ALL_PHASE3_PACKAGE_TESTS_OK"
  ]
}
```

## Debug
Abra `/debug/`, procure `ScenarioLibrary` e rode os testes listados.
