# Simulador Estático de Malha Logística — Fase 1 organizada

Este pacote é a base organizada para reconstruir o projeto do simulador estático de malha logística.

A Fase 1 já implementa:

- site estático com `index.html`, `assets/styles.css` e `assets/app.js`;
- seleção separada de Empresa 1 e Empresa 2;
- catálogo de dados em `data/catalog.json`;
- painéis de qualidade, paths, abas e checklist manual;
- documentação modular de todas as fases;
- dados tratados por empresa;
- testes separados por tipo.

## Como abrir

```bash
python -m http.server 8000
```

Depois acesse:

```text
http://localhost:8000
http://localhost:8000/fase-1-validacao/
```

## Como testar

```bash
python tests/run_all_tests.py
```

Resultado final esperado:

```text
PRESENTATION_E2E_OK
ALL_PHASE5_PACKAGE_TESTS_OK
```

## Roteiro final para banca

Antes de apresentar, leia:

```text
docs/00_inicio/32_ALERTA_FINAL_BANCA.md
```

As evidências visuais do fluxo completo ficam em:

```text
data/validation/presentation_e2e/
```

## Pastas principais

```text
assets/       front-end estático
data/         dados tratados, contratos e validações
docs/         documentação organizada por tema
etl/          apoio para regeneração
references/   fontes brutas preservadas
tests/        testes organizados
```

Leia também `PROJECT_STRUCTURE.md`.

## Fase 2 implementada

A Fase 2 está disponível em:

```text
fase-2-baseline/
```

Ela constrói e exibe o cenário base das duas empresas, com fluxos, custos, camada tributária básica, Base Fit Score quando há referência, testes automáticos e checklist manual.

Para rodar:

```bash
python -m http.server 8000
```

Depois abra:

```text
http://localhost:8000/fase-2-baseline/
```

Para testar tudo:

```bash
python tests/run_all_tests.py
```


## Fase 3 implementada

Acesse `http://localhost:8000/fase-3-cenarios/` para criar, validar, simular, comparar, salvar, exportar e importar cenários manuais. Rode `python tests/run_all_tests.py` para validar o pacote completo.

## Fase 4 implementada

A Fase 4 adiciona a página:

```text
/fase-4-score-otimizador/
```

Ela implementa Objective Builder, perfis prontos, normalização de métricas, scoring, ranking, restrições, geração de candidatos, otimização exata sobre o espaço discreto modelado, search log, explicação do ranking e fronteira simples de trade-off.

Para rodar:

```bash
python -m http.server 8000
```

Depois abrir:

```text
http://localhost:8000/fase-4-score-otimizador/
```

Para testar tudo:

```bash
python tests/run_all_tests.py
```

Resultado esperado:

```text
ALL_PHASE4_PACKAGE_TESTS_OK
```


## Fase 5 — Entrega Final

A Fase 5 foi implementada em `/fase-5-entrega-final/` com stress test, robustez, recomendação, audit trail, relatório executivo, exportação e QA final.

Para abrir:

```bash
python -m http.server 8000
```

Depois acesse `http://localhost:8000/fase-5-entrega-final/`.


---
## Polimento final e Debug Center

Agora existe `phases/` com documentação por módulo e `/debug/` para diagnóstico. A prova de preservação está em `data/validation/file_preservation_report.json`.


## Release Final Polido v2

Esta versão adiciona polimento visual, modularização da Fase 2, Debug Center e organização por `phases/<fase>/modules/<modulo>/`. Veja `docs/00_inicio/31_RELEASE_FINAL_POLIDO_V2.md`.
