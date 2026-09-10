# Metodologia do modelo logístico Visagio

Este documento define a metodologia efetivamente usada pelo simulador depois
das correções do Plano de Trabalho. Ele separa dado observado, proxy, fallback,
resultado determinístico e análise probabilística. O objetivo é que os números
apresentados ao professor possam ser reproduzidos e auditados sem confundir uma
hipótese com uma medição.

## 1. Princípio de cálculo

\`runScenario\` é a única porta oficial para simular um cenário. O resultado
determinístico é composto por:

~~~text
total_logistics_cost = transferência + distribuição + armazenagem + estoque
total_with_tax       = total_logistics_cost + impacto tributário
~~~

Saving é sempre calculado contra o total do baseline da mesma empresa:

~~~text
saving_abs = baseline_total_with_tax - scenario_total_with_tax
saving_pct = saving_abs / baseline_total_with_tax
~~~

As fórmulas ficam centralizadas em
\`assets/js/core/model-configuration.js\`. Dashboards, comparações, stress,
sensibilidade e Monte Carlo reutilizam os mesmos helpers.

Quando o cenário solicitado é exatamente o baseline publicado — mesmos CDs,
multiplicadores unitários, 45 dias, WACC de 15% e regime atual —
`runScenario` preserva os totais oficiais da Fase 2 e marca o resultado como
`canonical_baseline_reference`. Essa exceção é deliberada: a reconstrução
física serve para auditar fluxos e testar alternativas, mas não pode substituir
silenciosamente a referência canônica por uma estimativa com outro grain,
outra cobertura de tarifa ou outra definição de armazenagem. Nesse caso o
resultado informa `flow_detail_available: false` e a fonte do valor
(`phase2_scenario_totals` para a Empresa 2 ou `phase2_runtime_recomputed` para
a Empresa 1).

Moeda, população de fluxos e período precisam ser iguais entre baseline e
cenário. Uma reconciliação aritmética que fecha, mas mistura períodos ou
unidades, não é considerada validação independente.

Na busca do otimizador, o regime tributário canônico é o regime atual, igual ao
baseline publicado. Cenários da reforma tributária, inclusive 2033, entram
somente quando selecionados explicitamente no simulador ou na biblioteca de
stress. Isso evita comparar um cenário futuro com uma base corrente e chamar a
diferença de saving operacional.

## 2. Dados e limpeza

### Empresa 1

O grão canônico de demanda é uma linha com \`UF\` e \`CENTROIDE\` preenchidos. As
três linhas finais de rodapé/fórmula da fonte (linhas Excel 60316–60318) não
pertencem ao grão de demanda e são descartadas pelo builder da Fase 2. O
resumo publicado distingue:

- 60.311 linhas brutas;
- 3 linhas inválidas descartadas;
- 60.308 linhas canônicas usadas no baseline.

O fallback por nome de cidade continua registrado como exceção; ele não deve
ser interpretado como correspondência geográfica exata quando a UF diverge.

### Empresa 2

\`scenario_blocks\` e \`scenario_totals\` são as estruturas canônicas de cenários
do workbook. Linhas de cabeçalho, separadores e totais da planilha plana são
evidência de apresentação e não transações individuais.

As tabelas auxiliares são usadas apenas quando o grain e a unidade são
compatíveis. Linhas placeholder, campos vazios, datas seriais sem validação e
percentuais fora do domínio não são tratados como observações válidas sem uma
regra explícita.

## 3. Escolha B para estoque

A política adotada é \`choice_b_independent_of_active_cd_count\`:

~~~text
inventory_cost =
    inventory_cost_reference
  × demand_multiplier
  × inventory_days / reference_inventory_days
  × wacc / reference_wacc
~~~

Os valores de referência atuais são 45 dias e WACC de 15%, preservados como
premissas versionadas do simulador. Eles não são apresentados como descoberta
do dado-fonte quando o workbook fornece outra taxa implícita.

Não há:

- \`1 / sqrt(n)\`;
- estoque de segurança agregado;
- benefício de pooling;
- redução automática de estoque por quantidade de CDs;
- risco de concentração inventado pelo modelo.

Isso não significa que o custo total seja independente da malha. Armazenagem,
transferência, distribuição, tributação e qualidade operacional podem mudar
com \`active_cds\`. A independência da Escolha B vale para o componente financeiro
\`inventory_cost\`, mantendo demanda, dias e WACC constantes.

## 4. Fontes de custo e proxies

### Empresa 1

- Distribuição: matriz de distância e frete por kg, com \`distance_km\` do fluxo
  usado primeiro quando ele é válido.
- Transferência: proxy quilométrico calibrado por UF a partir dos registros
  observados da Empresa 2 em \`aux_custo_transferencia\` (derivados da base de
  notas fiscais). A Empresa 1 não possui custo de transferência observado por
  km no pacote; portanto, o resultado é um proxy de engenharia
  **cross-company calibrado**, não uma tarifa histórica da Empresa 1. A tabela
  da Empresa 2 não é carregada como dado observado da Empresa 1: somente as
  taxas calibradas, versionadas em \`model-configuration.js\`, são aplicadas.
- Armazenagem: proxy proporcional ao baseline quando não existe tabela de CD
  aplicável. A quantidade de CDs pode afetar armazenagem, mas não estoque.
  Quando a fonte traz tarifa mensal, ela é anualizada por 12. Quando só há um
  total de referência, o fallback é proporcional e não é apresentado como
  decomposição observada entre parcela fixa e parcela variável; o simulador
  não inventa uma estrutura de custo fixo/variável.
- Tributação: referência tributária compartilhada, identificada como fonte
  externa/proxy quando não houver matriz específica da Empresa 1.

### Empresa 2

- Distribuição: tabela CIF somente para fluxos CD → destino quando origem,
  destino e faixa de peso são aplicáveis. Fluxos fábrica → CD são evidência
  operacional separada e não entram no CIF.
- O campo volume dos fluxos fábrica → CD não tem unidade de kg documentada;
  por isso não é convertido em peso nem usado em tarifas R$/kg. Apenas
  annual_weight_kg ou weight_kg identificados são aceitos para CIF e
  transferência física.
- Quando há receita, mas falta peso ou linha CIF aplicável, o modelo usa o
  fallback percentual explícito de 2,5% da receita. Não inventa um peso.
- Transferência: média R$/kg calculada da tabela auxiliar por
  \`origem_uf → destino_uf\`. Quando não há tarifa, usa 40% da distribuição
  disponível; se nem isso existir, usa 2,5% da receita; caso contrário, deixa
  zero e registra a falta de insumo.
- Armazenagem: soma mensal da tabela aplicável anualizada por 12. Diferenças
  em relação ao \`scenario_totals\` canônico permanecem como reconciliação, não
  são ocultadas. Se não houver tabela aplicável, o total de referência é usado
  proporcionalmente; isso continua sendo um fallback total, sem separar custo
  fixo e variável sem evidência na fonte.

Todo fallback aparece em \`warnings\`, \`flow_cost_detail\` e
\`diagnostics.fallback_counts\` do resultado físico. Um zero só significa zero
quando a unidade/insumo permite concluir isso; ausência de insumo não deve ser
silenciosamente exibida como custo observado.

As premissas numéricas centralizadas são: 2,5% da receita para frete sem peso
ou sem linha CIF/matriz aplicável; 40% da distribuição para transferência sem
tarifa/distância aproveitável; e R$ 0,005/kg-km como taxa quilométrica residual
fora de SP, MG, ES e RJ. O resultado de cada cenário informa quantos fluxos
usaram cada regra, permitindo medir a dependência efetiva de aproximações.
Além da contagem absoluta, o resultado publica \`diagnostics.fallback_rates\`,
calculada sobre o número de fluxos avaliados. Essa taxa não é uma margem de
erro estatística; é uma medida de cobertura do dado e de dependência do método
substitutivo.

## 5. Fluxos e realocação

O rebuilder mantém separados:

- \`previous_cd\` / \`previous_cd_uf\`;
- \`assigned_cd\` / \`assigned_cd_uf\`;
- origem física e UF de origem;
- status de realocação.

Fluxos fábrica → CD não são confundidos com fluxo CD → destino. Filiais e
indústrias identificadas por códigos de origem não são forçadas ao primeiro CD
ativo apenas porque o campo de apresentação se chama \`cd\`.

No baseline completo, a expectativa é zero realocações para fluxos já cobertos
e nenhum erro de tarifa causado por trocar um nome de CD por um rótulo de
apresentação.

## 6. Monte Carlo

Monte Carlo é complementar e nunca substitui o resultado determinístico, o
ranking ou os componentes oficiais. O motor distingue a origem da incerteza:

- `empirical_historical`: somente para variáveis com pelo menos duas
  observações históricas fornecidas em `config.history`;
- `hybrid_empirical_parametric`: mistura histórico disponível e premissas nas
  variáveis restantes;
- `parametric_assumptions`: usa os spreads documentados quando não há histórico
  suficiente.

A existência de observações não garante representatividade, sazonalidade ou
independência. O resultado registra variáveis históricas, quantidade de
observações e interpretação condicional da probabilidade. Sem histórico, a
probabilidade é condicional às premissas, não uma frequência histórica.

Características:

- RNG determinística \`mulberry32-v1\`;
- \`seed\` recebida e \`seed_effective\` registradas;
- perfil e spreads registrados;
- baseline sempre vem de \`baselineBundle.costs.costs.total_with_tax\`;
- o total do cenário selecionado é apenas o resultado determinístico;
- cada amostra guarda tributo bruto, multiplicador tributário, tributo ajustado,
  logística, total ajustado e saving;
- iterações solicitadas e válidas são separadas.

O \`tax_multiplier\` é uma incerteza pós-cálculo sobre o impacto tributário da
amostra. Ele não altera o cenário determinístico nem o ranking. A Fase 5 roda
300 amostras com seed 42 e anexa o bloco probabilístico ao cenário final para
recomendação, relatório, auditoria e exportação.

Probabilidade, p10/p50/p90 e faixa de risco são evidências probabilísticas,
não intervalos de confiança formais e não constituem garantia de resultado.

Na Fase 5, as 300 amostras são executadas depois da seleção determinística do
cenário final. O bloco probabilístico é anexado ao pacote final, à
recomendação, ao audit trail e ao export, mas permanece separado do score, do
ranking e dos componentes oficiais. A recomendação só aproveita os gates
probabilísticos quando o bloco existe explicitamente; nunca transforma uma
amostra em custo oficial. O denominador de todo saving probabilístico é o
`baselineBundle.costs.costs.total_with_tax`, enquanto
`deterministic_total_with_tax` identifica apenas o cenário selecionado.

Quando a classificação fiscal completa fica abaixo de 100%, o bloco registra
`decision_use = exploratory_only` e emite alerta. A simulação pode continuar
útil para exploração sob premissas, mas não deve ser apresentada como evidência
de decisão fiscal ou como previsão.

## 7. Otimizador e estabilidade

O otimizador trabalha em uma grade discreta de cenários. Para Empresas com até
quatro CDs, todos os subconjuntos não vazios são enumerados. Para espaços
maiores, a geração usa um catálogo limitado de subconjuntos e informa:

- tamanho do espaço completo estimado;
- quantidade coberta;
- estratégia de geração;
- cobertura do espaço;
- \`exact_search_space = false\` quando a enumeração não é completa.

Portanto, “melhor cenário” significa melhor entre os candidatos avaliados, não
ótimo global, salvo quando \`search_space_complete\` for verdadeiro.

\`search_space_complete\` só pode ser verdadeiro quando todas as dimensões
declaradas foram enumeradas, o limite de candidatos não truncou a busca e a
quantidade gerada coincide com o espaço total calculado. A cobertura dos
candidatos é registrada separadamente; catálogo parcial ou busca truncada não
é promovido a ótimo global.

O seed do otimizador ordena deterministicamente o catálogo de candidatos. A
sensibilidade dos pesos avalia os seis perfis padrão (balanceado, CFO, Supply,
fiscal, conservador e crescimento) sem alterar o cenário oficial. O resultado
informa frequência do vencedor e status \`stable\`, \`sensitive\` ou \`unstable\`.

O projeto não declara um MILP clássico. O pacote não fornece, de forma
confiável e completa, capacidades dos CDs, custos fixos de abertura/fechamento
nem todas as restrições de alocação necessárias para uma formulação desse tipo.
Por isso, a solução publicada é uma enumeração discreta e reproduzível de
cenários operacionais, com cobertura explicitamente informada. Se esses dados
forem disponibilizados, uma formulação MILP ou CP-SAT pode ser avaliada como
extensão separada, sem misturar uma capacidade inventada ao resultado atual.

Restrições de concentração devem permanecer no intervalo (0, 1]; métricas de
concentração ausentes bloqueiam o candidato. O padrão da Fase 5 usa 75% como
limite de concentração por CD, sem afirmar que um CD único possui capacidade
operacional ou pooling de risco.

## 8. Stress, reconciliação e recomendação

Stress cases sujeitos a uma política de otimização não podem desligar tributos
apenas para aumentar artificialmente o saving. A biblioteca padrão usa choques
de frete, demanda, WACC, dias de estoque e regimes tributários permitidos.

O stress calcula saving diretamente contra o baseline oficial, e não contra a
linha do próprio baseline dentro do comparador.

Reconciliação de custos usa as réguas:

- até 3%: alinhado;
- acima de 3% até 10%: tolerável;
- acima de 10%: divergente.

Reconciliação tributária ajustada pelo fator documentado do workbook não apaga
a divergência bruta. “Reconstruído conforme workbook” é diferente de
“validado contra fonte independente”.

Na Empresa 2, o `difference_pct` e o status da reconciliação usam a matriz
bruta; `adjusted_matrix_total` e `adjusted_difference_pct` preservam, em
separado, a ponte de sensibilidade definida na aba Cenários. O ajuste não pode
transformar uma divergência observada em alinhamento.

Uma recomendação limpa exige saving estritamente positivo, risco operacional controlado,
robustez mínima, probabilidade Monte Carlo favorável quando disponível e
estabilidade mínima entre perfis de pesos. Se os perfis mudarem o vencedor, o
resultado deve ser apresentado com alerta e não como decisão universal.

Além dessas condições, a recomendação considera o relatório de evidência do
cenário. Esse relatório separa dados observados, parcialmente observados,
proxies, fallbacks, parâmetros, projeções e reconciliações. Evidência baixa ou
bloqueadores relevantes impedem uma recomendação limpa, mesmo quando o saving
determinístico é positivo. Evidência é medida de suporte, não estimativa de
precisão estatística.

## 9. Limitações que devem acompanhar a apresentação

1. A Empresa 1 não possui benchmark histórico consolidado independente no pacote.
2. Transferência da Empresa 1 usa proxy quilométrico calibrado com observações
   de transferência da Empresa 2; tributação usa referência compartilhada
   quando não há fonte específica. Nenhum desses valores deve ser lido como
   medição histórica própria da Empresa 1.
3. Os cenários 2 e N do workbook da Empresa 2 têm participações por CD que não
   cabem apenas no campo \`active_cds\`; uma comparação like-for-like requer
   adaptador de participação.
4. A reconciliação do workbook pode usar ajustes definidos pela própria aba de
   cenários; isso não equivale a validação externa.
5. Resultados Monte Carlo dependem do perfil, da seed e das distribuições
   declaradas.
6. Um resultado robusto na grade avaliada não prova capacidade, SLA, throughput
   ou viabilidade operacional sem dados adicionais.
7. O baseline recalculado da Empresa 1 é um pacote derivado com proxy de
   transferência e não é comparável, sem ressalva, ao snapshot bruto original;
   ambos permanecem disponíveis para auditoria.
8. Na Empresa 2, linhas de fábrica sem receita explícita não são promovidas a
   faturamento fiscal a partir de volume físico; elas ficam excluídas do fluxo
   fiscal bottom-up e entram na cobertura declarada como limitação.

## 10. Evidência técnica

Os principais pontos de implementação são:

- \`assets/js/core/model-configuration.js\` — premissas, totais, saving,
  reconciliação e fallbacks;
- \`assets/js/phase3/scenario-simulator.js\` — cálculo determinístico oficial;
- \`assets/js/phase3/physical-cost-engine.js\` — custos por fluxo e diagnostics;
- \`assets/js/phase3/monte-carlo-engine.js\` — incerteza reproduzível separada;
- \`assets/js/phase4/scenario-optimizer.js\` — busca e log de cobertura;
- \`assets/js/phase4/optimization-sensitivity.js\` — sensibilidade dos pesos;
- \`assets/js/phase5/stress-test-engine.js\` — stress reconciliado ao baseline;
- \`data/data_quality_summary.json\` — qualidade declarada sem score 100
  automático quando a auditoria materializada não existe.
