# MonteCarloEngine

## Fase
Fase 3 - `phase-03-scenario-arena`

## O que faz
Roda simulações probabilisticas reprodutiveis sobre o cenario selecionado e resume distribuicao, percentis, risco, curva do custo total e drivers mais influentes.

## Implementacao real
`assets/js/phase3/monte-carlo-engine.js`

## Input JSON
```json
{
  "company_id": "empresa1|empresa2",
  "selected_scenario": "{}",
  "baseline_bundle": "{}",
  "deterministic_result": "{}",
  "iterations": 300,
  "seed": 42,
  "config": {}
}
```

## Output JSON
```json
{
  "company_id": "empresa1|empresa2",
  "scenario_id": "scenario_id",
  "monte_carlo_status": "success",
  "config": {},
  "samples": [],
  "summary": {},
  "warnings": [],
  "errors": []
}
```

### Summary inclui
- `histogram`
- `percentile_curve`
- `total_percentile_curve`
- `driver_importance`
- `probability_saving_positive`
- `probability_saving_loss`
- `risk_band`

## Funcoes internas
- `buildMonteCarloConfig`
- `runMonteCarloSimulation`

## Modulos chamados
- `ScenarioSimulator`

## Testes
```json
{
  "unit": [
    "tests/06_fase3_cenarios/test_phase3_logic.py"
  ],
  "integration": [
    "tests/06_fase3_cenarios/test_phase3_file_structure.py"
  ],
  "manual": [
    "checklist na pagina /#/simulacao-otimizacao"
  ],
  "acceptance": [
    "mesma seed gera o mesmo resumo",
    "o cenario original nao e mutado"
  ]
}
```

## Debug
Abra `/debug/` e procure `MonteCarloEngine`.
