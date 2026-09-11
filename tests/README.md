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
├── 07_fase4_score_otimizador/   # scoring e otimização
├── 08_fase5_entrega_final/      # stress, recomendação e exportação
├── 09_quality_checks/           # contratos, invariantes e integridade
├── 10_presentation_e2e/         # fluxo completo de apresentação
├── 11_regression_e2e/            # regressão lógica e visual
└── run_all_tests.py             # roda o gate canônico
```

Para rodar tudo que é obrigatório:

```bash
python tests/run_all_tests.py
```

O teste visual legado da Fase 1 é opcional porque depende de navegador disponível no
ambiente. O gate canônico inclui os fluxos de apresentação e regressão E2E quando o
navegador está disponível.

## Fase 5

A Fase 5 adiciona testes em `tests/08_fase5_entrega_final/` para estrutura, sintaxe JS, stress test, recomendação, audit trail, exportação, QA final e servidor HTTP.

Comando principal local:

```bash
python tests/run_all_tests.py
```

Em ambientes com limite curto de tempo, rode por grupos, como nos relatórios de validação.
