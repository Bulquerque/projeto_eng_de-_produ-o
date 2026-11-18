# Registro de premissas numéricas e fontes

**Escopo:** premissas quantitativas que alteram custos, cenários, incerteza,
classificação ou recomendação no simulador. Valores de pixels, formatação,
índices de loops, coordenadas de mapas, códigos de cadastro e quantidades de
fixtures não são premissas do modelo; continuam pertencendo às suas fontes
técnicas ou de demonstração. O registro não abre nem replica dados protegidos.

**Regra de uso:** cada número deve ser classificado como (1) observado em
workbook, (2) derivado de workbook com transformação explícita, (3) norma ou
referência externa, (4) regra técnica/estatística, ou (5) hipótese exploratória.
Um estudo setorial só pode contextualizar parâmetros transacionais; não converte
uma média de mercado em custo observado da Empresa 1 ou 2. Parâmetro sem fonte
compatível deve ficar marcado como hipótese, com intervalo de impacto e
responsável por sua validação.

## Premissas de custo e operação

| Número e localização | Base e justificativa | Classificação e regra de aplicação |
|---|---|---|---|
| 100,4 dias de estoque; taxa anual 15% (chave legada `reference_wacc`) — `assets/js/core/model-configuration.js` | 100,4 dias é DIO derivado da Ottobock FY2025: média dos inventários €215,6 mi (2025) e €221,0 mi (2024) ÷ custo de vendas €793,3 mi × 365. A taxa de 15% vem de tese MIT sobre fabricante de dispositivos médicos que estimou custo anual de carregamento de estoque acabado em 15% diante da falta de dado por SKU. | Proxies setoriais publicados; Ottobock é um peer de próteses/bionics, mas um grupo internacional com portfólio misto. A tese MIT é estudo de caso, e sua taxa inclui capital e custos não financeiros; não é WACC da empresa. São parâmetros centrais de cenário; o workbook prevalece quando trouxer a mesma definição. A taxa é aplicada ao custo de carregamento, sem ser apresentada como WACC. |
| Frete faltante = 2,5% da receita — mesmo arquivo | Exemplo ANS/Anvisa de prótese de joelho registra R$335 em seguro/frete/desembaraço e preço de venda hospitalar de R$13.000: 335/13.000=2,58%, arredondado para 2,5%. | Proxy de custo logístico de produto implantável no Brasil, baseado em exemplo histórico único de 2015; reúne itens de importação e não é tarifa de transporte puro. Aplicada somente a fluxo sem tarifa observada, com a parcela imputada sinalizada. |
| Transferência fallback = 40,1% / 23,4% = 1,714 × custo de distribuição — mesmo arquivo | Pesquisa FDC com 130 empresas brasileiras (dados 2017) atribui 40,1% do custo logístico ao transporte de longa distância e 23,4% à distribuição urbana. A razão entre as duas participações fundamenta o rateio proxy usado quando transferência não tem custo próprio. | Benchmark nacional multissetorial; mapeamento de longa distância→transferência entre CDs e distribuição urbana→última milha é aproximação operacional, não dado das empresas. Usada apenas quando não há custo de transferência observado. |
| R$ 0,005/kg e taxas por UF SP 0,0083; MG 0,0049; ES 0,0176; RJ 0,0133 — mesmo arquivo | Snapshot ponderado de `FRETE VALOR`/`PESO` por UF de destino calculado sobre `empresa2.aux_custo_transferencia`; R$0,005 é a taxa residual de fallback e os valores por UF preservam as taxas da calibração interna. | Proxy derivada do workbook da Empresa 2 aplicada à Empresa 1. A unidade observável é R$/kg; o cálculo multiplica somente pelo peso. Não é tarifa observada da Empresa 1 e a distância não é multiplicada novamente. |
| Armazenagem quando não há tarifa por CD — `physical-cost-engine.js` | Rateio linear do custo de armazenagem do baseline da própria empresa pelo quociente CDs ativos / CDs do baseline. | Proxy de custo médio por CD ancorada no orçamento da própria empresa; assume CDs equivalentes e não captura parcela fixa, sazonalidade ou diferenças de porte. Substitui a divisão sem fonte 65%/35%; tabela observada por CD tem precedência. |
| Mínimo de 3% para “alinhado” e até 10% para “tolerável” — mesmo arquivo | Régua interna de reconciliação. A ETL também contém cortes e escores semelhantes, com implementação própria. | Critério operacional do produto, não tolerância universal nem regra contábil. Exibido como régua de comparação para tornar diferenças de conciliação legíveis. |
| Conversão mensal ×12 e fator anual; multiplicações por 30/365 e pesos de período — `etl/build_phase2_baseline.py` e motores | Conversões de período/unidade ou aproximações da fórmula documentada. | Aplicadas conforme unidade e período declarados pela coluna fonte; ×12 anualiza mês e 365 converte DIO anual. O app não interrompe o cálculo quando recebe um proxy; apresenta a origem e a regra usadas. |

### Referências públicas: contexto, sem substituir dados da empresa

- A pesquisa [Custos Logísticos no Brasil 2018 da Fundação Dom Cabral](https://www.fdc.org.br/conhecimento-site/nucleos-de-pesquisa-site/centro-de-referencia-site/Materiais/Custos_Logisticos_2018.pdf) consultou 130 empresas e reportou logística média de 12,37% da receita; transporte de longa distância representa 40,1% e distribuição urbana 23,4% do custo logístico. A razão entre os dois componentes (~1,714) é usada como proxy de transferência/distribuição. A pesquisa é multissetorial e não sustenta tarifa por kg-km.
- A [Ottobock publicou o Relatório Anual 2025](https://investors.ottobock.com/en/annual-general-meeting) em seu portal de investidores; a demonstração consolidada apresenta estoque de €215,6 mi em 2025 e €221,0 mi em 2024, e custo de vendas de €793,3 mi. DIO calculado pela fórmula estoque médio/COGS×365 resulta em 100,4 dias. É proxy de um fabricante global de próteses/bionics com negócios também em cuidado ao paciente, não valor observado das Empresas 1 ou 2.
- A tese do MIT sobre [estratégia de estoque em fabricante de dispositivos médicos](https://dspace.mit.edu/entities/publication/b8bbcc35-7de8-47bf-a529-b55b2562fc21) adotou 15% como custo anual de carregamento de SKUs acabados, explicitamente por falta de dados específicos. O conceito agrega capital e custos não financeiros; fundamenta uma taxa de carregamento setorial de cenário, não o WACC financeiro da empresa.
- O [relatório final do grupo OPME da ANS/Anvisa](https://antigo.anvisa.gov.br/documents/219201/2782895/Relat%C3%B3rio_OPME_compilado_low.pdf/bfcbbcde-7be3-4f87-91b0-37ee5a27e777) mostra exemplo de prótese de joelho com R$335 para seguro, frete e desembaraço, diante de R$13.000 de preço de venda ao hospital: 2,58%. É um exemplo de 2015, não uma tarifa ou média de mercado; sustenta apenas o proxy de ordem de grandeza de 2,5% para custos logísticos landed do produto.
- A [metodologia da ANTT](https://www.gov.br/antt/pt-br/assuntos/cargas/politica-nacional-de-pisos-minimos-de-frete/como-calcular) define o piso por tipo de carga, configuração veicular/eixos, CCD em R$/km e parcela de carga/descarga. A [atualização publicada em setembro de 2026](https://www.gov.br/antt/pt-br/assuntos/ultimas-noticias-antt/antt-atualiza-coeficientes-do-piso-minimo-do-frete-e-divulga-novo-preco-de-referencia-do-diesel/) traz coeficientes mais recentes que a Resolução 6.084/2026 de julho. Essa referência pode apoiar comparação se operação, carga, veículo, distância e unidade forem compatíveis; não se converte diretamente para R$/kg-km ou custo CD-CD.
- O estudo [Global MedTech 2023 da Roland Berger](https://content.rolandberger.com/hubfs/07_presse/Global_MedTech_2023.pdf) informa DIO médio de 147,6 dias em 2019 e 170,5 em 2022 no conjunto global de 109 companhias MedTech; o segmento medical aids and devices registra 154,0 e 187,2 dias. A fórmula é estoque médio/COGS×365. É referência para sensibilidade mais ampla; 2022 reflete disrupção de suprimentos e o segmento é heterogêneo.
- A [Resolução CVM 215, Anexo B, art. 15](https://conteudo.cvm.gov.br/legislacao/resolucoes/anexos/200/resol215consolid.htm) exige que laudos cobertos pela norma explicitem fontes, equações e justificativas das premissas e metodologia da taxa de desconto. É referência de transparência, não fonte para WACC de 15% nem taxa universal.
- O estudo metodológico do [NIST sobre consistência em análises Monte Carlo](https://pmc.ncbi.nlm.nih.gov/articles/PMC8201410/) explica que o tamanho adequado depende da aplicação, saída e precisão; amostras de 10³ a 10⁶ são frequentemente usadas, e a adequação deve ser verificada por saída. Não valida diretamente essa aplicação, mas impede tratar 300 amostras como precisão/convergência presumida.

## Incerteza, stress e decisão

### Monte Carlo

Os defaults atuais são 300 iterações e seed 42 (`assets/js/phase3/monte-carlo-engine.js` e interfaces da Fase 3/5). A seed é para reprodutibilidade. N=300 é configuração de execução exploratória; só pode sustentar estimativas de probabilidade/percentis após teste de estabilidade dos outputs relevantes. Os perfis conservador/equilibrado/amplo definem spreads de frete, demanda, dias de estoque, WACC e tributos, além de choques compartilhados e individuais. Não há fonte histórica passada pelo provider observado, então esses perfis são hipóteses sintéticas até a entrada de histórico com origem, período, empresa e unidade.

Os domínios do histórico incluem multiplicadores de frete/demanda/tributo até 3, estoque 0–365 dias e WACC 0–100%; amostras históricas exigem pelo menos 2 valores, com alerta abaixo de 5 observações. As amostras paramétricas têm seus próprios limites descritos abaixo; o histograma usa 12 bins por default e limites técnicos. São guardrails e escolhas de visualização/validação, não benchmark empresarial. O requisito de cinco observações não implica amostra estatisticamente suficiente.

As amplitudes atuais dos perfis (conservador/equilibrado/amplo) incluem spreads
de frete de 4,5%/8%/12%, demanda de 3,5%/7%/10%, estoque de 5/9/14 dias, WACC
de 1,2/2/3 p.p. e tributos de 2,5%/4%/6%, além de choques compartilhados
0,18/0,32/0,48 e individuais 0,45/0,65/0,85. Os valores são cenários
paramétricos sem calibração empresarial referenciada no código. Limites de
amostragem como frete 0,6–1,8, demanda 0,6–1,6, estoque 0–120 dias, WACC
0–50% e multiplicador tributário 0,7–1,35 também são guardrails internos.
Até que dados históricos com proveniência alimentem o provider e exista estudo
de estabilidade, os resultados permanecem exploratórios.

O motor classifica risco com probabilidade de saving positivo abaixo de 60% ou
P10 negativo (alto), e abaixo de 80% ou P10 abaixo de 2% (médio). A probabilidade
de saving forte usa corte de 5%; intervalos da proporção usam z=1,96. As bandas
60%/80%, P10 de 0%/2% e saving de 5% são regras internas sem calibração
documentada; z=1,96 é o quantil normal convencional para intervalo bilateral
nominal de 95%, mas não resolve amostra pequena nem convergência.

### Cenários e score

| Parâmetros atuais | Localização principal | Classificação |
|---|---|---|
| Limite de volume por CD 75%; redistribuição 50%; fluxo sem distância 5%; score inicial 100; penalidade de concentração até 35 (1 ponto por p.p. acima do limite), realocação até 25 (share × 30), falta de cobertura −40 e aumento de custo >10% −10; cortes de risco 85/65 | `assets/js/phase3/scenario-quality-check.js`, providers e dashboards | Regras internas. Não demonstradas como capacidade física nem limite de mercado. Preferir limites observados de capacidade/workbook por CD quando existirem. |
| Stress padrão: frete +10/+20%, demanda ±10%, WACC +5 p.p., estoque +15 dias e reforma 2033; cenário amplo inclui frete +30% e demanda +20% | `assets/js/phase5/stress-case-library.js` | Cenários hipotéticos de exploração; magnitude não observada nem benchmark. Parametrizar conforme dados temporais próprios e preservar rótulo de stress. |
| Grades de sensibilidade ±10/20%, estoque 100,4/154/187,2 dias e taxa anual de carregamento 10/15/20% | `assets/js/phase5/sensitivity-engine.js`, `assets/js/app/providers/project-provider.js` | Estoque usa o DIO peer central e o intervalo do segmento MedTech citado acima; taxa anual tem base MIT de 15% e banda de ±5 p.p. como stress de sensibilidade. São cenários determinísticos, não intervalos probabilísticos nem previsão. |
| Perfis de objetivos com pesos balanceado, CFO, Supply, fiscal, conservador e crescimento | `assets/js/phase4/objective-profile-library.js` | Preferências editáveis de decisão; pesos somam 100%, mas não são dados, benchmarks ou preferências validadas de decisores reais. |
| Pesos/limiares de robustez, qualidade, risco, saving, estabilidade de ranking e evidência — `assets/js/phase5/robustness-scorer.js`, `recommendation-engine.js` | Pontuações internas de produto/decisão. Artigos sobre custo logístico não calibram estes rótulos. | Hipótese normativa de decisão. Não apresentar recomendação como validada sem calibração em decisões rotuladas, análise de sensibilidade e revisão metodológica. |

### Pontuação, ranking e busca (Fases 4–5)

- Os perfis de `objective-profile-library.js` pesam (custo, serviço, risco,
  tributo, estoque): **Balanceado** (.30,.25,.20,.15,.10), **CFO**
  (.50,.10,.10,.20,.10), **Supply** (.20,.40,.25,.05,.10), **Fiscal**
  (.25,.10,.15,.40,.10), **Conservador** (.20,.30,.35,.05,.10) e
  **Crescimento** (.20,.45,.15,.05,.15). São políticas ajustáveis; o cenário
  vencedor depende do perfil escolhido. Não há pesquisa de preferência de
  decisores que valide esses pesos.
- `scenario-metric-extractor.js` converte risco baixo/médio/alto em 20/55/90,
  usa 50 para valores ausentes e calcula eficiência de estoque como
  `100 × (1 − estoque/logística)`. `metric-normalizer.js` normaliza min–max para
  0–100 e usa neutro 50 quando falta dimensão ou min=max. São convenções internas
  de score, não medidas diretas nem padrões externos.
- `optimization-sensitivity.js` trata estabilidade ≥0,67 como estável e ≥0,50
  como sensível; a recomendação já usa ≥0,50 como ranking estável. Essa diferença
  entre status e recomendação precisa ser resolvida antes de interpretar um
  status como regra de decisão.
- `candidate-scenario-generator.js` usa grades default de frete
  [.95,1,1.10], demanda [.95,1,1.05] e estoque [100.4,154,187.2] dias, limite default de
  120 candidatos e enumeração exaustiva apenas para redes pequenas (até quatro
  CDs). Para redes maiores amostra subconjuntos com limites de singles, pares,
  trios e shuffle com seed. `optimizer-refinement.js` ajusta frete/demanda ±5%,
  estoque ±15 dias em passos de 5 (limites 15–365 dias, máximo de um ciclo anual) e taxa anual de carregamento ±2 p.p. (limites 1–50%);
  os multiplicadores têm limites .5–3. O otimizador limita candidatos em 2.000
  por default. Esses são limites de busca/custo computacional que restringem
  cobertura; resultado é condicional ao espaço pesquisado, não benchmark ótimo.
- Em `evidence-quality-engine.js`, classes recebem força observada 1,
  reconciliada .85, parcialmente observada .65, parâmetro .45, proxy .35,
  projeção .25, fallback .15 e desconhecida 0. Scores têm cortes 80/55; caps
  incluem 54 com fallback ≥25%, 59 com cobertura fiscal <50% e 69 sem benchmark
  histórico. Distribuição cai para fallback quando sua taxa atinge 50%; o
  blocker de fallback físico aparece a partir de 25%. São pesos/caps internos
  sem validação calibrada, embora expressem ordenação qualitativa de força da
  evidência.
- A robustez combina share de stress positivo (70%), qualidade (30%), risco
  alto/médio penalizado em 18/8 pontos, e pior saving negativo penalizado em
  2 pontos percentuais por ponto percentual de perda (teto 30). Com Monte Carlo,
  combina score de stress (70%) com probabilístico (30%); este último usa
  probabilidade de saving (70%) e P10 não negativo (30%). Evidência abaixo de
  70 pode perder até 20 pontos. Status usa 80/55. Recomendação “direta” pede
  robustez ≥70, probabilidade ≥65%, P10 ≥0, estabilidade ≥50%, busca exata e
  evidência suficiente ≥70; recomendação com alertas usa robustez ≥45,
  probabilidade ≥50% e evidência ≥45 sem blockers. Nenhum desses pesos/cortes
  está calibrado em decisões observadas.
- `complements.js` prioriza fontes na ordem observed tenant → oficial externa →
  referência externa → proxy de outra empresa → cenário manual → desabilitada
  (desconhecida fica em último). É uma política de precedência, não prova de
  qualidade/atualidade da fonte; guardar data, compatibilidade e critérios de
  desempate junto ao complemento.

### Reconciliação da ETL

- O Base Fit em `etl/build_phase2_baseline.py` marca erro absoluto até 3% como
  alinhado e até 10% como atenção. O score usa média de
  `max(0, 100 − 4 × erro percentual absoluto)` e cortes ≥90/≥70 para status.
  Essas regras podem divergir entre métricas: por exemplo, erro de 3% recebe
  score 88, embora o corte por erro marque alinhado. Não tratar ambos como um
  único critério até resolver essa definição.
- A reconciliação tributária usa tolerância default de 1%; ajuste exploratório
  de matriz usa `(1 + delta_fat)²`, enquanto o status de reconciliação mantém a
  comparação do total bruto. O quadrado deve ser justificado por fórmula/célula
  do workbook; sem ela, permanece transformação específica do estudo, não regra
  fiscal geral.

**Limite de interpretação:** outputs dependem diretamente dessas distribuições, cortes e pesos. Enquanto não houver histórico específico e estudo de convergência/calibração, comunicar como exploração condicional ao modelo; não afirmar previsão probabilística observada.

## Tributos e fixtures

- `data/tax/tax_reform_config.json` e `assets/js/core/tax-reform-config.js` contêm cronograma, alíquotas, créditos e multiplicadores de cenário. Confronto documental com a [EC 132/2023](https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc132.htm), a [LC 214/2025 consolidada](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm) e a orientação da [Receita Federal](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/reforma-tributaria-do-consumo/entenda) mostra que o arquivo mistura regras legais com projeções e proxies, e há diferenças entre configuração JS e JSON. Não é parecer tributário nem substitui revisão fiscal por classificação e operação.

| Número/regra | O que a fonte permite dizer | Estado no modelo e ajuste de interpretação |
|---|---|---|
| 2026: CBS 0,9% e IBS 0,1% | Ano de teste previsto na LC 214, arts. 343–348, sob regras de compensação/obrigações. | Pode ser citado como taxa de teste da lei. Peso atual 99,5% e crédito uniforme de 2% não são prescritos como mix geral/crédito sobre débito; são proxies do código. |
| 2027–2028: CBS 8,8% | O Ministério da Fazenda divulgou 8,8% como estimativa em abril de 2024; a LC 214 prevê fixação de alíquotas de referência por resolução do Senado (art. 349), então o número não é taxa final garantida pela lei. | Usar como estimativa paramétrica datada, não alíquota certa. O peso global `current_weight=0.72` é escolha do modelo. A LC prevê IBS inicial de 0,1% (0,05% estadual + 0,05% municipal); o JSON contém 0,1%, mas a configuração JS observada contém 0: divergência a corrigir antes de comparar as fontes. |
| 2029–2032: pesos atuais 90/80/70/60% e IBS 10/20/30/40% | A transição legal reduz progressivamente ICMS/ISS nestes percentuais. | O código aplica peso global a todo o bloco atual versus todo o bloco da reforma. Isso não equivale ao cronograma legal por tributo: PIS/Cofins saem em 2027 e CBS não é faseada em 10–40% nesses anos. Rotular hoje como modelo de transição simplificado, não cálculo legal integral. |
| IBS 17,7%, CBS 8,8%, IS uniforme 1%/2% | As alíquotas de referência precisam de fixação/atualização normativa; o 8,8% + 17,7% divulgado pelo MF era estimativa. O imposto seletivo depende dos bens/serviços definidos e não constitui alíquota uniforme geral. | Valores de referência estimados devem permanecer claramente datados; IS uniforme por ano não está sustentado como alíquota geral. |
| Créditos flat 1–22% e multiplicadores por classe (ex.: 0,65/0,70/0,75/0,80/1,05) | A LC 214 disciplina créditos regulares e hipóteses específicas; lista de produtos/requisitos legais não equivale a redutores genéricos sobre débito por classe. | Proxies de cenário sem respaldo legal genérico identificado. Não chamar de crédito fiscal confirmado nem alíquota legal; segregar do motor legal e exigir validação de NCM/regra aplicável. |
| “Prótese inteligente” | A LC 214, art. 144 e Anexo XII, item 5, prevê alíquota zero para próteses não dentárias da NCM 9021.3, exceto 9021.39.91 e 9021.39.99, sob requisitos como regularização na Anvisa. A lista de dispositivos com redução de 60% (art. 131/Anexo IV) é fechada e não cria benefício geral para todo item chamado prótese. | Não inferir NCM ou benefício pela descrição “prótese inteligente”. Validar NCM, registro Anvisa, operação e requisitos fiscais do item antes de aplicar tratamento; sem isso o resultado é indeterminado. |

Fontes públicas para o cronograma: [texto da EC 132/2023](https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc132.htm), [LC 214/2025 consolidada](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm), [guia da Receita Federal](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/reforma-tributaria-do-consumo/entenda) e [estimativa do Ministério da Fazenda de abril de 2024](https://www.gov.br/fazenda/pt-br/assuntos/noticias/2024/abril/ministerio-da-fazenda-detalha-projeto-de-lei-que-regulamenta-o-novo-sistema-de-tributacao-do-consum). A fonte legal define transição e condições, não as proxies privadas usadas pelo simulador.

- `data-demo/empresa_mock/*.json` é fixture sintética (`synthetic: true`, `public_demo_fixture`, `demo_only`). Volumes, custos, cenários, pesos, probabilidades e scores são dados de demonstração; não usar como fonte para Empresa 1/2 nem para validar benchmark. A tela deve preservar o rótulo de demonstração junto aos scores.
- As estimativas por fallback permanecem disponíveis como heurísticas, com sua origem, unidade, período, fórmula e limitações descritas junto ao parâmetro. As taxas observadas nos workbooks têm precedência; proxies externos ou de outra empresa são usadas como referência estimada e identificadas no diagnóstico do cálculo.
- Para a alíquota efetiva de venda quando falta uma taxa reconciliada da própria base, o fallback de 18% foi substituído por 3,5%, derivado do exemplo OPME ANS/Anvisa (R$455 de tributos sobre vendas ÷ R$13.000 de venda hospitalar). É proxy histórica de uma prótese de joelho, e não uma regra fiscal universal; havendo NCM, CFOP, CST e operação, aplicar a tributação específica legal em vez desse proxy.
- Códigos de cadastro como 1001/3001 são identificadores específicos da base, não benchmarks. Coordenadas, dimensões visuais, limites de paginação e sentinelas numéricas de algoritmo são detalhes técnicos, mas sentinelas não devem vazar para resultados de domínio.

## Próximo passo de rastreabilidade

Para promover hipótese a dado do estudo, anexar a cada parâmetro: `id`, valor e unidade, empresa, workbook/aba/célula ou URL oficial, período e população, transformação/fórmula, tipo de evidência, versão/hash da fonte, uso permitido, intervalo de impacto e status de revisão. Quando a fonte empresarial estiver protegida, referenciar sua origem sem copiar ou descriptografar dados para este registro.
