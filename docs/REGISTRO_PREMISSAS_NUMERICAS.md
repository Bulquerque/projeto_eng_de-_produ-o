# Registro de premissas numéricas

Este registro classifica as constantes que alteram custos, cenários e decisões.
Valores observados no workbook prevalecem quando têm a mesma unidade e definição.
Quando faltam observações, o simulador calcula com uma heurística identificada e
mostra sua origem; não interrompe o fluxo por falta de calibração. Uma referência
externa é proxy de cenário, não fato observado da Empresa 1 ou 2.

## Custos, estoque e tributos

| Parâmetro | Base e fórmula | Uso e limite |
|---|---|---|
| Empresa 1: estoque de referência = 30 dias | Premissa textual do TCC: um mês de estoque; 30 dias é a convenção de conversão de mês. | Mantido como referência específica da Empresa 1. |
| Empresa 2 e fallback geral: DIO = 100,4 dias | Ottobock FY2025: média do inventário (€215,6 mi em 2025; €221,0 mi em 2024) / custo de vendas (€793,3 mi) × 365. | Proxy publicada de fabricante de próteses/bionics; grupo internacional com portfólio misto. Aplicada onde o pacote não fornece dias comparáveis. |
| Sensibilidade DIO = 154 e 187,2 dias | Roland Berger Global MedTech 2023, segmento “medical aids and devices”: DIO 154,0 (2019) e 187,2 (2022), mesma fórmula estoque médio/COGS × 365. | Cenários determinísticos de referência ampla, não faixa de confiança nem previsão da rede. |
| Empresa 1: 15% a.a.; Empresa 2: 12% a.a. | E1 usa a estimativa de custo anual de carregamento de estoque de uma tese MIT sobre kits cirúrgicos de dispositivo médico; E2 usa WACC anual de 12% do workbook. | Para E1, 15% inclui custos de carregamento e não é WACC observado. Preservar o campo legado `wacc` nos dados salvos; rótulos de interface dizem “custo estoque a.a.”. |
| Frete landed sem tarifa = 2,58% da receita | ANS/Anvisa: exemplo de prótese de joelho com R$335 de seguro, frete e desembaraço / R$13.000 de venda hospitalar = 2,5769%, exibido como 2,58%. | Proxy histórica única de importação OPME, não tarifa de frete puro. Só é aplicada quando falta preço tarifário no cálculo da prótese; valores observados prevalecem. |
| Transferência fallback = 40,1% / 23,4% = 1,714 × distribuição | FDC 2018: transporte de longa distância = 40,1% e distribuição urbana = 23,4% do custo logístico em pesquisa com 130 empresas, baseada em 2017. | Proxy multissetorial para falta de custo CD-CD; não é benchmark direto de transferência entre CDs. |
| Tarifa cruzada Empresa 2 → Empresa 1: 0,005 R$/kg e SP 0,0083; MG 0,0049; ES 0,0176; RJ 0,0133 R$/kg | Snapshot ponderado `FRETE VALOR` / `PESO` por UF de destino em `empresa2.aux_custo_transferencia`. O motor calcula `peso_kg × tarifa_R$/kg`; não multiplica por distância. | Proxy interna cross-company, não tarifa observada da Empresa 1. O snapshot preserva a taxa e a fonte do workbook; usar o valor observado da Empresa 1 quando existir. |
| Armazenagem quando falta tarifa por CD | `custo_storage_baseline × CDs_ativos / CDs_baseline`. | Custo médio por CD do orçamento da própria empresa; presume equivalência entre CDs. A tabela por CD, quando existe, prevalece. Substitui os pesos sem fonte 65%/35%. |
| Tributo de venda sem taxa reconciliada = 3,5% | Exemplo OPME ANS/Anvisa: R$455 tributos sobre vendas / R$13.000 venda hospitalar = 3,5%. | Proxy histórica de prótese de joelho, não alíquota legal. Dados fiscais por NCM/operação ou taxa reconciliada da própria base prevalecem. |

## Incerteza e cenários

- Monte Carlo: 300 iterações e seed 42 são configuração operacional reprodutível,
  não evidência estatística. O tamanho suficiente depende da estabilidade dos
  resultados e da precisão pretendida; a seed apenas repete a amostragem.
- Os perfis conservador/equilibrado/amplo e seus spreads de frete, demanda,
  estoque, taxa anual e tributos são choques de cenário determinísticos. São
  decisões de amplitude para explorar sensibilidade, não distribuições
  calibradas. Quando houver histórico com unidade e proveniência, ele alimenta
  o sampler histórico existente.
- Stress de frete +10/+20/+30%, demanda ±10/+20%, estoque +15 dias, taxa anual
  +5 p.p. e bandas de sensibilidade ±10/20% são hipóteses de exploração. Os
  valores são visíveis e editáveis; não descrevem previsões.
- A busca de cenários usa limites e contagem máxima para controlar o espaço
  computacional. Limites, pesos de score, cortes de risco/robustez, fallback e
  pesos de perfis de decisão estão implementados em `scenario-quality-check.js`,
  `objective-profile-library.js`, `evidence-quality-engine.js`,
  `robustness-scorer.js`, `recommendation-engine.js` e `candidate-scenario-generator.js`.
  São convenções de produto ou preferências editáveis, não parâmetros clínicos,
  legais ou médias empresariais; estão explicitados como heurísticas no código e
  a saída continua calculável sem alegar validação empírica.
- Conversões ×12 e estoque médio/COGS ×365 são conversões de período. Cortes de
  conciliação, normalizações, seeds, número de bins, arredondamentos e limites de
  amostragem são regras técnicas do simulador, não dados econômicos observados.

## Fontes

- [Ottobock Annual Report 2025](https://investors.ottobock.com/en/annual-general-meeting): demonstrações consolidadas, estoque e custo de vendas.
- [Roland Berger Global MedTech 2023](https://content.rolandberger.com/hubfs/07_presse/Global_MedTech_2023.pdf): DIO global e segmento medical aids/devices.
- [MIT, Inventory Management Strategy for the Supply Chain of a Medical Device Company](https://dspace.mit.edu/entities/publication/b8bbcc35-7de8-47bf-a529-b55b2562fc21): estimativa de holding cost em caso de dispositivo médico.
- [ANS/Anvisa, relatório final do grupo OPME](https://antigo.anvisa.gov.br/documents/219201/2782895/Relat%C3%B3rio_OPME_compilado_low.pdf/bfcbbcde-7be3-4f87-91b0-37ee5a27e777): exemplo de prótese de joelho, preço e componentes landed.
- [FDC, Custos Logísticos no Brasil 2018](https://www.fdc.org.br/conhecimento-site/nucleos-de-pesquisa-site/centro-de-referencia-site/Materiais/Custos_Logisticos_2018.pdf): composição multissetorial dos custos logísticos.
- [NIST, Monte Carlo uncertainty analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC8201410/): a suficiência da amostra depende da precisão/output e deve ser avaliada.
- Reforma tributária: [EC 132/2023](https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc132.htm), [LC 214/2025 consolidada](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm) e [orientação da Receita Federal](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/reforma-tributaria-do-consumo/entenda). O código identifica transições simplificadas e proxies, não substitui cálculo fiscal por NCM, operação e regime.
