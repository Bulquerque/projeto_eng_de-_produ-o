# Inventário exaustivo de botões, controles e funcionalidades

> **Inventário histórico em revisão:** as seções de Portal/fases descrevem a interface anterior. O runtime atual usa as rotas Network listadas neste inventário e nas páginas `fase-*`; confronte todos os controles com `tests/12_network_intelligence/` antes de usar esta lista como aceite atual.

## Objetivo, escopo e como ler este inventário

Este documento cataloga as ações e funcionalidades visíveis do simulador Visagio, incluindo o portal de fases e a interface Network Intelligence. A auditoria foi feita por leitura estática dos HTMLs, renderizadores, templates, bindings, roteadores, engines e testes do checkout. Controles gerados só depois de carregar dados ou resultados estão identificados como dinâmicos.

O inventário descreve o que o código conecta a cada controle, as condições em que a ação funciona, as alterações de estado e os testes relacionados. “Coberto” significa que existe teste correspondente no repositório; não significa que todos os estados foram clicados manualmente nesta rodada. Nenhum fluxo de navegador foi executado para produzir este inventário.

Os nomes são transcritos da interface sempre que existe rótulo textual; quando o controle é iconográfico, gerado ou identificado pelo seletor técnico, o seletor é indicado. Links de navegação, campos, itens de mapa, disclosures e indicadores de status estão separados de botões para não confundir affordances distintas.

## Visão do produto e sequência dos fluxos

O runtime atual é a **Network Intelligence**: [index.html](../../index.html) inicia a shell, que possui 18 rotas e reaproveita serviços/engines do projeto por meio de providers. As páginas `/fase-*` são fachadas para rotas atuais. O catálogo do portal de fases abaixo descreve um fluxo legado preservado como referência; seus controles não estão expostos como uma segunda interface ativa.

Fluxo típico no portal legado (referência histórica): entrar → escolher Empresa 1 ou Empresa 2 → inspecionar diagnóstico e baseline → construir/simular cenário → comparar e rodar mecanismo de avaliação → selecionar a decisão → recalcular análise final → revisar QA, release, evidências e baixar artefatos.

Fluxo típico em Network Intelligence: escolher empresa → construir e simular cenário → revisar resultado/comparação/risco → configurar busca e rodar avaliação de alternativas → selecionar ou executar a decisão → revisar dados, confiança e validação → exportar artefatos.

Empresa Falsa/demo é uma fixture de demonstração. Não representa uma empresa real. Empresas protegidas seguem o fluxo criptográfico do carregador e dos providers; a interface não deve apresentar fixture como dado real.

## Portal de fases: navegação, seletores e ações globais

| Elemento | Tipo e identificador | Ação observada | Estado e limite |
|---|---|---|---|
| Pular para o conteúdo | Link de salto, destino main | Move a navegação ao conteúdo principal. | Navegação nativa de âncora; não há atalho customizado identificado. |
| Marca V / voltar ao topo | Link, destino topo | Retorna ao início do documento. | Navegação por âncora. |
| 1. Diagnóstico & Baseline | Link/hash da rota diagnostico-baseline | Abre o pilar inicial. | SPA atualiza conteúdo e estado do menu. |
| 2. Cenários & Avaliação de alternativas | Link/hash simulacao-otimizacao | Abre a área das fases 3–4. | SPA; F3 e F4 compartilham o pilar. |
| 3. Decisão & Entrega | Link/hash homologacao-relatorio | Abre a fase 5. | SPA atualiza conteúdo e estado do menu. |
| Empresa 1 / Empresa 2 | Duas duplas de botões button[data-company], uma no shell e outra na área de dados | Atualiza o diagnóstico da fase 1 e inicia também o carregamento de baseline da fase 2. | Os controladores F1/F2 se inscrevem nos mesmos botões. Enquanto F2 carrega, os botões globais ficam desativados e tentativas concorrentes podem ser ignoradas. Fases 3–5 também se inscrevem nos mesmos elementos. |
| Abrir Empresa 1 / Abrir Empresa 2 | Botões de hero, seletores selectEmpresa1 e selectEmpresa2 | Desbloqueiam/carregam a empresa e definem o hash legado #dados; o roteador normaliza para diagnóstico e volta ao topo. | Empresa protegida pode abrir o formulário de senha; Empresa Falsa é demonstração. |
| Checar paths core agora | Botão #runLivePathCheck | Refaz requisições HTTP dos paths declarados, resolve o alias do arquivo protegido e atualiza status/log de disponibilidade. | Verifica resposta HTTP; não descriptografa nem valida conteúdo. Depende de HTTP/HTTPS; file:// não é runtime suportado. |
| Mostrar/ocultar abas | Botão #toggleSheetTable | Expande/recolhe a tabela de abas da planilha. | A tabela deriva do inventário CSV/manifesto disponível. |
| Reexecutar | Botão #rerunPhase1Checks | Executa sete checks: catálogo carregado; arquivos frontend declarados; conjuntos core mínimos por empresa; separação de IDs entre empresas no catálogo; paths faltantes no relatório; presença de scenario_blocks e scenario_totals; disponibilidade de localStorage para escrever/remover uma chave de prova. | Não recalcula score de qualidade, não verifica origem/descriptografia e não marca o checklist manual. |
| Limpar | Botão #clearManualChecklist | Remove o checklist manual da fase 1 salvo no localStorage. | Efeito local no navegador. |
| Reexecutar cenário/Monte Carlo | Botão #runMonteCarloScenario | Recalcula o Monte Carlo do cenário atual. | Sem resultado/cenário atual não roda. |
| Simular cenário | Botão #simulateScenario | Valida formulário; constrói o cenário, compara com baseline, executa validações/qualidade, explicação de mudanças e análise Monte Carlo. | Desativado antes de carregar empresa; entradas inválidas limpam/impedem resultados dependentes. |
| Salvar cenário | Botão #saveScenario | Persiste o cenário atual localmente e vinculado à empresa corrente. | Sem cenário atual, o handler encerra sem salvar. |
| Exportar cenário | Botão #exportScenario | Baixa o cenário atual como JSON. | Sem cenário atual, o handler encerra sem exportar. |
| Limpar salvos | Botão #clearSavedScenarios | Apaga todos os cenários salvos da empresa atual. | Sem confirmação identificada no binding estático. Efeito destrutivo limitado ao armazenamento local de cenários da empresa selecionada. |
| Rodar busca discreta | Botão #runOptimizer | Valida objetivo/restrições e executa a busca do mecanismo de avaliação. | Alerta quando inválido; desabilita durante execução; resultado inclui ranking, explicações e trade-offs. |
| Reexecutar análise final | Botão #rerunPhase5 | Reexecuta o pipeline final da fase 5. | Requer contexto de empresa/dados. |

### Roteamento e aliases do portal

As rotas canônicas do portal são diagnostico-baseline, simulacao-otimizacao e homologacao-relatorio. O roteador também mantém aliases legados: #fase-1-validacao, #fase-2-validacao, #dados, #qualidade, #abas, #visao-geral, #baseline, #/validacao, #/baseline, #/arena, #arena4, #/simulacao, #/otimizacao, #/entrega, #/debug e #erros. Fase 1 e fase 2 têm URLs auxiliares que redirecionam para o portal; não são aplicações independentes.

Implementação atual: [roteador Network](../../assets/js/app/router.js) e [bindings](../../assets/js/app/bindings.js). O primeiro link registrava roteamento do portal antigo.

## Portal: desbloqueio de dados protegidos

| Controle | Tipo | Comportamento |
|---|---|---|
| Senha | Input password obrigatório, #cryptoPasswordInput | Recebe a senha de desbloqueio; o valor não pertence ao inventário e não deve ser copiado para logs, evidências ou documentação. |
| Desbloquear simulador | Submit de #cryptoPasswordPrompt | Tenta desbloquear/carregar o conjunto protegido. |
| Cancelar | Botão #cryptoCancel | Cancela o prompt de senha. |
| Voltar à Empresa Falsa | Botão dinâmico #cryptoReturnToDemo | Aparece no prompt de senha e retorna à fixture empresa_mock na rota de resumo do Network Intelligence. |
| Bloquear dados | Botão dinâmico #cryptoLockButton | Aparece após desbloqueio para encerrar o contexto descriptografado. |

Digitar Enter no formulário usa submissão HTML nativa; não foi encontrado atalho de teclado próprio para as fases. Referências: [sessão criptográfica](../../assets/js/core/crypto-session.js) e carregadores de dados/protected provider.

## Portal: fase 1 — diagnóstico e integridade

### Funcionalidades automáticas e visuais

- Cards de integridade e resumo do dataset da empresa.
- Cards mostram status de catálogo, arquivos frontend, datasets core, separação de IDs e paths conforme os relatórios carregados.
- O botão de reexecução refaz sete verificações limitadas: catálogo/frontend/datasets core, IDs de tenant, paths no relatório, blocos/totais de cenário e capacidade de escrita/remoção no localStorage. Não recalcula qualidade, não valida origem e não descriptografa arquivos protegidos.
- A checagem ao vivo de paths verifica disponibilidade HTTP e resolve o alias do arquivo protegido; não abre nem inspeciona o conteúdo.
- Inventário das abas e metadados do workbook em tabela recolhível.
- Fontes, alertas e amostras de paths auditados em disclosures nativos.
- Roadmap/status de outras fases, com links de “Página” derivados de data/validation/phase_tests.json.
- Feed de diagnóstico compartilhado, avisos para runtime não suportado e mensagens de erro.
- Checklist de aceite manual persistido no navegador.

### Itens do checklist manual

Cada item é checkbox gerado como input[data-manual-check] e gravado como boolean no localStorage visagio_phase1_manual_checks. A persistência é compartilhada entre empresas, e não segregada por tenant.

| ID | Texto/critério |
|---|---|
| empresa1_dados | Cliquei em Empresa 1 e vi demanda, distância e premissas. |
| empresa2_dados | Cliquei em Empresa 2 e vi os datasets da planilha de malha. |
| sem_mistura_1 | Confirmei que Empresa 1 não mostra dados da Empresa 2. |
| sem_mistura_2 | Confirmei que Empresa 2 não mostra dados da Empresa 1. |
| paths_zero | Confirmei zero falhas nos paths declarados. |
| cenario_blocos | Conferi que Cenários da Empresa 2 aparece como bloco especial. |
| abas | Confirmei a lista/inventário de abas. |

### Disclosures e ações da fase 1

- **Ver tabela técnica dos datasets**: expande detalhes tabulares de datasets.
- **Fontes e alertas**: disclosure para informações de origem e ressalvas.
- **Amostra de paths auditados**: disclosure de evidência amostral.
- **Ver detalhes**: abre detalhe da linha de roadmap correspondente.
- **Página**: link gerado por cada entrada de roadmap, se houver destino.
- **Reexecutar**, **Checar paths core agora**, **Mostrar/ocultar abas** e **Limpar**: descritos na tabela de controles globais.
- O item paths_zero é uma declaração manual. O teste automático de armazenamento escreve e remove uma chave de prova, não testa leitura nem a persistência do checklist.

Testes relacionados: [auditoria de paths](../../tests/01_paths_auditoria/), [frontend da fase 1](../../tests/02_fase1_frontend/), E2E visual opcional [test_phase1_playwright.py](../../tests/04_e2e_visual_opcional/test_phase1_playwright.py).

## Portal: fase 2 — baseline e calibração

### Funcionalidades automáticas e dados apresentados

- Ao selecionar empresa, aparece #phase2Loading, o workspace é ocultado e os botões globais de empresa ficam desativados; chamadas concorrentes durante loading podem ser ignoradas.
- Após carregar, apresenta status, nome da empresa e cenário do baseline.
- Cinco cards de resumo: CDs ativos, Origens, Destinos, Fluxos e Reconciliação; um bloco mostra Metodologia do baseline, modo e status.
- Seis cards de custo: Transferência, Distribuição, Armazenagem, Estoque, Tributário e Total com tributo; breakdown mostra fontes/valores e marca itens sem disponibilidade.
- Sumário de fluxo, tabela com colunas Tipo, Origem, CD, Destino, Receita, Volume/Peso e Fonte, limitada a 16 linhas; gráficos de decomposição de custo, volume por CD e histograma de distâncias.
- Painel tributário com Impacto tributário, Classificação fiscal completa, Fluxos elegíveis, Fonte canônica, escopo/limitações e resumo de fontes.
- Painel de calibração/Base Fit; painel de evidência operacional com até 20 itens quando existe evidência; mensagem “Sem evidência auxiliar para esta empresa nesta fase” quando não existe.
- Checks calculados automaticamente: baseline pronto, empresa correta, fluxos gerados, custos não negativos, fechamento de totais logísticos e com tributo, Base Fit válido e critérios específicos de benchmark. Para Empresa 2, incluem fonte canônica e reconciliação tributária explícita.
- Avisos agregam alertas de baseline, custos, tributos, Base Fit, reconciliação e referências; sem alerta crítico aparece estado positivo.
- Se o carregamento falhar, esconde o loading, reexibe workspace, apresenta erro em #warningPanel e registra a falha.

### Controles realmente acessíveis na tela atual

- A seleção de Empresa 1/2 usa os botões globais button[data-company] e selectEmpresa1/selectEmpresa2.
- A tela permite inspecionar os resultados e navegações/âncoras disponíveis.
- O binding contempla referências opcionais a #rerunBaselineChecks, #phase2ManualChecklist, #clearPhase2ManualChecklist e #phase2ManualProgress, mas esses elementos não aparecem no markup atual. Portanto **Reexecutar checks de baseline**, o checklist manual da fase 2 e seu botão **Limpar** não são controles utilizáveis na tela auditada.
- Não foi localizado controle editável de calibração/reconciliação na marcação atual; o conteúdo de fase 2 é predominantemente leitura/apresentação e processamento automático.
- Os checks de baseline são calculados/apresentados automaticamente quando a empresa é carregada; não há botão utilizável para reexecutar checks.
- As páginas auxiliares da fase 1/2 levam ao portal. A página da fase 2 fornece “Abrir diagnóstico” dentro de noscript se JavaScript estiver desativado; a página da fase 1 tem link explícito de fallback.

Ao selecionar uma empresa, os módulos carregados automaticamente constroem o baseline e agregados dependentes. URLs auxiliares de F2 redirecionam ao SPA. Testes: [fase 2 baseline](../../tests/05_fase2_baseline/).

## Portal: fase 3 — biblioteca, simulação e risco

Implementação principal: [dashboard e bindings de fase 3](../../assets/js/phase3/scenario-arena-dashboard.js), [engine Monte Carlo](../../assets/js/phase3/monte-carlo-engine.js), [renderização da biblioteca](../../assets/js/phase3/scenario-arena/library-view.js).

### Campos e efeito das mudanças

| Campo | Tipo/valores | Efeito observado |
|---|---|---|
| Nome do cenário, #scenarioName | Texto | Nome usado nos metadados/salvamento/exportação. |
| CDs ativos, input[data-cd-check] | Checkboxes gerados por CD disponível | Define o conjunto operacional do cenário. |
| Multiplicador de frete, #freightMultiplier | Numérico | Ajusta o parâmetro de frete usado pelo builder. |
| Multiplicador de demanda, #demandMultiplier | Numérico | Ajusta a demanda simulada. |
| Dias de estoque, #inventoryDays | Numérico | Ajusta premissa de estoque. |
| WACC, #waccValue | Numérico | Atualiza premissa financeira do cenário. |
| Modo tributário, #taxMode | Opções canonical/current, disabled e anos da transição | Atualiza premissas/aviso; aplicação ao cenário ocorre na próxima simulação. |
| Regra de realocação, #reallocationRule | CD ativo mais compatível, primeiro CD ativo, manter se ativo senão primeiro | Configura regra usada pelo builder; efeito aplicado ao simular. |
| Iterações Monte Carlo, #phase3MonteCarloIterations | Número, 50 a 5000, passo 50 | Com cenário e resultado existentes, mudança refaz o cálculo; antes disso apenas atualiza configuração para próxima execução. |
| Seed Monte Carlo, #phase3MonteCarloSeed | Campo numérico | Permite reprodução determinística quando valor é válido; recalcula com resultado atual e, antes da primeira simulação, atualiza apenas configuração. |
| Perfil Monte Carlo, #phase3MonteCarloProfile | balanced, conservative, broad | Escolhe perfil de incerteza; recalcula somente quando já há cenário e resultado. |
| Driver Monte Carlo, #phase3MonteCarloDriver | freight, demand, inventory, WACC ou tax | Escolhe variável mostrada/investigada; recalcula somente quando já há cenário e resultado. |

### Botões e ações

| Ação | Tipo e seletor | Resultado/condição |
|---|---|---|
| Simular cenário | #simulateScenario | Valida entradas, executa builder, baseline comparison, validação, qualidade, explicação de alteração e Monte Carlo. Desabilitado antes da empresa. Erros impedem atualização de resultados derivados. |
| Recalcular Monte Carlo | #runMonteCarloScenario | Reexecuta análise aleatória para cenário corrente; sem resultado corrente não faz cálculo. |
| Salvar cenário | #saveScenario | Armazena dados no localStorage separados por empresa. Antes de cenário atual, o botão permanece visível, mas o handler retorna sem mensagem nem efeito. |
| Exportar JSON | #exportScenario | Baixa representação do cenário corrente. Antes de cenário atual, o botão permanece visível, mas o handler retorna sem mensagem nem efeito. |
| Importar JSON | Input de arquivo #importScenarioFile, aberto pelo controle “Importar JSON” | Faz JSON.parse e confere company_id, scenario_id e base_scenario_id; erro de parsing/validação usa alert. Se validação passa, preenche formulário mesmo que o armazenamento local falhe; a falha de persistência é registrada em log. A validação não cobre o schema integral. |
| Carregar item da biblioteca | Botão dinâmico button[data-load-scenario] | Copia preset para os campos; não executa simulação automaticamente. |
| Carregar salvo | Botão dinâmico button[data-load-saved] | Recupera cenário salvo localmente da empresa atual e preenche a tela. |
| Excluir salvo | Botão dinâmico button[data-delete-saved] | Apaga o item salvo selecionado; confirmação não identificada. |
| Limpar salvos | #clearSavedScenarios | Limpa todos os salvos da empresa atual; confirmação não identificada. |

### Saídas e outros elementos

Baseline e parâmetros vigentes, alertas, comparação de cenário, custo e deltas, validação/qualidade, explicação textual, biblioteca de presets e estados vazios são conteúdo/saída, não botões. Monte Carlo apresenta resumo probabilístico e tabela, probabilidade de saving, histograma, curva percentílica de saving, curva de custo total, importância dos drivers e scatter. Esses painéis são visuais de leitura, sem controle de filtro próprio localizado. Clique em item da biblioteca e item salvo é tratado por delegação no body.

Testes: [suíte da fase 3](../../tests/06_fase3_cenarios/), incluindo lógica, estrutura, comparação da biblioteca e renderização/escape da nova view. O teste de view cobre markup dos cards e banner, checkboxes gerados, baseline/tabela e escape; não cobre clique delegado, mudança de checkbox, persistência ou fluxos de import/export no navegador.

## Portal: fase 4 — score e mecanismo de avaliação

Implementação: [dashboard de fase 4](../../assets/js/phase4/phase4-dashboard.js) e motores/templates sob assets/js/phase4/.

### Objetivo e perfis

- Cartões [data-profile] carregam nome e pesos de perfil para o objetivo; selecionar cartão **não** executa busca.
- #objectiveName: nome do objetivo.
- #weight_total_cost: peso do custo total.
- #weight_service_quality: peso da qualidade do serviço.
- #weight_operational_risk: peso do risco operacional.
- #weight_tax_impact: peso do impacto tributário.
- #weight_inventory_efficiency: peso da eficiência de estoque.
- Alterações de nome/peso recalculam objetivo/preview apresentado sem executar busca.

### Restrições e opções

| Campo | Comportamento |
|---|---|
| #minActiveCds | Limite inferior de CDs ativos. |
| #maxActiveCds | Limite superior de CDs ativos. |
| #maxCdShare | Limite máximo de concentração/share por CD. |
| #maxRiskLevel | Limite máximo de risco permitido. |
| #optimizationTaxMode | Campo tributário desativado na interface. |
| #allowTaxDisabled | Campo tributário desativado na interface. |
| #optimizerMethod | Método com opção exact_discrete; não há edição útil/handler de troca identificado além dessa opção. |
| #maxCandidates | Limite de candidatos a avaliar, exibido como configuração/estimativa. |
| #optimizerSeed | Semente de busca para reprodução. |

### Ação principal e resultados

- **Rodar busca discreta**, #runOptimizer: valida objetivo/restrições; exibe alerta quando os parâmetros não são válidos; inicia busca assíncrona, impede submissão concorrente enquanto roda, salva configuração associada à empresa.
- Resultados: baseline/insumos usados, log da estratégia e método solicitado/aplicado, espaço e razão de busca exata, candidatos gerados/simulados/válidos/inválidos, cobertura/qualidade fiscal, casos com cobertura limitada, refino, melhor score/cenário/custo, ranking Top 8, gráfico, explicações por critério e fronteira de trade-offs. A fase 4 não apresenta painel de sensibilidade.
- Antes da busca há estado vazio; bloqueios podem impedir ranking/fronteira. Se trocar empresa falha depois que havia resultado, o catch pode atualizar o aviso de loading e registrar o erro sem limpar todos os painéis anteriores; essa combinação pode mostrar resultados antigos com rótulo de nova empresa.
- Não há botão de exportação de ranking identificado neste módulo do portal.

Testes: [suíte da fase 4](../../tests/07_fase4_score_otimizador/), com contratos de objetivo, scoring, restrições, busca e estrutura; a cobertura visual de todo o formulário e de cada perfil é menor do que a cobertura de engine.

## Portal: fase 5 — decisão final e entrega

Implementação: [dashboard de fase 5](../../assets/js/phase5/phase5-dashboard.js), [view do dashboard](../../assets/js/phase5/phase5-dashboard-view.js), engines sob assets/js/phase5/.

### Configurações interativas

| Campo | Opções/efeito |
|---|---|
| #phase5SelectionMode | max score, min cost, robustness-quality ou manual ID; escolha inicia/atualiza seleção e o pipeline. |
| #phase5ManualScenarioId | Identificador de cenário final quando a seleção manual está ativa; change dispara o pipeline. |
| #phase5StressProfile | Perfil da análise de stress final; change dispara o pipeline. |
| #phase5SensitivityVariable | Variável sob análise de sensibilidade; change dispara o pipeline. |
| #phase5SensitivityX | Eixo X da matriz de sensibilidade; change dispara o pipeline. |
| #phase5SensitivityY | Eixo Y da matriz de sensibilidade; change dispara o pipeline. |
| #phase5MaxCandidates | Limite herdado da fase 4 ou da configuração canônica, limitado a 100–10000; change dispara o pipeline. |

### Pipeline e ações

- Trocar empresa prepara contexto, herda objetivo da fase 4 e inicia automaticamente avaliação de alternativas final, seleção, risco com parâmetros predefinidos, stress, sensibilidade, matriz, robustez, recomendação, audit trail, Final QA/release e exportação.
- Ao ocorrer evento change em modo, ID manual, stress, variável/eixos de sensibilidade ou limite de candidatos, o controlador reexecuta o pipeline e atualiza a view; digitação sem change ainda não dispara. A troca para modo manual também mostra o campo de ID.
- A nota de configuração mostra objetivo/seed herdados e limite de enumeração; sem configuração da fase 4, usa política canônica e mostra a observação correspondente.
- **Reexecutar análise final**, #rerunPhase5, roda o pipeline novamente com a configuração atual.
- A seleção manual depende de ID existente; ID inválido/desconhecido deve produzir estado/alerta de ausência e não uma decisão válida.
- Cartões, gráficos, resumo, períodos e evidências tributárias, comparação/paridade e recomendação são resultados de leitura. Se matriz não puder ser renderizada, a view informa “Matriz não exibida”.
- Se o pipeline fica bloqueado e o pacote tem zero arquivos, a central de exportação fica vazia; a view não apresenta mensagem própria de estado vazio.
- Em falha ao trocar de empresa, o ID/rótulo solicitado pode ser atualizado antes de carregar; como o catch não invalida todos os painéis, resultados anteriores podem permanecer associados visualmente ao novo rótulo. Não há teste específico de aceitação desse erro.

### Central dinâmica de artefatos

Os botões button[data-export-index] são gerados a partir do pacote de exportação. Cada botão baixa um artefato pelo índice da lista atual; o conjunto esperado inclui pacote JSON de decisão, CSV de stress, CSV de sensibilidade e relatório executivo HTML. Quando não há arquivos, não aparecem botões nem estado vazio dedicado. A existência e o tipo dependem do pipeline; confirmar o rótulo e o download de **cada item** no navegador é necessário para verificar a rodada real.

Testes: [suíte da fase 5](../../tests/08_fase5_entrega_final/), incluindo seleção, períodos tributários/evidências, recomendação, stress, audit trail, export e QA; E2E de apresentação em [test_presentation_flow_playwright.py](../../tests/10_presentation_e2e/test_presentation_flow_playwright.py). O teste da view nova verifica markup/escape, painéis e atualização visual de abas; não dispara listeners de alteração, carregamento de empresa, seleção manual ou download real.

## Network Intelligence: rotas e features

Roteamento canônico é definido em [assets/js/app/router.js](../../assets/js/app/router.js); shell e renderização são organizados por [bindings](../../assets/js/app/bindings.js), [shell](../../assets/js/app/shell.js) e route-renderers. Todas as rotas são páginas da SPA.

| Rota | Conteúdo/features | Navegação e ações específicas |
|---|---|---|
| #/network/overview/summary | KPIs de saving, robustez, Evidence e risco; recomendação, empresa/cenário ativo e alertas de interpretação. | Subnav Resumo/Malha/Custos/Tributário; **Abrir cenário**, **Executar análise**, **Construir cenário**, **Avaliar alternativas** levam ao fluxo de construção e classificação de cenários. |
| #/network/overview/network | Síntese topológica, mapa do Brasil, volume por CD e distribuição de distância. | Subnav Overview; cada UF no SVG é item interativo e abre drawer de informação. |
| #/network/overview/costs | Decomposição dos custos do baseline, logística, tributos e total. | Subnav Overview; página de leitura, sem formulário. |
| #/network/overview/tax | Regime/modo tributário, cobertura, período, referência e transição; ausências permanecem explícitas. | Subnav Overview; página de leitura, sem formulário. |
| #/network/scenarios/build | Formulário de cenário, prévia, biblioteca, rascunhos e salvos. | **Simular cenário**, **Repor baseline**, **Salvar atual**, **Exportar JSON**, **Importar JSON**, botões de **Carregar**, **Excluir** e **Limpar salvos**. |
| #/network/scenarios/result | KPIs/custos/qualidade/Evidence/blockers do cenário; vazio antes da simulação. | **Comparar**; **Abrir risco** ou **Calcular risco**, conforme resultado. |
| #/network/scenarios/compare | Compara cenários existentes, baseline, savings, total e status. | Botões dinâmicos **Selecionar** por cenário; não há classificação/filtro identificado e baseline não é escolha manual. |
| #/network/scenarios/risk | Monte Carlo, distribuição, chance de saving, percentis, stress, drivers e sensibilidade. | **Recalcular risco**, **Abrir risco avançado**, formulário detalhado descrito abaixo. |
| #/network/scenarios/risk/advanced | Vista avançada do mesmo conjunto de risco/sensibilidade. | Mesmos controles do risco; **Recalcular risco**, **Voltar ao risco resumido**. |
| #/network/optimizer/configure | Configuração de perfis, limites, seed, risco, stress e sensibilidade; baseline usado. | Formulário de mecanismo de avaliação e **Rodar busca**. |
| #/network/optimizer/results | Status, cobertura, escopo exato, candidatos, gráfico e ranking. | Seletor/campo de decisão manual; **Executar decisão deste cenário**, **Ver trade-offs**, **Executar decisão final**. |
| #/network/optimizer/tradeoffs | Trade-offs entre candidatos dentro do ranking/escopo calculado. | Subnav Mecanismo de avaliação. Não equivale à fronteira Pareto completa do portal de fases. |
| #/network/trust/overview | Evidence, robustez, QA, release, recomendação e limitações como dimensões separadas. | Subnav Evidence/Fontes/Validação/Metodologia. |
| #/network/trust/evidence | Score/status, componentes e blockers do relatório; estado vazio sem resultado. | Subnav de confiança; leitura. |
| #/network/trust/sources | Lineage e fontes consumidas, sem apresentar paths protegidos como arquivos públicos. | Subnav de confiança; leitura. |
| #/network/trust/validation | Final QA, release, audit trail e central de exportação. | Um **Baixar** por artefato disponível; botão **Exportar** global no shell. |
| #/network/trust/methodology | Interpretação dos engines, incerteza, Evidence, dados ausentes e dependência de release. | Subnav; disclosure nativo **Snapshot técnico** abre/fecha detalhe. |
| #/network/dev/console | Console condicional de desenvolvimento, erros e eventos sanitizados. | Link **Debug** e botão **Dev** quando modo debug está ligado; navegação para rota e query tab=errors filtra erros. |

## Network Intelligence: shell global e controles

| Controle | Tipo e seletor/ação | Comportamento/limite |
|---|---|---|
| Pular para o conteúdo | button[data-action=skip-to-content] | Move foco para #networkPage. |
| Visão executiva | Link data-route para Overview | Navega na SPA; subrotas mantêm seção pai ativa. |
| Cenários | Link data-route | Abre grupo de telas de cenário. |
| Mecanismo de avaliação | Link data-route | Abre configuração/resultados/trade-offs. |
| Dados & confiança | Link data-route | Abre overview/evidence/sources/validation/methodology. |
| Debug / Dev | Links/botões condicionais | Só aparecem com configuração de debug habilitada. |
| Empresa, #niCompanySelect | Select/change | Troca provider, limpa dados/contexto específico da empresa anterior e atualiza query/URL. Empresa protegida mantém bloqueio criptográfico. |
| Cenário, #niScenarioSelect | Select/change | Escolhe baseline ou cenário, persiste seleção, navega para resultado e roda o cenário; pode ficar desabilitado durante loading. |
| Evidence/runtime/empresa | Indicadores topbar | Status informativo, não são controles acionáveis. |
| Exportar | button[data-action=open-export] | Baixa o primeiro arquivo do pacote disponível. A central de validação tem botões separados para artefatos. |
| Ajuda | Ação que abre drawer | Drawer informativo; não é formulário de suporte. |
| Configurações | Ação que abre drawer | Drawer informativo; não foi encontrado formulário de preferências. |
| Style guide | Ação que abre drawer | Apresenta referências visuais; não edita tema. |
| Fechar drawer | Botão × | Fecha drawer e devolve foco conforme o binding. |
| Backdrop | Área clicável do overlay | Fecha drawer. |
| Escape | Tecla quando drawer está aberto | Fecha drawer; Tab fica preso no drawer enquanto ele está ativo. |

## Network Intelligence: formulários e controles dinâmicos

### Cenários — construção

| Campo/ação | Tipo/detalhe | Efeito e condição |
|---|---|---|
| scenario_name | Campo de texto do formulário #niScenarioForm | Nome do draft/cenário. |
| active_cds | Checkboxes gerados por CD | Define CDs ativos para o cenário. |
| freight_multiplier | Campo numérico | Premissa do frete. |
| demand_multiplier | Campo numérico | Premissa da demanda. |
| inventory_days | Campo numérico | Premissa de estoque. |
| wacc | Campo numérico | Premissa financeira. |
| tax_mode | Campo/select | Current ou disabled. |
| Simular cenário | button[data-testid=scenario-run], submit do formulário | Valida e chama provider/engine; toast em erro; provider demo-only pode bloquear edição e explica que é fixture. |
| Repor baseline | data-action=reset-scenario-draft | Restaura draft ao baseline/contexto da empresa. |
| Salvar atual | data-action=save-current-scenario | Persiste cenário atual. |
| Exportar JSON | data-action=export-current-scenario | Exporta o cenário atual. |
| Importar JSON | Arquivo #networkScenarioImport, data-testid=scenario-import | Ao selecionar arquivo, lê/valida e popula/importa. |
| Carregar cenário | data-action=load-scenario com data-scenario-id | Carrega preset/biblioteca ou item salvo identificado pelo ID. |
| Excluir cenário | Ação gerada com data-scenario-id | Remove o salvo identificado; confirmação não localizada. |
| Limpar salvos | Ação clear-saved-scenarios | Remove salvos da empresa corrente; confirmação não localizada. |

Validação de formulário ocorre no submit. Mudanças nos campos atualizam draft. Importação valida contrato/empresa antes de usar dados; cobrir JSON malformado, tenant incorreto e valores limite em teste/browser continua importante.

### Risco e sensibilidade

Formulário #niRiskForm:

- Iterações: 50–5000.
- Seed: valor para reprodução.
- Perfil: balanced, conservative ou broad.
- Driver de dispersão: freight, demand, inventory, WACC ou tax.
- Perfil de stress.
- Variável de sensibilidade.
- Eixo X e eixo Y da matriz.
- **Recalcular risco**: submete/valida parâmetros, chama Monte Carlo, stress, sensibilidade, matriz e robustez conforme provider.
- **Abrir risco avançado** e **Voltar ao risco resumido** navegam entre as duas rotas.

### Comparação de cenários

Resultado é gerado para cenários elegíveis; cada item dinâmico data-action=select-compared-scenario seleciona o cenário para comparação. Comparador informa baseline, saving, total e status. Não foram localizados botões de ordenação, filtros ou seleção do baseline na tela.

### Mecanismo de avaliação

Formulário #niOptimizerForm:

- Perfil: balanced, CFO, supply, fiscal ou conservative.
- Máximo de candidatos e seed.
- CDs mínimos/máximos, participação máxima por CD e risco máximo.
- Iterações de Monte Carlo, seed, perfil e driver.
- Perfil de stress, variável de sensibilidade e eixos X/Y.
- **Rodar busca**: valida e encaminha opções, limites e parâmetros de risco ao pipeline de decisão.

Resultados:

- Seletor #niManualScenarioSelect e campo #niManualScenarioId para escolha manual.
- **Executar decisão deste cenário** usa primeiro ID digitado e, se ausente, o item escolhido no seletor.
- **Ver trade-offs** navega para a respectiva página.
- **Executar decisão final** navega para validação; por si só não executa novamente o pipeline.

### Validação, exports e disclosures

- Em #/network/trust/validation são apresentados QA, release, audit trail e artefatos.
- Cada botão **Baixar** corresponde a um arquivo disponível e dispara download individual.
- **Exportar** global no shell baixa apenas o primeiro arquivo presente.
- Metodologia tem disclosure nativo **Snapshot técnico**.
- Overview, Evidence e Sources são páginas predominantemente de leitura.

### Mapa de rede

Cada SVG path[data-uf] possui tabindex e aria-label e abre drawer ao clique. Não foi localizado binding de Enter/Space para ativar a UF focada; precisa de validação/correção de acessibilidade. Gráficos e métricas são conteúdo visual, não botões.

### Debug Center

Condicional à configuração de debug. Rota #/network/dev/console e alias #erros com query tab=errors. O conteúdo inclui eventos/erros sanitizados; não há controle de log identificado na marcação atual além da navegação/filtragem por query. Se a configuração não permite debug, a rota pode exibir fallback de indisponibilidade.

## Portal e Network: matriz de funcionalidades, módulos e testes

| Feature | Módulos principais | Testes existentes |
|---|---|---|
| Catálogo, paths, isolamento e checklist | phase1/main.js, core/data-loader.js | tests/01_paths_auditoria/, tests/02_fase1_frontend/, E2E opcional phase 1 |
| Baseline, custo, imposto, reconciliação/calibração | phase2/main.js e services compartilhados | tests/05_fase2_baseline/, contratos de qualidade |
| Cenário, comparação, import/export e Monte Carlo | phase3/scenario-arena-dashboard.js, phase3 engines, library-view.js | tests/06_fase3_cenarios/, Network E2E |
| Perfil, scoring, busca exata e trade-offs | phase4/phase4-dashboard.js e engines | tests/07_fase4_score_otimizador/, contratos Network |
| Seleção final, stress/sensibilidade, QA/release e artefatos | phase5/phase5-dashboard.js e engines, phase5-dashboard-view.js | tests/08_fase5_entrega_final/, apresentação E2E, Network E2E |
| Shell, rotas, drawer e providers Network | app/router.js, app/shell.js, app/bindings.js, route-renderers | tests/12_network_intelligence/test_app_contracts.py e test_network_ui_playwright.py |
| Console e erro estruturado | debug/main.js e core/debug | tests/09_quality_checks/test_debug_system.py |

## Lacunas observadas para a próxima rodada de QA

Estas são áreas com baixa ou incompleta cobertura visível nos testes lidos; não são afirmações de que a função falha:

1. **Fase 1**: persistência e limpeza do checklist; aliases e navegação por hash; mensagens de erro/loading; expansão de disclosures; estado do inventário; troca de empresas com listeners compartilhados.
2. **Fase 2**: controles referenciados pelo JavaScript mas ausentes do HTML (#rerunBaselineChecks e checklist manual); E2E visual limitado e controle de calibração editável não localizado.
3. **Criptografia**: senha inválida, cancelamento, retorno à demo, lock após desbloqueio e descarte de contexto devem ser exercitados sem registrar senha. O fluxo protegido só é comprovado com credencial válida autorizada; teste skip não é prova de acesso.
4. **Fase 3**: salvar/carregar/excluir/limpar em múltiplas empresas; import válido/inválido/tenant incorreto; download JSON; gatilhos sem cenário; edição de cada campo e recálculo MC.
5. **Fase 4**: cada cartão de perfil e edição de peso/restrição; parâmetros inválidos e limites; bloqueio durante busca; status de resultado e trade-offs visuais.
6. **Fase 5**: ID manual válido/desconhecido, mudança de seleção, pipeline/reexecução, conteúdo e download de todos os arquivos dinâmicos; renderização nova não equivale a teste de download.
7. **Network shell**: drawer por ajuda/configurações/style guide, fechamento por backdrop/Escape, restauração de foco e trapping por Tab.
8. **Mapa**: Enter/Space nos elementos de UF; tabindex/aria-label existem, binding de teclado não foi achado.
9. **Network forms**: testar individualmente valores de cada campo de risco e mecanismo de avaliação, stress avançado, seleção/ID manual, remoção de um item e export de itens além do primeiro.
10. **Rotas de confiança**: verificação visual específica de Evidências, Fontes, Metodologia, Trade-offs, Custos e Tributário é menor que a cobertura de contratos/engines.
11. **Network locking**: há binding para data-action=lock-crypto, mas nenhum botão com esse atributo foi localizado no shell; o botão dinâmico do carregador criptográfico é um controle separado.
12. **Tela de custos**: existe possível desencontro estático entre o ID do chart referenciado pelo renderizador e a marcação da rota; verificar no runtime antes de registrar como defeito.
13. **Importação**: conferir rejeição de esquema incompleto, dados de outro tenant e tamanho/formato extremo em ambos os runtimes.

## Checklist de exploração manual completa

1. No portal, testar links de pular conteúdo/topo, os três pilares, todos os aliases e cada seletor Empresa 1/2; observar foco, hash, loading e estado após retorno.
2. Percorrer cada disclosure e os sete checks manuais da fase 1; marcar, recarregar e limpar para confirmar persistência. Repetir troca entre empresas e verificar isolamento.
3. Na fase 2, confirmar que os quatro elementos marcados como ausentes continuam ausentes ou registrar a decisão de produto para expô-los.
4. Exercitar senha incorreta/cancelar/retornar à demo e bloquear após desbloqueio em ambiente autorizado; jamais capturar a senha em screenshot ou log.
5. Fase 3: editar todos os parâmetros, simular, recalcular MC, salvar, carregar, excluir, limpar, importar JSON válido/inválido e exportar. Conferir tenant atual e ausência de efeitos antes de ter resultado.
6. Fase 4: selecionar cada perfil, alterar individualmente todos pesos/limites, executar com entradas válidas e inválidas, verificar ranking e seleção de limites/seed.
7. Fase 5: testar cada modo de seleção, ID válido/inválido, stress/sensibilidade/eixos, reexecução e botão de download de cada artefato.
8. Em Network, navegar todas as 18 rotas e os submenus; alternar empresa/cenário, revisar estados vazios e carregando, testar os drawers com mouse e teclado.
9. Simular e comparar; testar remoção individual e limpeza de salvos; verificar import/export por tenant; variar todos os campos de risco e de avaliação de alternativas, executar decisão manual e abrir trade-offs.
10. Em Trust/Validation, abrir cada seção, conferir fontes sem paths protegidos e baixar todos os itens, incluindo uma segunda exportação global quando houver mais de um arquivo.
11. No console do navegador, observar erros e rede durante as jornadas; classificar fixture/demo separadamente de empresa protegida e de dado ausente.
12. Registrar resultado por controle: **passou**, **falhou**, **não aplicável**, **bloqueado por dado/credencial**, com rota, estado inicial, passo, resultado observado e evidência sem segredo.

## Referências de implementação e testes

- Portal (snapshot histórico): [index.html](../../index.html); runtime atual: [roteador Network](../../assets/js/app/router.js) e [bindings](../../assets/js/app/bindings.js).
- Shell Network: [app shell](../../assets/js/app/shell.js), [app router](../../assets/js/app/router.js).
- Fases: [fase 1](../../assets/js/phase1/main.js), [fase 2](../../assets/js/phase2/main.js), [fase 3](../../assets/js/phase3/scenario-arena-dashboard.js), [fase 4](../../assets/js/phase4/phase4-dashboard.js), [fase 5](../../assets/js/phase5/phase5-dashboard.js).
- Suítes: [README dos testes](../../tests/README.md), [fase 1](../../tests/02_fase1_frontend/), [fase 2](../../tests/05_fase2_baseline/), [fase 3](../../tests/06_fase3_cenarios/), [fase 4](../../tests/07_fase4_score_otimizador/), [fase 5](../../tests/08_fase5_entrega_final/), [qualidade e debug](../../tests/09_quality_checks/), [Network Intelligence](../../tests/12_network_intelligence/).
