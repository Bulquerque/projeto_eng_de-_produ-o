# Testes e aceite da Fase 4

## Testes automáticos adicionados

```text
tests/07_fase4_score_otimizador/test_phase4_file_structure.py
tests/07_fase4_score_otimizador/test_phase4_js_syntax.py
tests/07_fase4_score_otimizador/test_phase4_scoring_logic.py
tests/07_fase4_score_otimizador/test_phase4_optimizer_logic.py
tests/07_fase4_score_otimizador/test_phase4_http_server.py
```

## Marcadores esperados

```text
PHASE4_FILE_STRUCTURE_OK
PHASE4_JS_SYNTAX_OK
PHASE4_SCORING_LOGIC_OK
PHASE4_OPTIMIZER_LOGIC_OK
PHASE4_HTTP_SERVER_OK
ALL_PHASE4_PACKAGE_TESTS_OK
```

## Critérios de aceite

- `/fase-4-score-otimizador/` abre via servidor estático.
- Todos os módulos da Fase 4 existem como arquivos separados.
- Pesos inválidos são bloqueados.
- Métricas são normalizadas de 0 a 100.
- Score final é soma ponderada.
- Ranking ordena maior score primeiro.
- Otimizador gera e simula candidatos.
- Restrições filtram cenários inválidos.
- Empresa 1 e Empresa 2 continuam separadas.
