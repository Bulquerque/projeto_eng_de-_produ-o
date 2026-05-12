# Testes e critérios de aceite — Fase 1

Este documento define como validar se a Fase 1 está pronta.

## Testes automáticos disponíveis

| Teste | O que valida |
|---|---|
| `tests/check_package.py` | Presença dos arquivos principais do pacote |
| `tests/test_full_workbook_paths.py` | Workbooks, abas e exports mapeados |
| `tests/test_paths_and_regeneration.py` | Paths e regeneração de datasets críticos |
| `tests/test_final_deep_audit.py` | Auditoria profunda do pacote base |
| `tests/test_phase1_static_site.py` | Estrutura do HTML/CSS/JS e catálogo da Fase 1 |
| `tests/test_phase1_http_server.py` | Site servido por HTTP local |
| `tests/test_phase1_playwright.py` | Teste visual/e2e no navegador quando disponível |

## Comandos recomendados

```bash
python tests/check_package.py
python tests/test_full_workbook_paths.py
python tests/test_paths_and_regeneration.py
python tests/test_final_deep_audit.py
python tests/test_phase1_static_site.py
python tests/test_phase1_http_server.py
```

Teste opcional com navegador:

```bash
python tests/test_phase1_playwright.py
```

## Resultado observado no ambiente de geração

```text
PACKAGE_CHECK_OK
FULL_WORKBOOK_PATH_AUDIT_OK
REGENERATION_AND_PATH_CHECK_OK
FINAL_DEEP_AUDIT_OK
PHASE1_STATIC_SITE_TESTS_OK
PHASE1_HTTP_SERVER_OK
PHASE1_PLAYWRIGHT_SKIPPED quando Chromium bloqueia localhost
```

## Checklist manual mínimo

Marque no site ou use esta lista:

```text
[ ] O site abre em http://localhost:8000
[ ] A página /fase-1-validacao/ abre
[ ] Empresa 1 aparece e carrega seus datasets
[ ] Empresa 2 aparece e carrega seus datasets
[ ] Empresa 1 não mostra datasets da Empresa 2
[ ] Empresa 2 não mostra datasets da Empresa 1
[ ] O painel de paths mostra missing_paths = 0
[ ] O inventário de abas aparece
[ ] A aba Cenários da Empresa 2 aparece com tratamento especial
[ ] O checklist manual salva ao recarregar a página
```

## Critérios de aceite

A Fase 1 está aceita quando:

1. Site abre via `python -m http.server 8000`.
2. `index.html`, `assets/styles.css` e `assets/app.js` carregam.
3. `data/catalog.json` é lido pelo frontend.
4. Empresa 1 e Empresa 2 aparecem separadas.
5. Os datasets exibidos vêm do catálogo correto.
6. O painel de auditoria mostra zero paths faltantes.
7. Os testes automáticos passam, exceto Playwright quando houver bloqueio ambiental documentado.
8. O usuário consegue fazer a validação manual sem abrir código.

## O que não reprova a Fase 1

Não reprova a Fase 1 ainda:

```text
não ter cálculo de custo
não ter otimizador
não ter cenário base calibrado
não ter stress test
não ter relatório executivo
```

Esses itens pertencem às próximas fases.
