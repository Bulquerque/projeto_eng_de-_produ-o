# ScenarioChangeExplainer

## Fase
Fase 3 — `phase-03-scenario-arena`

## O que faz
Gera explicação textual do que mudou e por que o cenário ganhou ou perdeu.

## Implementação real
`assets/js/phase3/scenario-change-explainer.js`

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
Abra `/debug/`, procure `ScenarioChangeExplainer` e rode os testes listados.
