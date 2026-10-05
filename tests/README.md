# Testes organizados

Os testes foram separados por objetivo.

```text
tests/
├── 00_basicos/                 # presença mínima do pacote
├── 01_paths_auditoria/          # paths, auditorias e regeneração
├── 02_fase1_frontend/           # HTML/CSS/JS e servidor estático
├── 03_contratos_modulos/        # documentação dos módulos e contratos
├── 04_e2e_visual_opcional/      # Playwright opcional da Fase 1
├── 05_fase2_baseline/           # baseline, reconciliação e HTTP
├── 06_fase3_cenarios/           # cenários e Monte Carlo
├── 07_fase4_score_otimizador/   # scoring e avaliação de alternativas
├── 08_fase5_entrega_final/      # stress, recomendação e exportação
├── 09_quality_checks/           # contratos, invariantes e integridade
├── 10_presentation_e2e/         # fluxo completo de apresentação
├── 11_regression_e2e/            # regressão lógica e visual
├── 12_network_intelligence/      # contratos e E2E da interface moderna
└── run_all_tests.py             # roda o gate canônico
```

Para rodar o gate canônico completo:

```bash
python tests/run_all_tests.py
```

## Cobertura pública sem credenciais

`npm run test:public` (incluído em `npm run quality:public`) executa a lista explícita
de testes em `run_public_tests.py`. Além das verificações estáticas/estruturais, ela
inclui testes unitários de parsing CSV, renderização de tabelas e previews, valores de
formulário da Network Intelligence e contratos da aplicação com a fixture sintética
`empresa_mock`.

Os testes adicionais incluídos nessa fronteira são `02_fase1_frontend/test_phase1_csv_parser.py`,
`02_fase1_frontend/test_phase1_table_view.py`,
`06_fase3_cenarios/test_phase3_library_view.py`,
`07_fase4_score_otimizador/test_phase4_objective_preview_view.py`,
`08_fase5_entrega_final/test_phase5_dashboard_view.py`,
`08_fase5_entrega_final/test_phase5_tax_periods_view.py`,
`08_fase5_entrega_final/test_phase5_final_situation_view.py`,
`12_network_intelligence/test_app_contracts.py` e
`12_network_intelligence/test_form_values.py`. A lista também inclui
`12_network_intelligence/test_decision_optimizer_flow.py`, que usa providers e bundles
construídos no próprio teste e não lê dados de empresa protegidos.

Essa suíte não descriptografa nem carrega bundles de `empresa1`/`empresa2`, não lê
`.env.local` e não precisa de `VISAGIO_DATA_PASSWORD`. Os testes de reconciliação,
cenários, avaliação de alternativas e decisão que dependem dos dados protegidos permanecem apenas no gate
completo. A lista pública é explícita para revisão; ao adicionar um teste nela, confira
que seus imports, fixtures e processos filhos não leem dados protegidos ou credenciais.

O teste visual legado da Fase 1 (`tests/04_e2e_visual_opcional/`) é separado do gate
porque depende de navegador e cobre somente a Fase 1. O gate canônico inclui os
fluxos de apresentação e regressão E2E; quando esses testes falham, o comando falha.
O runner também verifica que todo novo arquivo `test_*.py` numerado foi incluído no
gate ou explicitamente marcado como opcional.

Para validar somente a interface Network Intelligence:

```bash
npm run test:network
```

Esse comando cobre os fluxos públicos da interface e executa o fluxo de empresa protegida
quando `VISAGIO_DATA_PASSWORD` estiver disponível. Sem a credencial, o fluxo protegido é
reportado explicitamente como `SKIPPED`; ele não deve ser interpretado como validação de
descriptografia.

Os arquivos `crypto_helpers.py`, `runtime_bundle_support.mjs`,
`11_regression_e2e/regression_logic_audit.mjs` e `05_fase2_baseline/explore_phase2_playwright.py`
são auxiliares executados por testes, não entradas independentes do runner.

## Fase 5

A Fase 5 adiciona testes em `tests/08_fase5_entrega_final/` para estrutura, sintaxe JS, stress test, recomendação, audit trail, exportação, QA final e servidor HTTP.

Comando principal local:

```bash
python tests/run_all_tests.py
```

Em ambientes com limite curto de tempo, rode por grupos, mas use o gate completo antes
de publicar uma release.
