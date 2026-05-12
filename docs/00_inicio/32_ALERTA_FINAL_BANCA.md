# Alerta Final para Banca

## Status executivo

O simulador está pronto para apresentação técnica de ponta a ponta:

- Validação de dados e caminhos.
- Baseline por empresa.
- Criação e comparação de cenários.
- Reforma tributária parametrizada por regime/ano.
- Otimização por objetivo.
- Entrega final com stress test, sensibilidade, recomendação, relatório executivo, audit trail e exportação.
- Evidência Playwright desktop/mobile do fluxo completo.

Comando de validação final:

```bash
python -m tests.run_all_tests
```

Resultado esperado:

```text
PRESENTATION_E2E_OK
ALL_PHASE5_PACKAGE_TESTS_OK
```

## Como apresentar

1. Subir o site:

```bash
python -m http.server 8000
```

2. Abrir:

```text
http://localhost:8000
```

3. Seguir o roteiro:

- Validação: mostrar integridade, paths, dados por empresa e checklists.
- Baseline: desbloquear dados, mostrar custos, fluxos, tributo básico e Base Fit.
- Simulação: carregar cenário exemplo, simular, comparar contra baseline e explicar deltas.
- Otimização: rodar otimizador, mostrar ranking, score e fronteira custo vs qualidade.
- Entrega: mostrar cenário final, stress test, sensibilidade, recomendação, relatório executivo, audit trail e export center.

## Frase de defesa técnica

> O simulador não é uma caixa-preta. Ele separa dados por empresa, explicita premissas, bloqueia cenários inválidos, registra limitações e gera evidências auditáveis do fluxo de decisão.

## O que pode ser afirmado

- O fluxo web foi validado com Playwright em desktop e mobile.
- A suíte automatizada executa o roteiro completo de apresentação.
- Os cálculos de cenário, comparação, otimização, stress test e exportação rodam no navegador.
- A reforma tributária é considerada por configuração de regimes, alíquotas, transição e modo de cálculo.
- O sistema não mistura Empresa 1 e Empresa 2.
- O simulador mostra avisos quando usa proxy ou quando falta referência histórica consolidada.

## O que não deve ser prometido

- Não prometer paridade contábil total com workbook quando o próprio painel marcar Base Fit ou reconciliação como pendente.
- Não dizer que a legislação tributária está juridicamente validada; dizer que os parâmetros estão explícitos e auditáveis.
- Não vender o otimizador como solver matemático global irrestrito; ele enumera espaço discreto modelado sob restrições configuradas.
- Não esconder avisos de proxy fiscal, benchmark pendente ou recomendação “não recomendado”.

## Alertas esperados e como explicar

### Base Fit pendente

Significa que não existe referência histórica consolidada suficiente para declarar paridade plena. O simulador preserva a honestidade e não inventa score.

### Proxy fiscal

Significa que alguns fluxos não têm NCM/CFOP/CST completo. O simulador usa categoria fiscal proxy e mostra aviso em vez de silenciosamente fingir precisão.

### Não recomendado

Significa que o cenário ótimo por score/custo ainda pode falhar em robustez, risco ou critérios de decisão. Isso é uma saída válida do motor, não erro visual.

## Evidências para mostrar

Pasta:

```text
data/validation/presentation_e2e/
```

Arquivos:

- `01_home_desktop.png`
- `02_baseline_desktop.png`
- `03_scenario_desktop.png`
- `04_optimizer_desktop.png`
- `05_final_delivery_desktop.png`
- `mobile_home.png`
- `mobile_baseline.png`
- `mobile_scenario.png`
- `mobile_optimizer.png`
- `mobile_final_delivery.png`
- `presentation_e2e_report.json`

## Checklist antes de apresentar

- Confirmar que `.env.local` existe com `VISAGIO_DATA_PASSWORD`.
- Rodar `python -m tests.run_all_tests`.
- Subir `python -m http.server 8000`.
- Abrir em navegador limpo ou aba anônima.
- Desbloquear dados uma vez por página quando solicitado.
- Usar cenários exemplo para evitar digitação manual durante a banca.
- Não improvisar premissas tributárias fora do que está parametrizado no simulador.

## Conclusão defensável

O pacote está fechado para uma apresentação técnica honesta e auditável. A defesa deve enfatizar rastreabilidade, separação de empresas, explicitação de premissas, validação automatizada e fluxo completo de decisão.
