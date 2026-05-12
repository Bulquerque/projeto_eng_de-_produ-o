# Guia do usuário — Como validar a Fase 1 no site

A Fase 1 foi feita para você conseguir abrir o site e conferir se a base está organizada antes de começar a simulação de verdade.

## Página inicial

A página inicial é o ponto de entrada do simulador. Ela mostra o status da Fase 1 e os painéis de validação.

O site deve funcionar em servidor estático simples, por exemplo:

```bash
python -m http.server 8000
```

## Seleção de empresa

A primeira ação do usuário é escolher a empresa.

### Empresa 1

A Empresa 1 usa somente:

```text
Dados de Demanda
Dados de Distância
Premissas Gerais
```

Na interface, quando Empresa 1 estiver selecionada, você deve ver datasets como:

```text
demand_records
distance_matrix
premissas
demand_summary_by_uf
network_summary
```

### Empresa 2

A Empresa 2 usa o workbook de malha logística. Na interface, você deve ver datasets como:

```text
faturamento_uf
distribuicao_fabrica_cd
faturamento_filial_uf
tabela_logistica
parametros
cenarios
dados_tributario
estoque
dados_roteamento
aux_custo_transferencia
aux_custo_armazenagem
aux_custo_distribuicao
scenario_blocks
scenario_totals
```

A aba `Cenários` da Empresa 2 recebeu tratamento especial porque ela é uma aba em blocos, não uma tabela única simples. Por isso existem `scenario_blocks` e `scenario_totals`.

## Painel de datasets

Esse painel mostra, para a empresa selecionada:

```text
nome do dataset
origem/aba, quando aplicável
caminho CSV
caminho JSON
número de linhas
número de colunas
descrição curta
```

O objetivo é deixar claro de onde cada informação vem.

## Painel de qualidade dos dados

Esse painel mostra alertas e resumo de qualidade. Ele não substitui uma auditoria fiscal ou operacional, mas ajuda a encontrar problemas comuns antes de simular.

Exemplos de problemas que essa camada deve evidenciar:

```text
arquivo faltante
coluna obrigatória ausente
linhas nulas
paths não resolvidos
base da empresa errada
```

## Painel de auditoria de caminhos

Esse painel usa os relatórios de validação do pacote. O ponto mais importante é:

```text
missing_paths = 0
```

Se aparecer caminho faltante, não avance para a Fase 2 antes de corrigir.

## Inventário de abas

O inventário de abas lista as abas exportadas dos workbooks. Ele é importante porque a Empresa 2 tem uma planilha grande e com estrutura diferente por aba.

O arquivo técnico do inventário é:

```text
data/validation/workbook_sheet_inventory.csv
```

## Checklist manual

O checklist manual existe para você validar o site além dos testes automáticos.

Marque os itens depois de conferir visualmente:

```text
Empresa 1 carrega corretamente
Empresa 2 carrega corretamente
Não existe mistura de dados entre empresas
Paths estão OK
A aba Cenários da Empresa 2 aparece tratada como bloco especial
```

O checklist fica salvo no navegador com `localStorage`.

## Quando a Fase 1 está aprovada

A Fase 1 está aprovada quando você consegue dizer:

```text
O site abre.
As empresas estão separadas.
Os datasets certos aparecem.
Os caminhos estão visíveis.
Não há paths faltantes.
O checklist manual funciona.
```
