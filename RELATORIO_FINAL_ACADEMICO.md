# Relatório técnico de validação — Simulador de Malha Logística

**Revisão:** 6 de novembro de 2026
**Escopo:** críticas H1–H12, código, rastreabilidade dos parâmetros, exportação acadêmica e demonstração pública.

## Parecer

As correções implementadas tornam as premissas, a cobertura e os limites do simulador mais explícitos e impedem que rótulos operacionais ou identificadores de origem sejam apresentados como resultados observados. A demonstração pública usa dados sintéticos. A evidência protegida de execução permanece local, com acesso restrito, e não integra o repositório público nem o pacote do Site.

Este relatório não certifica os dados de empresas, não constitui parecer fiscal e não prova capacidade operacional. Há itens que dependem de dados adicionais ou validação dos autores; eles estão identificados abaixo.

## Resposta às críticas H1–H12

| Item | Tratamento nesta revisão | Limite restante |
|---|---|---|
| **H1 — regra de realocação** | A regra aplicada a fluxos afetados por fechamento de CD é identificada, e a comparação entre menor frete e CD mais próximo é documentada separadamente do baseline. | A recomendação continua condicionada à qualidade das distâncias, tarifas e hipóteses de custo. Não representa validação operacional. |
| **H2 — estoque e WACC** | Os defaults são por empresa e os valores seguem identificados como premissas dos autores, não como valores observados. | A justificativa econômica do WACC precisa de aprovação ou calibração externa antes de uso decisório. |
| **H3 — α e transição fiscal** | Os valores anuais de α estão registrados como pesos matemáticos exploratórios, sem serem chamados de alíquotas legais nem de parcelas tributárias específicas. | A sequência não foi calibrada com dados fiscais por operação. O calendário legal, sozinho, não justifica as magnitudes escolhidas. |
| **H4 — perfis do otimizador** | Os seis perfis são executados separadamente; os pesos, as restrições, a cobertura da busca e a classificação de candidatos são exportados com identificadores opacos. | Uma busca parcial identifica o melhor candidato avaliado, não o ótimo global. A declaração de completude fica limitada ao catálogo efetivamente enumerado. |
| **H5 — Monte Carlo e Tabela 4.4** | As iterações e a seed são registradas e os resultados determinísticos ficam separados da análise de incerteza. Os rótulos **Baixo, Médio e Alto** da Tabela 4.4 são julgamento qualitativo dos autores; não são faixas do índice do simulador nem possuem limiares aplicados às linhas da tabela. | O Monte Carlo atual não reproduz todas as linhas do workbook da Tabela 4.4. Não se deve atribuir os seus percentis às linhas não executadas. |
| **H6 — cenários de CDs** | O pacote acadêmico planeja os cenários de fechamento, identifica o cenário de CD único com frete inalterado e mantém os componentes de custo separados. | Mudanças de custo não comprovam capacidade, nível de serviço ou viabilidade da malha. |
| **H7 — regime e Cenário N** | A transição fiscal é separada da parametrização do simulador. O gerador bloqueia a publicação de resultado para o Cenário N sem matriz fluxo–CD e também não executa essa matriz automaticamente quando ela é encontrada. | O cenário não pode ser fechado sem a alocação e uma execução validada. Os resultados de 2033 permanecem condicionais, sem validação tributária específica. |
| **H8 — divergência de reconciliação** | A divergência entre fontes permanece descrita como divergência bruta, sem atribuição especulativa a uma causa ou a erro do software. A ordem de arredondamento é explicitada. | Falta uma chave comum e autorizada para conciliação operação a operação; por isso, o residual segue sem explicação linha a linha. |
| **H9 — fallbacks** | As regras de fallback são identificadas como hipóteses de engenharia; contagens, denominadores e taxas são separados quando há informação suficiente. | Não há aprovação externa documentada para todos os percentuais. Componentes fixos por CD, variável por movimentação e volume mínimo não são inferidos pelo modelo. |
| **H10 — taxa quilométrica** | A equação e as unidades do proxy são descritas, e a proveniência distingue tarifa observada de calibração incompleta. | Sem distância de rota comparável e fonte autorizada, não há recalibração empírica suficiente para chamar o valor de taxa validada. |
| **H11 — figuras e cobertura** | A regressão, os denominadores de receita e peso, a sensibilidade da planilha, o cálculo por kg e os limites de interpretação da categoria “L” são explicitados no TCC revisado. | A categoria “L” não recebe significado inventado; o custo do modelo não é derivado de uma classificação que a fonte não define. A sensibilidade do workbook não equivale a uma execução independente do simulador. |
| **H12 — identificação visual** | A demonstração e os documentos atuais usam identidade acadêmica genérica, sem logotipo ou nome comercial de empresa. Metadados visíveis, nomes de tema CSS e o identificador de inicialização da interface são genéricos. | Chaves internas de armazenamento e eventos legados são preservados para não invalidar estado local existente; não aparecem como identidade da interface. |

## Base fiscal atual consultada

Na data desta revisão, o TCU havia calculado **11,3468%** como referência da CBS para 2027, arredondada para 11,3%; o Senado ainda não havia fixado o percentual. Esse valor nacional de referência não é alíquota efetiva da empresa nem taxa aplicável diretamente aos custos do simulador. A transição legal e as premissas internas são tratadas separadamente, conforme a [Receita Federal](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/reforma-tributaria-do-consumo/entenda), o [Ministério da Fazenda](https://www.gov.br/fazenda/pt-br/acesso-a-informacao/acoes-e-programas/reforma-tributaria/perguntas-e-respostas/como-sera-a-transicao-para), a [LC 214/2025 consolidada](https://legis.senado.leg.br/norma/40180341/publicacao/40181429), o [cálculo do TCU](https://sites.tcu.gov.br/reforma-tributaria/visao-cbs-2027.html) e a [situação do encaminhamento ao Senado em 3/11/2026](https://www12.senado.leg.br/noticias/materias/2026/11/03/senado-deve-receber-calculo-da-cbs-na-proxima-terca-para-definir-aliquota).

## Evidência e privacidade

Na revisão de 6/11/2026, `npm run quality` terminou com código 0 após a última
alteração do empacotamento do Site: lint e formatação JavaScript/Python, suíte
pública, suíte integral, integridade dos dados cifrados, testes de regressão e
Playwright da interface. O Playwright exercitou a demonstração sintética e o
fluxo de acesso aos dados protegidos; a senha não foi copiada nem versionada. A geração da evidência protegida terminou
para os dois conjuntos; uma varredura adicional confirmou que não há chaves de
dados por fluxo, mensagens livres, IDs de origem, caminhos locais ou nomes de
CDs no JSON de evidência. A evidência de schema 1.2.0 está ignorada pelo Git e
com permissão local `600`.

A projeção acadêmica exporta campos permitidos, reduz mensagens livres a marcadores genéricos e substitui identificadores de cenários e candidatos por referências opacas. Arquivos produzidos com dados protegidos, amostras fiscais por tenant e evidência bruta ficam fora do Git e do Site público. O Site publica a demonstração sintética, a matriz ICMS compartilhada exigida pelo carregador e somente os arquivos cifrados explicitamente citados pelo manifesto; não publica os complementos JSON por tenant.

O sincronizador do Site valida caminhos e rejeita symlinks, monta a pasta pública
em staging com uma allowlist de arquivos e só então troca a publicação. Ele
preserva apenas arquivos cifrados citados pelo manifesto, inclui a matriz ICMS
compartilhada requerida pelo runtime, rejeita conteúdo extra na árvore de origem
e elimina resíduos antigos do `dist`. O
gerador do pacote analítico grava em `entregaveis/privado/` com diretórios `0700`
e arquivos `0600`; o JSON bruto da evidência fica fora desse pacote.

O relatório analítico detalhado, com os valores derivados das fontes empresariais e a classificação individual das pendências, é mantido em arquivo local com permissão restrita. Ele não é publicado neste repositório.

## Conclusão

As críticas estão tratadas no código e no texto na medida permitida pelas fontes disponíveis. Os limites H5, H7, H8, H9 e H10 continuam impedindo uma afirmação de validação fiscal, previsão operacional ou conclusão “100%”. O produto deve ser apresentado como protótipo acadêmico para análise condicional de cenários.
