# Testes organizados

Os testes foram separados por objetivo.

```text
tests/
├── 00_basicos/                 # presença mínima do pacote
├── 01_paths_auditoria/          # paths, auditorias e regeneração
├── 02_fase1_frontend/           # HTML/CSS/JS e servidor estático
├── 03_contratos_modulos/        # documentação dos módulos e contratos
├── 04_e2e_visual_opcional/      # Playwright opcional
└── run_all_tests.py             # roda os testes principais
```

Para rodar tudo que é obrigatório:

```bash
python tests/run_all_tests.py
```

O teste Playwright é opcional porque depende de navegador disponível no ambiente.

## Fase 5

A Fase 5 adiciona testes em `tests/08_fase5_entrega_final/` para estrutura, sintaxe JS, stress test, recomendação, audit trail, exportação, QA final e servidor HTTP.

Comando principal local:

```bash
python tests/run_all_tests.py
```

Em ambientes com limite curto de tempo, rode por grupos, como nos relatórios de validação.
