# Plano de melhoria da interface e validação para apresentação

> Execução realizada em 02/10/2026. Este arquivo preserva o diagnóstico e o plano inicial. O estado final, testes e publicação estão em [RELATORIO_INTERFACE_2026-10-02.md](RELATORIO_INTERFACE_2026-10-02.md).

Data: 2 de outubro de 2026. Escopo desta entrega: análise e planejamento; implementação e publicação pertencem às etapas abaixo.

**Escopo confirmado na última instrução:** manter todas as cores, a identidade visual e a base da interface existente. Corrigir erros, limpar conteúdo e reorganizar apenas o que o feedback exige. Preservar tipografia, botões, cartões, mapa, gráficos e padrões de componentes que já funcionam. As referências anyLogistix/Cosmic Frog orientam a clareza e o comportamento; não são um layout a copiar. Não haverá troca de tema, nova identidade, novo framework ou reescrita ampla do motor.

**Ordem de trabalho:** fonte correta → erros funcionais e inconsistências → limpeza editorial → fluxo e resultados → correções visuais → testes → GitHub e Sites. Subagentes Luna participam da execução; este documento não registra execução de agentes ou publicação.

## 1. Diagnóstico e evidências atuais

Fontes: texto anexado pelo usuário, leitura do checkout e da referência Git local `origin/integration/final-delivery`, consulta aos conectores GitHub/Sites e exploração da produção pelo Playwright MCP. Chrome foi solicitado inicialmente, mas não está conectado; o usuário autorizou Playwright MCP para esta análise.

Site analisado: https://visagio-logistica.gptgrupo-especial.chatgpt.site

- Sites registra versão mais recente 18, com fonte `486820833a8398e5338f43ed69cd44ded7c9f749`. A aplicação Network Intelligence foi acessada ao vivo. A consulta de versões identifica a fonte da versão salva; a implementação deverá confirmar também o deployment ativo.
- Checkout atual em HEAD destacado: `0114daba086a3f92c9b1876849195b7baaa2afd9`. Sua entrada ainda contém painéis de diagnóstico; `assets/js/app/` existe na referência de integração consultada, mas não no HEAD atual. Não começar a refatoração na base errada.
- Repositório confirmado pelo conector: `Bulquerque/projeto_eng_de-_produ-o`, público, branch padrão `main`.

### Passos observados e saúde de cada passo

| Passo | Tela ou ação | Saúde observada | Evidência |
|---|---|---|---|
| 1 | Visão executiva da Empresa Falsa | Carrega; excesso de termos e blocos técnicos; apresenta números demonstrativos | `../.playwright-mcp/01-resumo.png` |
| 2 | Construção de cenário demonstrativo | Campos desabilitados e aviso de somente leitura; não prova simulação interativa | `../.playwright-mcp/02-cenarios.png` |
| 3 | Configuração do otimizador | Carrega e possui seção avançada recolhida; parâmetros técnicos ainda dominam a configuração | `../.playwright-mcp/03-otimizador.png` |
| 4 | Clique em Executar otimização na Empresa Falsa | Desvio confirmado para `#/network/trust/validation` | `../.playwright-mcp/04-desvio-validacao.png` |
| 5 | Resultados acessados diretamente | Ranking visível, mas custo e risco ausentes; melhor candidato mostra zero CDs; nomes internos expostos | `../.playwright-mcp/05-resultados.png` e `10-resultados-desktop.png` |
| 6 | Seleção da Empresa 1 | Exige frase de acesso; exploração interna não realizada | `../.playwright-mcp/06-empresa1.png` |
| 7 | Seleção da Empresa 2 | Exige frase de acesso; exploração interna não realizada | `../.playwright-mcp/07-empresa2-acesso.png` |
| 8 | Malha demonstrativa em 1440 × 900 | Mapa e topologia renderizam; boa base para a identidade visual | `../.playwright-mcp/08-malha-desktop.png` |
| 9 | Malha demonstrativa em 390 × 844 | Cabeçalho ocupa quase toda a primeira tela; navegação parcialmente fora da área visível; medição não encontrou overflow horizontal da página nesse recorte | `../.playwright-mcp/09-malha-mobile.png` |

As capturas foram abertas e inspecionadas nesta execução. As primeiras foram obtidas no viewport inicial menor; as capturas 8 e 10 usam desktop explícito. Não deduzir comportamento em todas as resoluções dessas imagens.

### Achados prioritários

1. **P0 — contexto de versão:** recuperar e comparar a fonte exata da interface publicada com `main` e integração antes de editar. O plano deve preservar correções posteriores de criptografia.
2. **P1 — destino após otimização:** o usuário deve chegar a Resultados. Na referência de integração lida, `assets/js/app/main.js`, ação `runDecision`, termina em `#/network/trust/validation`. Tratar isto como pista concreta, sem assumir que toda a fonte da v18 é idêntica a essa referência.
3. **P1 — inconsistência entre telas:** a consolidação demonstrativa mostra custo de R$ 312.500 e três CDs na construção, mas custo ausente e zero CDs no destaque do ranking. Investigar contrato do provider, campos dos candidatos e seletores antes de corrigir. Ausência de dado deve continuar ausente; jamais preencher com um zero de fallback.
4. **P1 — demonstração funcional:** a Empresa Falsa usa fixtures e campos somente leitura. A afirmação do texto anexado de que dados falsos permitem testar o otimizador não está comprovada para o motor real no fluxo publicado. Criar ou validar uma base sintética executável, separada das fixtures de apresentação, ou descrever claramente a demonstração estática.
5. **P1 — revisão editorial:** `demo_fixture`, `success_with_limited_space`, `mock_consolidation`, `PROJECT`, `Evidence`, `provider`, `QA` e `release_policy` aparecem na experiência. Traduzir o significado útil e recolher identificadores de engenharia.
6. **P1 — apresentação em telas menores:** compactar o cabeçalho e rever navegação, tabela, formulário e modal. Há risco visual de contraste baixo nos estados ativos observado em capturas; medir contraste na implementação.
7. **P2 — confiança:** a navegação dá protagonismo à auditoria e o resultado começa com cobertura e status da busca. Priorizar custo, diferença frente ao baseline e consequências operacionais.

## 2. Princípio de produto e organização do conteúdo

Uma tarefa principal por etapa. A interface deve explicar a operação e levar até um resultado compreensível.

Jornada: **Empresa → Visão da rede → Construir cenário → Simular → Otimizar → Resultados**.

Usar a seleção de empresa, a navegação e as páginas existentes para representar essa sequência. A visão executiva reúne resumo e rede; Cenários conduz da configuração à simulação; Otimização conduz da configuração aos resultados consolidados. Recolher Dados & confiança em acesso secundário. Mostrar etapa e próxima ação com os componentes atuais; não criar cinco novos destinos apenas para reproduzir a lista. Simular é uma ação explícita dentro de Cenários, seguida de comparação. Otimizar é continuação opcional: uma simulação válida pode ser apresentada e exportada sem otimização. Preservar retorno às etapas concluídas e acesso direto com estados vazios orientativos.

| Informação | Local proposto | Regra |
|---|---|---|
| Empresa ativa, cenário e tipo de base | Cabeçalho compacto | Sempre reconhecíveis |
| Custo, diferença monetária e percentual, serviço quando disponível | Resumo do resultado | Comparação com mesma base e período |
| Dados demonstrativos ou resultado desatualizado | Aviso curto junto ao resultado | Sempre visível quando aplicável |
| Limitação material de dados ou premissa fiscal relevante | Nota curta no resultado | Não esconder informação que altera a decisão |
| Modo avançado e pesos | Expansor dentro da configuração | Recolhido por padrão |
| Fontes, cobertura, metodologia e auditoria | Link secundário “Detalhes dos dados” e painel acessível | Fora da jornada principal; preservados |
| JSON, nomes de campos, paths e logs | Exportação e diagnóstico | Fora do resumo de negócio |

“Bem escondidinha” deve significar secundária e recolhida, com nome fácil de encontrar. Nenhuma transparência essencial deve depender de um ícone sem rótulo ou desaparecer. Não converter robustez, qualidade de dados, cobertura de busca e incerteza exploratória em um único selo de confiabilidade.

## 3. Direção visual

Preferência refinada pelo usuário: **mais limpo, mais ágil, com aparência de aplicativo de análise; menos texto, menos caixas e menos explicações sobre o próprio sistema**. A limpeza inclui excluir conteúdo redundante, não apenas transferir todos os parágrafos para expansores. As regras e referências da seção 7 orientam o acabamento desta seção.

Preservar todas as cores e o estilo existentes. Usar o mapa e os gráficos da operação como elementos visuais principais. Ajustar largura, alinhamento, espaçamento e distribuição usando os padrões já presentes na interface.

- Cabeçalho compacto com contexto essencial; retirar badges de ambiente da área de negócio.
- Hierarquia de texto clara: título, breve instrução, resultado e ação. Uma frase para introduzir cada tarefa, sem parágrafos sobre a arquitetura interna.
- Reutilizar a escala de espaçamento e os componentes existentes; remover caixas que ficam sem função após a limpeza do texto.
- Contraste medido, estados ativos legíveis, foco visível e leitura em projetor. Corrigir combinações de cores usando a própria paleta, sem substituí-la.
- Uma ação primária por etapa: “Ver rede”, “Simular cenário”, “Otimizar alternativas” ou “Exportar resumo”. Outras ações como links ou menu secundário.
- Números com moeda, unidade, período e formato pt-BR; uma legenda curta explica a comparação.
- Gráficos de custo e comparação com baseline próximos dos KPIs. Trade-offs, sensibilidade e risco como detalhes da mesma área de resultados.
- No celular, cabeçalho sem alturas que criem grandes vazios; controles empilhados; tabela rolável ou alternativa em cartões; menu acessível. Testar 390, 768, 1366 e 1440 px, além de zoom a 200%.

Registrar antes/depois de Visão executiva/Rede, Cenários e Resultados nas mesmas condições. Conferir que as correções preservam a identidade. As referências externas servem de apoio à hierarquia; não preparar um redesign completo ou alterar o estilo para aproximá-lo desses produtos.

## 4. Etapas de execução e critérios de aceite

### Etapa A — estabelecer a fonte e inventariar funções

Recuperar fonte da v18 pelo fluxo do Sites, comparar com GitHub, preservar criptografia e criar branch `codex/interface-guiada` na base escolhida. Não substituir o Site existente.

Criar matriz **pedido do professor → função antiga → interface atual → módulo → teste → evidência → estado**. Incluir seleção/carregamento, baseline, rede, custos, tributos, parâmetros, simulação, comparação, presets, persistência, importação/exportação, otimização, ranking, trade-offs, sensibilidade, risco, decisão e resumo exportável. Registrar lacunas como implementadas, parciais, pendentes ou bloqueadas.

Aceite: cada item do anexo rastreado e a base de implementação identificada. Funções do frontend antigo não desaparecem silenciosamente.

### Etapa B — corrigir comportamento e contratos

- Separar o encaminhamento de “Executar otimização” e da decisão final quando necessário. O término bem-sucedido da otimização abre Resultados, preservando o candidato e o contexto.
- Resolver os campos discrepantes entre cenário, ranking, gráficos e exportação com seletores compartilhados.
- Reconciliar cenários e status: nunca mostrar baseline carregado ou resultado calculado antes da carga efetiva.
- Invalidar ou marcar resultados desatualizados após mudança de empresa ou parâmetros.
- Testar falha/cancelamento do desbloqueio, restauração da empresa ativa e ausência de mistura entre bases.
- Para a base sintética executável, comprovar que alteração de um parâmetro produz recálculo pelo motor e que mudança de restrição afeta candidatos elegíveis. Fixtures de apresentação continuam identificadas.

Aceite: regressões para o destino após execução, identidade dos candidatos, nulo versus zero, consistência entre telas, estado desatualizado e isolamento por empresa.

### Etapa C — jornada e simplificação

Organizar as páginas existentes em sequência com progresso e próxima ação. Recolher Dados & confiança em “Detalhes dos dados”. Configurar cenários predefinidos em um dropdown com nomes claros; já existe seletor global na produção, então consolidar seletores e biblioteca em vez de adicionar mais um controle redundante.

Aceite: alguém sem conhecimento prévio consegue selecionar uma base, entender a rede, configurar, simular e chegar ao resultado sem procurar a próxima tela. Rotas antigas continuam resolvendo com equivalência explícita.

### Etapa D — resultados e acabamento visual

Ordem do resumo: melhor alternativa e tipo de base; custo e economia frente ao baseline; consequências operacionais e limites relevantes; comparação; ranking; detalhes de trade-offs e risco; fontes/metodologia; exportação.

Corrigir mapa, gráficos e tabelas de cada empresa após desbloqueio legítimo. Verificar unidades, legenda, ordenação, soma de componentes, comparabilidade e campos ausentes. Serviço e outras métricas só aparecem como valores quando fornecidos e definidos pelo modelo.

Aceite: o mesmo cenário apresenta valores iguais em KPIs, tabelas, gráficos e exportação. Tela de resultados permite explicar o ganho e a limitação principal sem visitar a auditoria.

### Etapa E — testes e ensaio

Executar os testes correspondentes à base recuperada. Não aceitar apenas `npm run quality` como prova de lint: na referência de integração consultada esse comando executa apenas `npm test`. Planejar lint, formatação, testes públicos, testes do motor e E2E explicitamente.

Matriz mínima:

| Família | Casos obrigatórios |
|---|---|
| Empresas | Sintética executável, Empresa 1 e Empresa 2; troca repetida, carga, desbloqueio/cancelamento e reload |
| Cenários | Baseline, preset e cenário manual; mudança de frete/demanda/estoque; validação; simulação; persistência e reabertura |
| Otimização | Simples e avançado; pesos e restrições; sem candidato elegível; falha; conclusão; seleção de candidato; destino correto |
| Resultados | Custo, componentes, economia e unidades; nulo/zero; igualdade com gráfico e exportação; resultado desatualizado |
| Navegação | Voltar/avançar, links diretos, rota inválida, etapas sem dados, contexto preservado |
| Visual | 390/768/1366/1440 px; zoom 200%; texto longo; tabelas; gráfico sem dados; foco e teclado |
| Publicação | Artefato exato, fontes protegidas, deployment concluído, carga e fluxo principal em produção |

Chrome será usado quando conectado, além do Playwright MCP autorizado. Usar dados sintéticos nas capturas públicas. Evidência de teste deve registrar base/commit, empresa, cenário, ação, resultado esperado/obtido e captura ou relatório. Credenciais nunca entram em relatórios ou logs.

Ensaio: abrir sessão limpa, selecionar empresa, explicar rede e baseline, modificar um cenário, simular, comparar, otimizar, explicar a alternativa escolhida e exportar resumo. Executar também caminhos de erro e cancelamento. Reservar uma demonstração sintética validada para o caso de indisponibilidade do acesso aos dados reais.

Aceite: nenhum defeito bloqueador aberto no caminho da apresentação; todos os critérios definidos têm evidência. Empresa não acessada fica como não verificada, jamais aprovada por inferência.

### Etapa F — GitHub, Sites e conferência final

1. Revisar diff e testes na branch; registrar SHA, matriz e limitações verificadas.
2. Publicar código via GitHub com PR e descrição do comportamento final e validação. Anexar o PR ao chat. Não fazer merge automático apenas por existir PR.
3. Gerar pacote público mínimo por allowlist, preservando proteção dos dados e auditando arquivos, histórico e artefato. Reutilizar `.openai/hosting.json` e o mesmo projeto do Sites.
4. Usar o workflow da skill Sites hosting para fonte, verificações, build e pacote; salvar versão ligada ao SHA exato e publicar com a audiência existente.
5. Aguardar deployment terminal `succeeded`, conferir URL e versão e executar o fluxo principal na produção pelo navegador autorizado.
6. Registrar SHA GitHub, SHA da fonte Sites e sua relação, pois o repositório de hospedagem pode ter histórico diferente. Guardar a versão anterior como referência de rollback.

Aceite: a versão entregue no link é a mesma implementação homologada e os testes pós-publicação passaram. Build local, versão salva ou upload iniciado não bastam.

## 5. Trabalho com subagentes Luna

Usar subagentes Luna durante a execução, com tarefas específicas e revisão central. O usuário pediu Luna; escolher `gpt-6-luna` se disponível na ferramenta utilizada, ou declarar o modelo Luna suportado na sessão. Não afirmar que foram executados neste planejamento.

Com quatro slots, manter o coordenador e até três Luna simultâneos:

| Papel | Primeira rodada | Segunda rodada | Entrega |
|---|---|---|---|
| Luna 1 | Inventário funcional e diferenças de frontend | Jornada, estado e navegação | Matriz rastreável e alterações no escopo atribuído |
| Luna 2 | Texto, hierarquia e componentes visuais | Design, responsividade e gráficos | Referência visual e revisão por viewport |
| Luna 3 | Contratos, providers e seleção de métricas | Regressões e roteiro exploratório | Casos, falhas reproduzíveis e evidências |
| Coordenador | Escolher base e priorizar | Integrar, revisar, validar e publicar | Versão homologada e relatório final |

Evitar edição simultânea dos mesmos arquivos. `main.js`, shell, estado e seletores compartilhados devem ter responsável único por rodada. Só um agente controla a sessão Playwright MCP por vez; os outros investigam código e testes ou entregam roteiros para execução serial. O coordenador opera o checkout do Site e suas ferramentas de publicação.

## 6. Critério de conclusão e limites desta análise

“100%” significa **100% dos itens acordados rastreados e com critérios atendidos**, dentro do escopo e das bases testadas. Não significa garantia de ausência de qualquer bug ou de aprovação do professor.

Nesta análise foram reproduzidos o desvio para validação, os termos internos expostos, o estado demonstrativo de somente leitura, a discrepância de campos no ranking e a densidade do cabeçalho móvel. O fluxo completo do motor nas Empresas 1 e 2, cálculos fiscais, exportações e acessibilidade completa não foram homologados. As duas empresas exigem frase de acesso, que não foi fornecida nem solicitada para concluir este plano.

O texto anexado orienta o backlog, mas não é prova de que funcionalidades já estejam implementadas. O objetivo da execução é eliminar as lacunas verificáveis, preservar a capacidade do simulador e produzir uma apresentação clara, coerente e reproduzível.

## 7. Referências e limpeza editorial — refinamento solicitado pelo usuário

### Referências consultadas

- [anyLogistix Sandbox](https://www.anylogistix.com/resources/blog/anylogistix-sandbox-supply-chain-optimization-in-minutes/): captura oficial inspecionada pelo Playwright MCP. Mapa central, navegação lateral, tabelas e comandos curtos; a área de trabalho tem pouco texto corrido. Referência para a sensação de manipular uma rede e seus dados. Não copiar sua densidade de controles, badges comerciais ou detalhes avançados de modelagem.
- [anyLogistix — KPIs e visualizações](https://www.anylogistix.com/resources/blog/anylogistix-3-3-data-grouping-in-tables-kpi-metrics-and-advanced-visualization/): painel de métricas e comparação entre execuções, gráficos e tabelas configuráveis. A captura de tabela/dashboard foi inspecionada. Usar comparações compactas e dados em destaque.
- [anyLogistix — resultados da otimização](https://anylogistix.help/experiments/network-optimization-results.html): documentação de resultado com alternativas em cartões de métricas e seleção refletida no mapa. Conteúdo recuperado pela pesquisa; abertura direta da documentação encontrou bloqueio HTTP. Referência de organização, sem teste do aplicativo autenticado.
- [Cosmic Frog — Analytics](https://optilogic.com/resources/help-center/docs/getting-started-with-analytics): documentação oficial com dashboards de comparação, filtros, mapas e detalhes sob demanda. Referência documental complementar; nenhuma execução de modelo ou experiência autenticada foi testada.

Captura da interface publicada pelo fabricante, inspecionada nesta pesquisa:

![Referência de área de trabalho do anyLogistix](../.playwright-mcp/ref-anylogistix-sandbox.png)

### Direção escolhida

A referência é uma **área de trabalho logística compacta, construída sobre a interface atual**. A pessoa seleciona uma empresa, vê a rede, ajusta parâmetros e compara resultados. A tela deve parecer um instrumento de análise operável. Preservar as cores e os componentes do Visagio em todas as correções.

- Cabeçalho de uma linha no desktop: empresa, cenário e ação disponível.
- Navegação com rótulos curtos: Rede, Cenários, Otimização e Resultados. Seleção de empresa acessível no cabeçalho e no início da jornada. Dados e metodologia em acesso secundário.
- Rede: aproveitar mapa e topologia existentes; corrigir área útil, legendas e distribuição dos indicadores, sem uma caixa explicativa para cada número. Não criar um novo painel lateral sem necessidade demonstrada.
- Cenário: aproveitar o formulário existente, agrupar campos relacionados quando necessário e manter instruções somente nos campos que precisarem delas. Não mover o resultado para outra coluna apenas como mudança estética.
- Resultados: comparação com baseline, gráfico e tabela de alternativas. Selecionar uma alternativa atualiza o detalhe no mesmo contexto, sem levar o usuário para outra seção de auditoria.
- Preservar bordas, cantos, sombras e tipografia dos componentes atuais. Reduzir cartões redundantes e grandes vazios; corrigir títulos ou espaçamentos apenas quando prejudicam a leitura.
- Destacar a seleção, a diferença entre cenários e a ação disponível. Cor não deve servir apenas de decoração.

### O que apagar e o que preservar

| Conteúdo atual | Tratamento planejado |
|---|---|
| “O workspace começa pela recomendação e mantém os detalhes técnicos acessíveis por seção.” | Excluir; a hierarquia deve demonstrar isso |
| “Os campos alimentam o builder e o simulator existentes...” | Excluir; manter rótulos dos parâmetros |
| “Os cálculos continuam no engine do projeto.” | Excluir da interface de negócio |
| Bloco “Contrato preservado” | Excluir como seção; manter apenas limitações concretas junto ao resultado pertinente |
| “Por que este resultado merece atenção” com frases genéricas | Excluir; exibir diferenças calculadas e restrições efetivamente ativas |
| “Os gráficos preservam a leitura...” ou explicações sobre o provider | Excluir; usar título, unidade e legenda do gráfico |
| IDs, nomes de campos, MIME types e JSON | Remover das telas principais; manter em exportação e diagnóstico |
| Estado demonstrativo, ausência de dado ou resultado desatualizado | Preservar em texto curto e contextual |
| Erro de formulário | Mensagem específica junto ao campo, com ação corretiva |
| Premissa ou limitação que altera a leitura | Nota curta no resultado; explicação completa acessível em detalhes |

Regra editorial: cada texto visível deve nomear algo, orientar uma ação, apresentar um resultado ou explicar uma condição real. Texto que apenas comenta a interface ou reafirma qualidades do sistema deve ser excluído.

### Comportamento ágil

- Seletores, abas e expansores dão retorno visual imediato e preservam contexto; não reconstroem toda a jornada por uma ação local.
- Simulação e otimização apresentam estado de execução e conclusão. Operações longas não deixam um botão aparentemente inerte.
- Evitar animações decorativas e movimentos de cartões não interativos. Respeitar preferência por movimento reduzido.
- Validar junto ao campo; abrir resultado após concluir; preservar formulário ao voltar.
- Medir tempo e fluidez na implementação antes de prometer desempenho. Esta pesquisa não fez benchmark.

### Critérios adicionais de aceite

1. Eliminar todos os parágrafos genéricos sobre workspace, pipeline, provider, engine e contratos das telas principais.
2. Cada painel tem uma função distinta; nenhum existe apenas para acomodar explicação redundante.
3. A primeira tela útil mostra contexto, operação ou resultado e próxima ação; a área de trabalho não é empurrada para baixo por um cabeçalho grande.
4. O resumo de resultados pode ser lido sem visitar metodologia. Tipo de base, ausência de dado e limites relevantes continuam compreensíveis.
5. Revisão visual e editorial compara antes/depois nas mesmas resoluções e estados. Testar descoberta de ações e teclado após recolher controles.

Na divisão com Luna, a frente visual recebe explicitamente a tarefa de remover texto e painéis redundantes; não deve substituí-los por novos blocos de explicação, sugestões genéricas ou cartões decorativos.

## 8. Cobertura dos 18 itens do anexo e limites da execução

O segundo anexo repete os 18 pedidos técnicos. A tabela traduz cada pedido em uma alteração pontual e uma conferência. P1 é necessário antes da apresentação; P2 é acabamento e organização com comportamento funcional preservado. A seleção da fonte correta é o pré-requisito P0 de todos os itens.

| Item do anexo | Alteração sobre a base atual | Prioridade | Conferência de conclusão |
|---|---|---|---|
| 1. Fluxo sequencial | Ordenar páginas e próximas ações atuais | P1 | Jornada completa sem procurar próxima etapa |
| 2. Seleção/carregamento | Tornar entrada, empresa ativa e estado da carga inequívocos | P1 | Troca e cancelamento não deixam contexto incorreto |
| 3. Executivo + rede | Reunir resumo e malha na área já existente | P2 | Contexto e seleção preservados entre resumo e rede |
| 4. Construção no momento certo | Orientar configuração após carga válida | P1 | Sem execução com empresa ou baseline indisponíveis |
| 5. Simulação após configuração | Evidenciar Simular e comparação com baseline | P1 | Parâmetro alterado produz novo resultado do motor |
| 6. Otimização após simulação | Próxima ação clara; permitir otimizar baseline válido | P1 | Não exigir cenário manual sem necessidade do motor |
| 7. Destino da otimização | Abrir Resultados ao terminar | P1 | E2E verifica rota e candidato após execução |
| 8. Dados & confiança | Acesso secundário “Detalhes dos dados” | P2 | Detalhes encontrados por nome e acessíveis por teclado |
| 9. Confiança visual | Síntese dos indicadores existentes com rótulos claros | P1 | Qualidade, robustez e cobertura não confundidas |
| 10. Gráficos consolidados | Reunir os gráficos pertinentes na área de resultados | P2 | Mesmos cenário, unidade e período em todos |
| 11. Resumo final | Reorganizar a página de resultados atual | P1 | Melhor cenário, diferença e limite principal legíveis |
| 12. Texto e justificativas | Excluir parágrafos meta e caixas sem função | P2 | Todos os textos restantes têm finalidade concreta |
| 13. Dropdown de presets | Usar seletor existente e eliminar ações duplicadas | P2 | Uma seleção carrega os parâmetros corretos |
| 14. Nomes dos cenários | Nome de negócio na interface; ID nos detalhes | P2 | Nome consistente em seletor, ranking e exportação |
| 15. Visuais Empresa 1 | Corrigir apenas problemas identificados após acesso | P1 | Mapa, custos, gráfico e tabela conferidos com dados |
| 16. Visuais Empresa 2 | Mesmo roteiro, verificação independente | P1 | Sem inferir sucesso a partir da Empresa 1 |
| 17. Bugs visuais gerais | Corrigir corte, alinhamento, contraste e cabeçalho | P1 | Desktop, tablet, celular e zoom sem bloquear tarefas |
| 18. Funções ainda no antigo | Portar somente lacunas confirmadas na matriz | P1 | Cada função tem caminho e teste no frontend atual |

### Regras para os subagentes e a revisão

- Luna 1: erros de navegação, carga e sequência; responsável único pelos arquivos compartilhados atribuídos.
- Luna 2: limpeza de texto e ajustes visuais com todas as cores e componentes atuais preservados.
- Luna 3: paridade funcional, contratos, consistência dos resultados e regressões.
- Coordenador: integrar, revisar diferenças, executar navegação/testes e cuidar de GitHub e Sites. Uma sessão de navegador é controlada por um agente por vez.

Não apagar funcionalidades para reduzir informação. Não mudar equações, premissas ou regras fiscais como parte da limpeza; se uma falha de cálculo for comprovada, registrar a causa e a correção mínima com teste antes de incluí-la. Não inventar valores para completar gráficos.

### Entrega esperada

Mesma identidade visual, fluxo mais claro, menos texto e erros corrigidos. Entregar matriz dos 18 itens com evidências, comparação visual antes/depois, testes pertinentes, PR GitHub e versão do mesmo Site conferida em produção. Publicar somente após as conferências previstas. Itens não acessados permanecem explicitamente pendentes.
