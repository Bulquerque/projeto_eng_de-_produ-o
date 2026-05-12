# Fase 4 — Módulos, contratos, funções e dependências

Todos os módulos abaixo pertencem à Fase 4 e estão implementados em `assets/js/phase4/`.

## ObjectiveProfileLibrary

**Arquivo:** `assets/js/phase4/objective-profile-library.js`

**O que faz:** fornece perfis prontos de função objetivo.

**Input JSON:**
```json
{"company_id":"empresa2","profile_id":"cfo"}
```

**Output JSON:**
```json
{"profile_id":"cfo","profile_name":"Perfil CFO","weights":{"total_cost":0.5,"service_quality":0.1,"operational_risk":0.1,"tax_impact":0.2,"inventory_efficiency":0.1}}
```

**Funções internas:** `loadDefaultProfiles`, `getProfileById`, `cloneProfileAsObjective`, `validateProfileWeights`, `renderProfileDescription`.

**Chama:** `ObjectiveBuilder`.

**Testes:** perfis somam 1, possuem descrição e preenchem o builder.

## ObjectiveBuilder

**Arquivo:** `assets/js/phase4/objective-builder.js`

**O que faz:** cria a função objetivo com pesos customizados e normaliza pesos.

**Input JSON:**
```json
{"companyId":"empresa1","objectiveName":"Perfil customizado","weights":{"total_cost":40,"service_quality":20,"operational_risk":15,"tax_impact":15,"inventory_efficiency":10}}
```

**Output JSON:**
```json
{"objective_id":"empresa1_perfil_customizado","company_id":"empresa1","weights_sum":1,"valid":true,"weights":{"total_cost":0.4,"service_quality":0.2,"operational_risk":0.15,"tax_impact":0.15,"inventory_efficiency":0.1}}
```

**Funções internas:** `normalizeWeightInput`, `calculateWeightsSum`, `buildObjective`, `buildObjectivePreviewText`.

**Chama:** `ObjectiveValidator` e `ObjectiveProfileLibrary`.

**Testes:** pesos em 100 viram 1; peso negativo falha; objetivo inválido bloqueia scoring.

## ObjectiveValidator

**Arquivo:** `assets/js/phase4/objective-validator.js`

**O que faz:** valida company_id, métricas conhecidas, pesos numéricos e pelo menos um peso positivo.

**Input JSON:**
```json
{"objective":{"company_id":"empresa2","weights":{"total_cost":0.4,"service_quality":0.2}}}
```

**Output JSON:**
```json
{"valid":true,"weights_sum":0.6,"missing_metrics":[],"errors":[],"warnings":["pesos somam 0.6000; serão normalizados no builder."]}
```

**Funções internas:** `validateObjective`, `knownMetrics`.

**Chama:** `ObjectiveBuilder` e `MetricNormalizer`.

**Testes:** sem company_id falha; métrica desconhecida falha; todos os pesos zero falham.

## ScenarioMetricExtractor

**Arquivo:** `assets/js/phase4/scenario-metric-extractor.js`

**O que faz:** transforma resultados de cenários em métricas padronizadas.

**Input JSON:**
```json
{"companyId":"empresa2","scenarioResults":[{"scenario_id":"s1","costs":{"total_logistics_cost":100},"tax_results":{"total_tax_impact":20},"quality":{"quality_score":80,"risk_level":"medium"}}]}
```

**Output JSON:**
```json
{"company_id":"empresa2","scenario_metrics":[{"scenario_id":"s1","total_cost":120,"service_quality":80,"operational_risk":55,"tax_impact":20,"inventory_efficiency":50}]}
```

**Funções internas:** `extractScenarioMetrics`, conversão de risco textual para número e cálculo de eficiência de estoque.

**Chama:** `ScenarioSimulator` e `ScenarioQualityCheck`.

**Testes:** risco low/medium/high vira número; tributo desligado vira zero; métrica mantém scenario_id.

## MetricNormalizer

**Arquivo:** `assets/js/phase4/metric-normalizer.js`

**O que faz:** normaliza métricas para 0-100, respeitando se maior ou menor é melhor.

**Input JSON:**
```json
{"scenarioMetrics":[{"scenario_id":"a","total_cost":100},{"scenario_id":"b","total_cost":90}],"metricDirections":{"total_cost":"lower_is_better"}}
```

**Output JSON:**
```json
{"normalized_metrics":[{"scenario_id":"a","total_cost_score":0},{"scenario_id":"b","total_cost_score":100}]}
```

**Funções internas:** `normalizeMetrics`, `defaultMetricDirections`.

**Chama:** `ScenarioMetricExtractor` e `ObjectiveValidator`.

**Testes:** menor custo pontua mais; maior risco pontua menos; score fica entre 0 e 100.

## ScenarioScoring

**Arquivo:** `assets/js/phase4/scenario-scoring.js`

**O que faz:** calcula score final e ranking.

**Input JSON:**
```json
{"objective":{"weights":{"total_cost":0.4}},"normalizedMetrics":[{"scenario_id":"s1","total_cost_score":90}]}
```

**Output JSON:**
```json
{"scored_scenarios":[{"scenario_id":"s1","final_score":36,"rank":1,"score_components":{"total_cost":36}}]}
```

**Funções internas:** `scoreScenarios`, `getBestScenario`.

**Chama:** `ObjectiveValidator` e `MetricNormalizer`.

**Testes:** score é soma ponderada; ranking ordena maior score primeiro.

## ConstraintEngine

**Arquivo:** `assets/js/phase4/constraint-engine.js`

**O que faz:** filtra cenários por CDs, concentração, risco e modo tributário.

**Input JSON:**
```json
{"scenario":{"changes":{"active_cds":["RJ","SP"]}},"quality":{"risk_level":"medium","quality_metrics":{"max_cd_volume_share":0.6}},"constraints":{"min_active_cds":1,"max_cd_volume_share":0.75}}
```

**Output JSON:**
```json
{"passes_constraints":true,"violations":[],"warnings":[]}
```

**Funções internas:** `evaluateConstraints`, `validateConstraintConfig`.

**Chama:** `ScenarioQualityCheck` e `ScenarioValidator`.

**Testes:** CD abaixo do mínimo falha; concentração acima do limite falha; tax disabled bloqueia quando configurado.

## CandidateScenarioGenerator

**Arquivo:** `assets/js/phase4/candidate-scenario-generator.js`

**O que faz:** gera candidatos combinando CDs ativos, frete, estoque, demanda e modo tributário.

**Input JSON:**
```json
{"companyId":"empresa2","generationConfig":{"max_candidates":120}}
```

**Output JSON:**
```json
{"candidate_scenarios":[{"scenario_id":"empresa2_candidate_001","company_id":"empresa2","changes":{"active_cds":["RJ","SP"]}}],"generation_summary":{"generated":120}}
```

**Funções internas:** `generateCandidateScenarios` e helpers de combinação.

**Chama:** `ScenarioBuilder`.

**Testes:** não gera cenário sem CD; respeita max_candidates; mantém company_id.

## ScenarioOptimizer

**Arquivo:** `assets/js/phase4/scenario-optimizer.js`

**O que faz:** enumera o espaço discreto modelado, simula candidatos, aplica restrições, normaliza métricas e ranqueia cenários com desempate determinístico.

**Input JSON:**
```json
{"companyId":"empresa2","objective":{},"constraints":{},"optimizerConfig":{"method":"exact_discrete","max_candidates":2000,"seed":42}}
```

**Output JSON:**
```json
{"optimizer_status":"success","best_scenarios":[{"scenario_id":"empresa2_candidate_014","final_score":88.4,"rank":1}],"search_log":{"method_applied":"exact_discrete","generated_candidates":270,"valid_candidates":96,"invalid_candidates":24,"exact_search_space":true}}
```

**Funções internas:** `runOptimization`.

**Chama:** `CandidateScenarioGenerator`, `ScenarioSimulator`, `ConstraintEngine`, `ScenarioMetricExtractor`, `MetricNormalizer` e `ScenarioScoring`.

**Testes:** respeita o limite de segurança do espaço discreto; desempate é estável; inválidos não entram no ranking.

## SearchLogPanel, RankingExplainer, TradeoffFrontier, Phase4Dashboard e Phase4TestPanel

Esses módulos renderizam a interface, o log, a explicação, a fronteira de trade-off e os testes. Todos têm arquivos separados em `assets/js/phase4/` e são testados por `tests/07_fase4_score_otimizador/`.
