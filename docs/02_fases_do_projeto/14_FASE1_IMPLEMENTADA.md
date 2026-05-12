# Fase 1 implementada — Fundação, dados e validação inicial

Esta versão implementa a Fase 1 do site estático do simulador de malha logística.

## O que foi implementado

- `index.html` refeito com página navegável da Fase 1.
- `assets/styles.css` refeito com paleta visual inspirada no material institucional da Visagio.
- `assets/app.js` refeito com módulos de carregamento, seleção de empresa, painel de datasets, qualidade, auditoria de caminhos, inventário de abas e checklist manual.
- Página `/fase-1-validacao/` criada como entrada direta para a validação da fase.
- Testes novos para validar HTML/CSS/JS, separação de empresas, paths do catálogo e servidor estático.

## Módulos funcionais da Fase 1

1. `DataLoader`: carrega `catalog.json`, provas, qualidade, path audit, testes de fase e inventário de abas.
2. `CompanySelector`: alterna entre Empresa 1 e Empresa 2 sem misturar datasets.
3. `DatasetPanel`: mostra datasets core, linhas, colunas, descrição e paths CSV/JSON.
4. `DataQualityPanel`: mostra score/estado dos dados por empresa.
5. `PathAuditPanel`: mostra status dos caminhos e paths faltantes.
6. `WorkbookInventoryPanel`: resume as abas mapeadas nos workbooks.
7. `ManualChecklist`: permite o usuário marcar manualmente os testes que fez.
8. `Phase1AutoChecks`: roda checagens automáticas no navegador.

## Como rodar

```bash
python -m http.server 8000
```

Depois abrir:

```text
http://localhost:8000
```

Ou direto na página da fase:

```text
http://localhost:8000/fase-1-validacao/
```

## Testes executados

```bash
python tests/check_package.py
python tests/test_full_workbook_paths.py
python tests/test_paths_and_regeneration.py
python tests/test_final_deep_audit.py
python tests/test_phase1_static_site.py
python tests/test_phase1_http_server.py
python tests/test_phase1_playwright.py
```

Resultado observado no ambiente de geração:

```text
PACKAGE_CHECK_OK
FULL_WORKBOOK_PATH_AUDIT_OK
REGENERATION_AND_PATH_CHECK_OK
FINAL_DEEP_AUDIT_OK
PHASE1_STATIC_SITE_TESTS_OK
PHASE1_HTTP_SERVER_OK
PHASE1_PLAYWRIGHT_SKIPPED: Page.goto: net::ERR_BLOCKED_BY_ADMINISTRATOR
```

O teste Playwright ficou disponível no pacote, mas o Chromium do ambiente bloqueou acesso ao localhost. Por isso o teste visual automatizado foi marcado como skip no ambiente de geração. Os testes de estrutura, paths e servidor estático passaram.

## Limite da Fase 1

A Fase 1 ainda não implementa CostEngine, cenário base, otimizador ou stress test. Ela implementa a fundação visual e técnica para validar que os dados certos estão carregados e separados.
## Documentação expandida adicionada

Além deste registro original, a documentação detalhada da Fase 1 agora está separada em guias:

```text
docs/15_GUIA_RAPIDO_FASE1.md
docs/16_GUIA_USUARIO_FASE1.md
docs/17_GUIA_DESENVOLVEDOR_FASE1.md
docs/18_MAPA_DADOS_CAMINHOS_FASE1.md
docs/19_TESTES_E_ACEITE_FASE1.md
docs/20_TROUBLESHOOTING_FASE1.md
docs/21_PLANO_FASE2.md
```

Use `docs/00_INDICE_DOCUMENTACAO.md` como ponto de entrada.
