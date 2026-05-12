# ObjectiveProfileLibrary

## Fase
Fase 4 — `phase-04-scoring-optimizer`

## O que faz
Fornece perfis prontos de decisão: CFO, Supply, Fiscal, Conservador, Crescimento e Balanceado.

## Implementação real
`assets/js/phase4/objective-profile-library.js`

## Input JSON
```json
{
  "company_id": "empresa1|empresa2",
  "objective": "{}",
  "scenario_results": "[]",
  "constraints": "{}",
  "optimizer_config": "{}"
}
```

## Output JSON
```json
{
  "result": "{}",
  "scored_scenarios": "[]",
  "search_log": "{}",
  "warnings": "[]",
  "errors": "[]"
}
```

## Funções internas
- `loadDefaultProfiles`
- `getProfileById`
- `cloneProfileAsObjective`
- `validateProfileWeights`

## Módulos chamados
- `ObjectiveBuilder`

## Testes
```json
{
  "unit": [
    "tests/07_fase4_score_otimizador/test_phase4_scoring_logic.py",
    "tests/07_fase4_score_otimizador/test_phase4_optimizer_logic.py"
  ],
  "integration": [
    "tests/07_fase4_score_otimizador/test_phase4_http_server.py"
  ],
  "manual": [
    "checklist na página /fase-4-score-otimizador/"
  ],
  "acceptance": [
    "tests/run_all_tests.py deve terminar com ALL_PHASE4_PACKAGE_TESTS_OK"
  ]
}
```

## Debug
Abra `/debug/`, procure `ObjectiveProfileLibrary` e rode os testes listados.
