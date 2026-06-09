# Complementos por empresa — Projeto Visagio

Este pacote é uma versão enxuta do bundle completo. Ele contém **apenas os complementos** para Empresa 1 e Empresa 2, com foco em camada tributária, cenários de reforma, validação, source maps e referências compartilhadas.

## O que este ZIP inclui

- `complementos/empresa_1/`: complementos da Empresa 1, principalmente `tax/`, `scenarios/`, `validation/`, `source_map.csv` e pequenos insumos complementares de `canonical/` quando já eram proxy/apoio.
- `complementos/empresa_2/`: complementos da Empresa 2, principalmente `tax/`, `scenarios/`, `validation/` e `source_map.csv`.
- `shared/tax_reference/`: referências tributárias comuns, como matriz ICMS interestadual, linha do tempo da reforma, desenho dos cenários e catálogo de fontes.
- `frontend_api_complementos/`: arquivos pequenos para consumo do frontend, sem carregar os dados brutos.
- `contracts/tables/`: schemas mínimos para validar tabelas tributárias/complementares.

## O que este ZIP NÃO inclui

- Não inclui os Excel brutos das empresas.
- Não inclui as extrações staged completas.
- Não inclui as grandes tabelas operacionais canônicas, como demanda completa da Empresa 1 ou custos completos da Empresa 2.
- Não inclui documentos de contexto, apresentações ou relatórios grandes.

## Como usar no site

Use este pacote como camada complementar por cima dos dados principais. Para o frontend, os pontos mais úteis são:

```text
frontend_api_complementos/
shared/tax_reference/
complementos/empresa_1/tax/
complementos/empresa_1/scenarios/
complementos/empresa_2/tax/
complementos/empresa_2/scenarios/
```

## Regra de interpretação

- `observed_tenant`: dado da própria empresa.
- `proxy_other_company`: dado da outra empresa usado como proxy controlado.
- `external_official`: fonte oficial externa, principalmente tributária.
- `manual_scenario`: hipótese de cenário, especialmente na reforma.

Gerado em: 2026-06-09T14:09:27
