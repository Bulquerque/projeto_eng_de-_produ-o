# Mapa de dados e caminhos — Fase 1

Este documento mostra os principais dados disponíveis no pacote e os caminhos que o site usa para exibir a Fase 1.

## Regra central

- Empresa 1 usa somente dados de demanda, distância e premissas.
- Empresa 2 usa somente o workbook de malha logística da Empresa 2.
- O motor futuro pode ser comum, mas os dados, baselines e cenários devem ficar separados.

## Empresa 1 — core files

| Dataset | Linhas | Colunas | CSV | JSON | Descrição |
|---|---:|---:|---|---|---|
| `demand_records` | 60311 | 10 | `data/empresa1/core/demand_records.csv` | `data/empresa1/core/demand_records.json` | Demanda mensal por UF, centroide, SKU/código, categoria, fornecedor, peso, quantidade e faturamento. |
| `distance_matrix` | 576 | 11 | `data/empresa1/core/distance_matrix.csv` | `data/empresa1/core/distance_matrix.json` | Matriz origem-destino com UF, centroide/cidade, coordenadas, distância em km e frete R$/kg. |
| `premissas` | 3 | 4 | `data/empresa1/core/premissas.csv` | `data/empresa1/core/premissas.json` | Premissas gerais do modelo da Empresa 1. |
| `demand_summary_by_uf` | 21 |  | `` | `data/empresa1/core/demand_summary_by_uf.json` | Resumo agregado da demanda por UF. |
| `network_summary` | 52 |  | `` | `data/empresa1/core/network_summary.json` | Resumo da rede de origens e destinos da Empresa 1. |

## Empresa 1 — fontes originais

| source_id | arquivo | abas |
|---|---|---:|
| `empresa1_demand` | `Dados de Demanda(3).xlsx` | 1 |
| `empresa1_distance` | `Dados de Distância(3).xlsx` | 1 |
| `empresa1_premissas` | `Premissas Gerais(4).xlsx` | 1 |

## Empresa 2 — core files

| Dataset | Aba | Linhas | Colunas | CSV | JSON | Descrição |
|---|---|---:|---:|---|---|---|
| `faturamento_uf` | Faturamento_UF | 28 | 4 | `data/empresa2/core/faturamento_uf.csv` | `data/empresa2/core/faturamento_uf.json` | Faturamento por UF de destino em 2025. |
| `distribuicao_fabrica_cd` | Distribuição Fábrica_CD | 14 | 10 | `data/empresa2/core/distribuicao_fabrica_cd.csv` | `data/empresa2/core/distribuicao_fabrica_cd.json` | Fluxos de fábrica/terceirista para CDs. |
| `faturamento_filial_uf` | Faturamento por Filial x UF | 168 | 5 | `data/empresa2/core/faturamento_filial_uf.csv` | `data/empresa2/core/faturamento_filial_uf.json` | Faturamento por filial origem e UF destino. |
| `tabela_logistica` | Tabela Logística | 159 | 17 | `data/empresa2/core/tabela_logistica.csv` | `data/empresa2/core/tabela_logistica.json` | Cadastro logístico/fiscal de produtos. |
| `parametros` | Parâmetros | 14 | 4 | `data/empresa2/core/parametros.csv` | `data/empresa2/core/parametros.json` | Parâmetros gerais do modelo da Empresa 2. |
| `cenarios` | Cenários | 25 | 11 | `data/empresa2/core/cenarios.csv` | `data/empresa2/core/cenarios.json` | Resultados e decomposição de cenários do workbook. |
| `dados_tributario` | Dados_Tributário | 556 | 41 | `data/empresa2/core/dados_tributario.csv` | `data/empresa2/core/dados_tributario.json` | Matriz tributária e decomposição de impostos. |
| `estoque` | Estoque | 633 | 21 | `data/empresa2/core/estoque.csv` | `data/empresa2/core/estoque.json` | Estoque médio por filial/produto. |
| `dados_roteamento` | Dados_Roteamento | 18 | 15 | `data/empresa2/core/dados_roteamento.csv` | `data/empresa2/core/dados_roteamento.json` | Dados de apoio de roteamento. |
| `tabelas_cif_dist` | Tabelas_CIF_Dist | 61 | 13 | `data/empresa2/core/tabelas_cif_dist.csv` | `data/empresa2/core/tabelas_cif_dist.json` | Tabelas CIF de distribuição. |
| `aux_custo_transferencia` | Aux_Custo_Transferência | 192 | 15 | `data/empresa2/core/aux_custo_transferencia.csv` | `data/empresa2/core/aux_custo_transferencia.json` | Base auxiliar de custo de transferência. |
| `aux_custo_armazenagem` | Aux_Custo_Armaz | 67 | 12 | `data/empresa2/core/aux_custo_armazenagem.csv` | `data/empresa2/core/aux_custo_armazenagem.json` | Base auxiliar de custo de armazenagem. |
| `aux_custo_distribuicao` | Aux_ Custo_Distribuição | 11445 | 39 | `data/empresa2/core/aux_custo_distribuicao.csv` | `data/empresa2/core/aux_custo_distribuicao.json` | Base auxiliar de custo de distribuição e SLA. |
| `lat_long` | Lat & Long | 16 | 5 | `data/empresa2/core/lat_long.csv` | `data/empresa2/core/lat_long.json` | Coordenadas de UFs/cidades. |
| `rotas_mapa` | Rotas_Mapa | 30 | 8 | `data/empresa2/core/rotas_mapa.csv` | `data/empresa2/core/rotas_mapa.json` | Rotas para mapa. |
| `scenario_blocks` |  | 3 |  | `` | `data/empresa2/core/scenario_blocks.json` | Blocos estruturados extraídos da aba Cenários, preservando cada cenário, suas linhas e total. |
| `scenario_totals` |  | 3 |  | `data/empresa2/core/scenario_totals.csv` | `data/empresa2/core/scenario_totals.json` | Totais de cada cenário extraídos ou inferidos de forma explícita quando o cenário tem apenas uma linha. |

## Empresa 2 — fontes originais

| source_id | arquivo | abas |
|---|---|---:|
| `empresa2_main` | `Analise_Malha_Empresa2(1).xlsx` | 25 |
| `empresa2_alias_vcaracol` | `Análise Malha Logística - vCaracol(3).xlsx` | 25 |

## Relatórios de validação de caminhos

| Arquivo | Uso |
|---|---|
| `data/validation/path_resolution_report.json` | Lista paths checados e paths faltantes |
| `data/validation/full_workbook_path_audit.json` | Auditoria dos workbooks e exports |
| `data/validation/workbook_sheet_inventory.csv` | Inventário por aba dos workbooks |
| `data/validation/regeneration_compare_report.json` | Comparação de regeneração dos dados críticos |
| `data/validation/final_v6_audit_summary.json` | Resumo final de auditoria do pacote base |

## Resultado atual de path audit

```text
result: OK
paths checados: 97
paths faltantes: 0
```

## Observação sobre a aba Cenários da Empresa 2

A aba `Cenários` não deve ser usada apenas como uma tabela plana. Ela foi preservada também em formato estruturado:

```text
data/empresa2/core/scenario_blocks.json
data/empresa2/core/scenario_totals.csv
data/empresa2/core/scenario_totals.json
```

Isso evita que o simulador futuro leia blocos de cenário como se fossem linhas homogêneas de uma mesma tabela.
