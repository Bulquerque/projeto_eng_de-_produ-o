# StressCaseLibrary

## Fase
Fase 5 — `phase-05-final-delivery`

## O que faz
Fornece casos padrão e conservadores de stress test.

## Implementação real
`assets/js/phase5/stress-case-library.js`

## Input JSON
```json
{
  "company_id": "empresa1|empresa2",
  "selected_scenario": "{}",
  "baseline_bundle": "{}",
  "objective": "{}",
  "stress_cases": "[]"
}
```

## Output JSON
```json
{
  "decision_package": "{}",
  "recommendation": "{}",
  "stress_results": "[]",
  "audit": "{}",
  "warnings": "[]",
  "errors": "[]"
}
```

## Funções internas
- `getDefaultStressCases`
- `buildStressCaseLibrary`

## Módulos chamados
- `StressTestEngine`

## Testes
```json
{
  "unit": [
    "tests/08_fase5_entrega_final/test_phase5_stress_logic.py",
    "tests/08_fase5_entrega_final/test_phase5_recommendation_logic.py",
    "tests/08_fase5_entrega_final/test_phase5_audit_export.py",
    "tests/08_fase5_entrega_final/test_phase5_final_qa.py"
  ],
  "integration": [
    "tests/08_fase5_entrega_final/test_phase5_http_server.py"
  ],
  "manual": [
    "checklist na página /fase-5-entrega-final/"
  ],
  "acceptance": [
    "tests/run_all_tests.py deve terminar com ALL_PHASE5_PACKAGE_TESTS_OK"
  ]
}
```

## Debug
Abra `/debug/`, procure `StressCaseLibrary` e rode os testes listados.
