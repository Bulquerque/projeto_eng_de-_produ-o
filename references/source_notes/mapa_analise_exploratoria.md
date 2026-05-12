# Mapa de Análise Exploratória

## Objetivo

Este documento organiza a leitura da planilha `Análise Malha Logística - vCaracol.xlsx` de forma prática e inteligente.

O foco é entender:

- a estrutura dos dados operacionais e tributários
- a distribuição do faturamento por UF e por filial
- os fluxos entre fábrica, CDs e clientes
- os cenários de custo e impacto tributário
- os pontos de apoio para uma análise exploratória consistente

## Contexto do arquivo

A planilha não possui uma aba chamada `desafio`.

As abas relevantes para a análise estão concentradas em três grupos:

- base cadastral e premissas
- movimentação logística e comercial
- cálculo tributário e consolidação de cenários

## Estrutura sugerida da pasta

```text
desafio/ICMS Resumo/analise_exploratoria/
├── mapa_analise_exploratoria.md
├── notas_eda.md
├── tabelas_resumo/
└── graficos/
```

Esta estrutura deixa claro o que é guia, o que é registro analítico e o que é saída visual.

## Inventário das abas da planilha

### 1. Base cadastral e premissas

- `Parâmetros`: premissas gerais do modelo, como faturamento e parâmetros operacionais
- `Tabela Logística`: cadastro de produtos com atributos físicos e fiscais
- `Dados_Brasil`: base de apoio com estados e atributos gerais
- `Lat & Long`: coordenadas para análise geográfica
- `Estoque`: informações ligadas a volumes e posição de estoque

### 2. Fluxos operacionais e comerciais

- `Faturamento_UF`: faturamento médio por UF e participação relativa
- `Faturamento por Filial x UF`: concentração de receita por origem e destino
- `Distribuição Fábrica_CD`: fluxo de fábrica para CDs
- `Dados_Roteamento`: base de apoio para rotas
- `Rotas_Mapa`: rotas geográficas e suporte de visualização
- `Roteamento`: área operacional de roteamento e consolidação

### 3. Cálculo tributário e cenários

- `Dados_Tributário`: matriz principal de cálculo tributário
- `Cenários`: consolidação de custos e comparação entre cenários
- `Sensibilidade 1`: testes de sensibilidade
- `Sensibilidade 2`: testes complementares de sensibilidade
- `SD2_Atualizar`: base intermediária de atualização e cálculo

### 4. Apoio técnico e tabelas auxiliares

- `Aux_ Custo_Distribuição`
- `TB_Distribuição`
- `Aux_Custo_Transferência`
- `TB_Transferência`
- `Aux_Custo_Armaz`
- `Tabelas_CIF_Dist`
- `Mapa Brasil`
- `Início`

Essas abas são importantes para rastrear cálculo, mas não devem ser a primeira leitura da análise.

## Ordem inteligente de leitura

### Etapa 1: entender o contexto

1. Ler `Parâmetros`
2. Ler `Tabela Logística`
3. Ler `Faturamento_UF`
4. Ler `Faturamento por Filial x UF`

Objetivo:

- entender a escala do negócio
- identificar os produtos e o porte da operação
- localizar onde está a receita
- perceber a concentração geográfica

### Etapa 2: entender o fluxo físico

1. Ler `Distribuição Fábrica_CD`
2. Ler `Dados_Roteamento`
3. Ler `Rotas_Mapa`
4. Ler `Lat & Long`
5. Ler `Roteamento`

Objetivo:

- enxergar a malha logística real
- identificar origens, destinos e volumes
- preparar um mapa visual ou tabela de rotas

### Etapa 3: entender a lógica tributária

1. Ler `Dados_Tributário`
2. Ler `Cenários`
3. Ler `Sensibilidade 1`
4. Ler `Sensibilidade 2`
5. Ler `SD2_Atualizar`

Objetivo:

- entender a matriz de impostos
- comparar custo tributário entre cenários
- localizar as variáveis que mais mexem no resultado

### Etapa 4: validar suporte e consistência

1. Conferir `Estoque`
2. Conferir `Dados_Brasil`
3. Conferir `Tabelas_CIF_Dist`
4. Conferir abas `Aux_*`

Objetivo:

- validar premissas
- identificar bases intermediárias
- confirmar se os números fecham

## Perguntas de negócio que a análise deve responder

- Onde está concentrado o faturamento por UF?
- Quais filiais atendem as UFs mais relevantes?
- Qual é o padrão de distribuição fábrica para CD?
- Quais rotas parecem mais caras ou mais intensas?
- Qual é o peso tributário por cenário?
- Quais variáveis alteram mais o custo total?
- Existem estados, filiais ou produtos que concentram risco?
- A estrutura logística é mais pulverizada ou centralizada?

## Hipóteses iniciais

- A operação tem concentração forte em poucas UFs
- Existem produtos com impacto logístico desproporcional ao faturamento
- A tributação varia bastante por UF e por origem
- A centralização tende a reduzir complexidade operacional
- A consolidação de rotas deve simplificar custo e roteamento

## Checagens de qualidade de dados

### Consistência estrutural

- verificar se todas as abas principais têm cabeçalhos coerentes
- conferir se há linhas vazias no topo ou colunas deslocadas
- validar se os nomes das colunas mudam entre abas semelhantes

### Consistência numérica

- checar valores nulos em faturamento, volume e alíquotas
- conferir se percentuais somam aproximadamente 100% quando esperado
- validar se custos totais batem com seus componentes
- confirmar se alíquotas estão em escala correta

### Consistência de chaves

- validar UF de origem e destino
- validar filial de origem
- conferir códigos de produto na `Tabela Logística`
- verificar se as bases de apoio referenciam os mesmos identificadores

### Consistência lógica

- rotas com volume alto devem aparecer em tabelas de maior relevância
- cenários com menor custo devem ter explicação rastreável
- alíquotas efetivas devem ser compatíveis com a origem e o destino

## Métricas principais para a EDA

- faturamento total e por UF
- participação relativa por UF
- faturamento por filial de origem
- participação de cada filial no total
- volume de distribuição fábrica para CD
- concentração de rotas por origem e destino
- custo de armazenagem
- custo de transferência
- custo de distribuição
- custo de frete
- efeito tributário
- custo total por cenário
- diferença absoluta e percentual entre cenários
- alíquota efetiva por operação

## Cortes analíticos recomendados

- por UF
- por filial
- por produto
- por cenário
- por origem e destino
- por tipo de rota
- por componente de custo
- por faixa de relevância financeira

## Sugestões de gráficos e tabelas

### Gráficos

- barras horizontais para faturamento por UF
- barras empilhadas para custo por cenário
- heatmap de origem versus destino
- mapa geográfico das rotas
- gráfico de Pareto para concentração de receita
- waterfall para composição de custo total
- dispersão entre faturamento e custo logístico

### Tabelas

- resumo das abas com finalidade e variáveis-chave
- top UFs por faturamento
- top filiais por faturamento
- top rotas por volume
- comparativo AS-IS versus TO-BE
- resumo de alíquotas efetivas

## Roteiro prático de análise

1. abrir `Parâmetros` para localizar as premissas do modelo
2. ler `Tabela Logística` para entender o cadastro dos produtos
3. analisar `Faturamento_UF` para ver a distribuição da receita
4. cruzar `Faturamento por Filial x UF` com concentração comercial
5. estudar `Distribuição Fábrica_CD` para identificar o fluxo físico
6. ler `Dados_Tributário` para entender a lógica de cálculo fiscal
7. comparar os valores em `Cenários`
8. usar `Rotas_Mapa`, `Lat & Long` e `Roteamento` para a visualização geográfica
9. revisar `Estoque` e `Dados_Brasil` para checagens de suporte
10. consolidar achados em um resumo executivo

## Saídas esperadas

- resumo executivo da leitura da planilha
- mapa das principais relações entre abas
- tabela com métricas por UF, filial e cenário
- hipótese sobre a melhor estrutura logística
- base para criar gráficos e um notebook de EDA

## Próximos passos

- transformar este roteiro em um notebook de análise exploratória
- gerar tabelas resumo a partir das abas principais
- construir um mapa geográfico das rotas
- comparar os cenários com foco em custo e tributação
- documentar as conclusões finais em um segundo `.md`

