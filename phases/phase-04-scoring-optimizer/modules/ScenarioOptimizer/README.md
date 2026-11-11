# ScenarioOptimizer

## Fase
Fase 4 — `phase-04-scoring-optimizer`

## O que faz
Roda busca leve no navegador, simula candidatos, aplica restrições, normaliza métricas e ranqueia.

## Implementação real
`assets/js/phase4/scenario-optimizer.js`

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
- `runOptimization`

## Contagem do espaço de busca

`candidate_space_size` conta o espaço discreto declarado pelo gerador: subconjuntos não vazios dos CDs-base multiplicados pelos valores discretos configurados para frete, estoque, tributo e demanda. Para `n` CDs e uma combinação fixa das demais dimensões, o tamanho teórico é `2^n - 1`.

Refinamentos que mudam apenas os CDs continuam pertencendo a esse espaço teórico, mesmo quando o catálogo inicial limitado não os gerou. Eles aumentam os candidatos simulados e a cobertura, mas não o denominador. Só um refinamento que muda uma dimensão para fora dos valores declarados é contado como ponto adicional fora do espaço-base. O log separa tamanho-base, refinamentos únicos, refinamentos dentro/fora do domínio e tamanho contado. Refinamentos fora do domínio mantêm `exact_search_space=false`; um ranking desses candidatos não prova ótimo global em um espaço ampliado.

`generated_candidates` conta candidatos produzidos antes da remoção de repetições entre rodadas; `simulated_candidates` conta candidatos únicos que chegaram à avaliação. A completude do espaço-base depende de `search_space_complete`, não apenas de esses totais coincidirem.

## Módulos chamados
- `CandidateScenarioGenerator`
- `ScenarioSimulator`
- `ConstraintEngine`
- `ScenarioMetricExtractor`
- `MetricNormalizer`
- `ScenarioScoring`

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
    "tests/run_all_tests.py deve terminar com ALL_PHASE5_PACKAGE_TESTS_OK"
  ]
}
```

## Debug
Abra `/debug/`, procure `ScenarioOptimizer` e rode os testes listados.
