# Guia rápido — Fase 1

Use este arquivo quando quiser apenas abrir o site, conferir que a Fase 1 funciona e seguir para os testes.

## 1. Abrir o site

Na raiz do pacote:

```bash
python -m http.server 8000
```

Abra:

```text
http://localhost:8000
```

Ou diretamente:

```text
http://localhost:8000/fase-1-validacao/
```

## 2. O que conferir visualmente

Na página, confira nesta ordem:

1. O topo mostra que você está na **Fase 1**.
2. Existem dois botões/cards: **Empresa 1** e **Empresa 2**.
3. Ao clicar em Empresa 1, aparecem os datasets de demanda, distância, premissas, resumo de demanda e rede.
4. Ao clicar em Empresa 2, aparecem os datasets de faturamento, distribuição, custos, estoque, tributário, cenários e rotas.
5. O painel de auditoria mostra `paths faltantes = 0`.
6. O painel de abas mostra que os workbooks foram inventariados.
7. O checklist manual permite marcar os testes que você fez.

## 3. Rodar testes no terminal

```bash
python tests/check_package.py
python tests/test_full_workbook_paths.py
python tests/test_paths_and_regeneration.py
python tests/test_final_deep_audit.py
python tests/test_phase1_static_site.py
python tests/test_phase1_http_server.py
```

O resultado esperado é parecido com:

```text
PACKAGE_CHECK_OK
FULL_WORKBOOK_PATH_AUDIT_OK
REGENERATION_AND_PATH_CHECK_OK
FINAL_DEEP_AUDIT_OK
PHASE1_STATIC_SITE_TESTS_OK
PHASE1_HTTP_SERVER_OK
```

O teste Playwright também existe:

```bash
python tests/test_phase1_playwright.py
```

Ele pode marcar skip se o navegador Chromium bloquear `localhost` no seu ambiente.

## 4. Prova de paths

O relatório principal fica em:

```text
data/validation/path_resolution_report.json
```

Resumo atual:

```text
result: OK
path_count_checked: 97
missing_paths: 0
```

## 5. O que ainda não é para testar na Fase 1

Não procure ainda por cálculo de custo, cenário base calibrado, otimizador ou stress test. Essas funcionalidades começam a partir da Fase 2.
