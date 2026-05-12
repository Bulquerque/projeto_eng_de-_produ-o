# Dados Usados na Fase 2

## Empresa 1

```text
data/empresa1/core/demand_records.json
data/empresa1/core/distance_matrix.json
data/empresa1/core/premissas.json
```

Saídas:

```text
data/empresa1/phase2/phase2_bundle.json
```

## Empresa 2

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

Saídas:

```text
data/empresa2/phase2/phase2_bundle.json
```

## Regra de honestidade metodológica

Quando uma empresa não possui benchmark histórico consolidado, a Fase 2 não inventa Base Fit Score. Ela calcula o baseline e marca o score como pendente.
