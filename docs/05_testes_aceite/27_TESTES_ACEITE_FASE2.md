# Testes e Aceite da Fase 2

## Como rodar todos os testes

```bash
python tests/run_all_tests.py
```

## Testes novos da Fase 2

```bash
python tests/05_fase2_baseline/test_phase2_data_contracts.py
python tests/05_fase2_baseline/test_phase2_static_site.py
python tests/05_fase2_baseline/test_phase2_http_server.py
```

## Critérios de aceite

A Fase 2 está aceita quando:

1. `/fase-2-baseline/` abre no navegador.
2. Empresa 1 e Empresa 2 alternam sem misturar dados.
3. Empresa 1 mostra baseline e custos, com Base Fit histórico `benchmark_pending` e baseline estrutural proxy explícito.
4. Empresa 2 mostra baseline reconstruído, Base Fit `benchmark_pending` e reconciliação tributária fechada pela fórmula do workbook.
5. Custos não são negativos.
6. Total logístico fecha com transferência + distribuição + armazenagem + estoque.
7. Total com tributo fecha com total logístico + impacto tributário.
8. Os warnings metodológicos aparecem na tela.
9. Os testes automáticos do pacote passam.
10. O checklist manual funciona no navegador.
