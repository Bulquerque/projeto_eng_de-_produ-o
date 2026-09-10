
# Visagio Static Simulator

Simulador estático de malha logística com diagnóstico de dados, baseline, cenários, otimização e decisão final. O runtime usa JavaScript modular no navegador e dados protegidos carregados sob demanda.

## Executar

```bash
python -m http.server 8000
```

Abra [http://localhost:8000](http://localhost:8000). Os dados criptografados são desbloqueados pela frase configurada em `VISAGIO_DATA_PASSWORD` no ambiente local.

## Validar

```bash
npm run lint:js
npm run format:js:check
ruff check .
ruff format --check .
python tests/run_all_tests.py
```

O código executável fica em `assets/js/phase1/`, `assets/js/core/` e nos diretórios `assets/js/phase2` a `assets/js/phase5`. A documentação de contratos e os testes ficam separados em `phases/` e `tests/`.

O roteiro completo de homologação por empresa, incluindo todos os botões,
funcionalidades, fases, evidências e ressalvas, está em
[`CHECKLIST_ENTREGA_EMPRESAS.md`](CHECKLIST_ENTREGA_EMPRESAS.md).

O parecer técnico da release, com o mapeamento das críticas do plano de
trabalho, limitações assumidas e evidências de validação, está em
[`RELATORIO_FINAL_ACADEMICO.md`](RELATORIO_FINAL_ACADEMICO.md).
