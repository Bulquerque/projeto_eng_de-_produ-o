# MetricNormalizer

## Fase
Fase 4 — `phase-04-scoring-optimizer`

## O que faz
Normaliza métricas heterogêneas para escala 0-100 usando min-max e direção de preferência.

## Implementação real
`assets/js/phase4/metric-normalizer.js`

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
- `normalizeMetrics`
- `defaultMetricDirections`

## Módulos chamados
- `ScenarioMetricExtractor`
- `ObjectiveValidator`

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
Abra `/debug/`, procure `MetricNormalizer` e rode os testes listados.
