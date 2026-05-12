# Fase 2 Implementada — Cenário Base e Paridade

## Objetivo

A Fase 2 transforma o pacote da Fase 1 em uma primeira versão de simulador de baseline. A página nova fica em:

```text
fase-2-baseline/index.html
```

Ela permite selecionar Empresa 1 ou Empresa 2 e visualizar:

- cenário base;
- fluxos construídos;
- custos separados;
- camada tributária básica;
- Base Fit Score quando há referência;
- avisos metodológicos;
- testes automáticos e checklist manual.

## O que foi implementado

### Empresa 1

A Empresa 1 usa:

```text
data/empresa1/core/demand_records.json
data/empresa1/core/distance_matrix.json
data/empresa1/core/premissas.json
```

O baseline é calculado como proxy auditável:

1. agrega a demanda mensal por UF e centroide;
2. busca a origem/CD mais barata na matriz de distância pelo menor frete R$/kg;
3. calcula custo de distribuição por peso anual x frete R$/kg;
4. calcula armazenagem por peso mensal x custo R$/kg/mês x 12;
5. calcula custo de estoque por faturamento mensal x WACC.

A Empresa 1 fica com `benchmark_pending` para o score histórico, mas o pacote já expõe um baseline estrutural proxy calculado com demanda, distância e premissas.

### Empresa 2

A Empresa 2 usa:

```text
data/empresa2/core/scenario_totals.json
data/empresa2/core/scenario_blocks.json
data/empresa2/core/distribuicao_fabrica_cd.json
data/empresa2/core/faturamento_filial_uf.json
data/empresa2/core/dados_tributario.json
data/empresa2/core/aux_custo_transferencia.json
data/empresa2/core/aux_custo_distribuicao.json
data/empresa2/core/aux_custo_armazenagem.json
data/empresa2/core/estoque.json
```

O Cenário 1 do workbook é tratado como baseline canônico para reconstrução. O pacote não inventa benchmark independente para a Empresa 2, então o Base Fit também fica pendente. A Fase 2 reconcilia `scenario_totals` com `dados_tributario` usando a fórmula do workbook e expõe a evidência bruta separadamente.

## Artefatos gerados

Para cada empresa foram criados:

```text
data/empresa*/phase2/baseline_model.json
data/empresa*/phase2/baseline_flows.json
data/empresa*/phase2/baseline_costs.json
data/empresa*/phase2/tax_results.json
data/empresa*/phase2/base_fit.json
data/empresa*/phase2/phase2_bundle.json
```

Também foi criado:

```text
data/validation/phase2_implementation_report.json
```

## Página estática

A página principal da Fase 2 é:

```text
/fase-2-baseline/
```

Ela usa módulos JavaScript em:

```text
assets/js/shared/
assets/js/phase2/
```

## Testes

Foram adicionados testes em:

```text
tests/05_fase2_baseline/
```

Eles verificam:

- existência dos artefatos da Fase 2;
- contratos de dados dos bundles;
- fechamento dos custos;
- Empresa 1 sem score inventado;
- Empresa 2 com Base Fit Score correto;
- HTML/CSS/JS da página;
- ausência de paths absolutos;
- servidor HTTP local servindo a página e os JSONs.

## Limitação assumida de forma explícita

A Fase 2 ainda não é otimizador nem comparador de cenários. Ela é a camada de baseline. A criação de cenários alternativos fica para a Fase 3.
