# Checklist completa de botões e funcionalidades

Use uma cópia deste arquivo por rodada de exploração. Marque os itens verificados e registre abaixo de cada grupo o resultado e a evidência. Os controles dinâmicos só existem depois que a condição indicada for atendida.

## Registro da rodada

- Data/hora:
- Responsável:
- Commit/versão:
- Runtime: [ ] Portal de fases [ ] Network Intelligence
- Navegador/versão:
- Viewport:
- Empresa/fixture: [ ] Empresa 1 [ ] Empresa 2 protegida [ ] Empresa Falsa/demo
- Cenário:
- Resultado geral: [ ] passou [ ] falhou [ ] parcial [ ] bloqueado [ ] não aplicável
- Evidências sem dados sensíveis:
- Observações:

### Como marcar

- [ ] **A testar** — estado inicial.
- Troque o marcador por [x] ao verificar. No campo Registro do grupo, anote **passou/falhou/parcial/bloqueado/não aplicável**, o resultado observado e o caminho da evidência.
- Se uma opção estiver ausente, desabilitada, não renderizada ou exigir um estado prévio, registre isso; não marque como aprovada só porque o teste foi ignorado.
- Não registre senhas, tokens, dados protegidos ou conteúdo privado em screenshots, logs ou evidências.

## 1. Portal de fases — entrada e navegação global

- [ ] Abrir index.html por HTTP/HTTPS e confirmar o portal inicial.
- [ ] Confirmar que file:// apresenta o aviso/limite de runtime.
- [ ] Usar **Pular para o conteúdo**.
- [ ] Usar a marca V / **Voltar ao topo**.
- [ ] Abrir **1. Diagnóstico & Baseline**.
- [ ] Abrir **2. Cenários & Avaliação de alternativas**.
- [ ] Abrir **3. Decisão & Entrega**.
- [ ] Confirmar o hash/rota e o pilar ativo depois de cada navegação.
- [ ] Abrir os aliases do portal: #fase-1-validacao, #fase-2-validacao, #dados, #qualidade, #abas, #visao-geral, #baseline, #/validacao, #/baseline, #/arena, #arena4, #/simulacao, #/otimizacao e #/entrega.
- [ ] Abrir a URL auxiliar da Fase 1 e confirmar redirecionamento/link de fallback.
- [ ] Abrir a URL auxiliar da Fase 2 e confirmar redirecionamento e link “Abrir diagnóstico” quando JavaScript estiver desativado.
- [ ] Acionar **Empresa 1** pelo primeiro grupo de botões.
- [ ] Acionar **Empresa 2** pelo primeiro grupo de botões.
- [ ] Acionar **Empresa 1** pelo grupo “Dados carregados por empresa”.
- [ ] Acionar **Empresa 2** pelo grupo “Dados carregados por empresa”.
- [ ] Confirmar estado de carregamento, botões temporariamente desabilitados, erro e retorno ao estado estável.
- [ ] Durante troca rápida de empresa, confirmar qual carregamento é aceito e que os painéis não misturam dados.
- [ ] Acionar **Abrir Empresa 1** no hero.
- [ ] Acionar **Abrir Empresa 2** no hero.
- [ ] Confirmar que esses atalhos levam ao topo do diagnóstico depois da normalização da âncora.

Registro do grupo:

- Resultado:
- Rota/empresa/estado inicial:
- Evidência:
- Falha ou observação:

## 2. Portal — desbloqueio e bloqueio criptográfico

- [ ] Solicitar acesso a uma empresa protegida em ambiente autorizado e confirmar o formulário #cryptoPasswordPrompt.
- [ ] Confirmar campo obrigatório #cryptoPasswordInput do tipo password.
- [ ] Submeter senha inválida e registrar feedback sem guardar a senha.
- [ ] Submeter senha válida autorizada e confirmar carregamento da empresa protegida.
- [ ] Usar Enter para submeter o formulário.
- [ ] Acionar **Cancelar** (#cryptoCancel) e confirmar fechamento/retorno esperado.
- [ ] Acionar **Voltar à Empresa Falsa** (#cryptoReturnToDemo) e confirmar retorno para empresa_mock no resumo de Network Intelligence.
- [ ] Após desbloqueio, acionar **Bloquear dados** (#cryptoLockButton), se exposto pelo carregador.
- [ ] Confirmar que o contexto protegido foi descartado e não continua visível após bloquear/trocar de empresa.
- [ ] Confirmar que nenhum segredo aparece em console, URL, toast, log, evidência ou documentação.

Registro do grupo:

- Resultado:
- Estado inicial/final:
- Evidência sem segredo:
- Falha ou observação:

## 3. Portal — fase 1: diagnóstico e checklist manual

### Ações e navegação

- [ ] Carregar Empresa 1 e verificar cards/status do diagnóstico.
- [ ] Carregar Empresa 2 e verificar os datasets da malha.
- [ ] Acionar **Checar paths core agora** (#runLivePathCheck).
- [ ] Confirmar que a checagem informa disponibilidade HTTP e não afirma descriptografia/conteúdo validado.
- [ ] Expandir/recolher **Mostrar/ocultar abas** (#toggleSheetTable).
- [ ] Conferir a tabela de abas/metadados do workbook.
- [ ] Acionar **Reexecutar** (#rerunPhase1Checks).
- [ ] Conferir os sete checks: catálogo, frontend declarado, conjuntos core mínimos, IDs separados por empresa, paths sem falta no relatório, scenario_blocks/scenario_totals e possibilidade de escrever/remover chave de prova no localStorage.
- [ ] Acionar **Limpar** (#clearManualChecklist) e confirmar remoção do checklist manual local.

### Itens manuais da fase 1

- [ ] empresa1_dados — conferir demanda, distância e premissas de Empresa 1.
- [ ] empresa2_dados — conferir datasets da planilha de malha de Empresa 2.
- [ ] sem_mistura_1 — verificar que Empresa 1 não mostra dados da Empresa 2.
- [ ] sem_mistura_2 — verificar que Empresa 2 não mostra dados da Empresa 1.
- [ ] paths_zero — registrar se o relatório de paths não tem falhas.
- [ ] cenario_blocos — conferir que “Cenários da Empresa 2” aparece como bloco especial.
- [ ] abas — conferir a lista/inventário de abas.
- [ ] Marcar todos os itens, recarregar a página e confirmar persistência.
- [ ] Trocar empresa e conferir o comportamento do checklist, lembrando que a chave é compartilhada e não segregada por empresa.

### Disclosures, roadmap e estados

- [ ] Abrir/fechar **Ver tabela técnica dos datasets**.
- [ ] Abrir/fechar **Fontes e alertas**.
- [ ] Abrir/fechar **Amostra de paths auditados**.
- [ ] Abrir **Ver detalhes** em cada item de roadmap aplicável.
- [ ] Seguir cada link **Página** disponível no roadmap.
- [ ] Conferir estado sem dados, erro de fetch, carregamento e aviso de runtime.
- [ ] Confirmar que um fetch HTTP bem-sucedido não é tratado como prova de descriptografia de arquivo protegido.

Registro do grupo:

- Resultado:
- Empresa/estado inicial:
- Evidência:
- Falha ou observação:

## 4. Portal — fase 2: baseline

- [ ] Carregar cada empresa e verificar loading #phase2Loading, ocultação do workspace e desativação temporária dos seletores.
- [ ] Confirmar resposta a uma seleção concorrente durante o loading.
- [ ] Confirmar status, empresa atual e scenario_id do baseline.
- [ ] Conferir os cards **CDs ativos**, **Origens**, **Destinos**, **Fluxos** e **Reconciliação**.
- [ ] Conferir o bloco **Metodologia do baseline**, modo e status.
- [ ] Conferir os seis cards de custo: **Transferência**, **Distribuição**, **Armazenagem**, **Estoque**, **Tributário**, **Total com tributo**.
- [ ] Conferir breakdown dos custos, fontes e marcação de indisponibilidade.
- [ ] Conferir sumário de fluxos e validação de cobertura.
- [ ] Conferir tabela de fluxos, colunas Tipo, Origem, CD, Destino, Receita, Volume/Peso e Fonte; verificar limite de 16 linhas.
- [ ] Conferir gráfico de decomposição de custo.
- [ ] Conferir gráfico de volume por CD.
- [ ] Conferir histograma de distâncias.
- [ ] Conferir painel tributário: impacto, classificação fiscal, fluxos elegíveis e fonte canônica.
- [ ] Conferir texto de escopo e limitações do cálculo tributário.
- [ ] Conferir resumo de fontes tributárias e política de fallback.
- [ ] Conferir painel de Base Fit/calibração.
- [ ] Conferir painel de evidência quando disponível.
- [ ] Conferir estado “Sem evidência auxiliar para esta empresa nesta fase”.
- [ ] Conferir avisos de baseline, custos, imposto, Base Fit, reconciliação e referências.
- [ ] Conferir estado positivo “Nenhum aviso crítico” quando aplicável.
- [ ] Conferir os checks automáticos de baseline: baseline pronto, empresa correta, fluxos, custos não negativos, fechamento logístico/com tributo, Base Fit e critérios de benchmark/empresa.
- [ ] Na Empresa 2, conferir fonte canônica e reconciliação tributária explícita.
- [ ] Simular falha de carregamento permitida pelo ambiente e confirmar mensagem em #warningPanel e log.
- [ ] Confirmar no HTML/runtime que #rerunBaselineChecks, #phase2ManualChecklist, #clearPhase2ManualChecklist e #phase2ManualProgress não são controles presentes/utilizáveis.
- [ ] Registrar que os checks são disparados pelo carregamento; não contar os bindings opcionais ausentes como botões testados.

Registro do grupo:

- Resultado:
- Empresa/estado inicial:
- Evidência:
- Falha ou observação:

## 5. Portal — fase 3: biblioteca e simulação

### Campos

- [ ] Editar **Nome do cenário** (#scenarioName).
- [ ] Marcar/desmarcar cada checkbox de CD ativo (input[data-cd-check]).
- [ ] Editar **Multiplicador de frete** (#freightMultiplier).
- [ ] Editar **Multiplicador de demanda** (#demandMultiplier).
- [ ] Editar **Dias de estoque** (#inventoryDays).
- [ ] Editar **WACC** (#waccValue).
- [ ] Selecionar cada modo tributário em #taxMode: canonical/current, disabled e anos da transição disponíveis.
- [ ] Confirmar que premissas/aviso tributário mudam e que o cálculo usa o modo na próxima simulação.
- [ ] Selecionar as regras de #reallocationRule: CD ativo mais compatível, primeiro CD ativo, manter se ativo senão primeiro.
- [ ] Configurar #phase3MonteCarloIterations (50–5000, passo 50).
- [ ] Configurar #phase3MonteCarloSeed, campo numérico.
- [ ] Selecionar #phase3MonteCarloProfile: balanced, conservative, broad.
- [ ] Selecionar #phase3MonteCarloDriver: freight, demand, inventory, WACC, tax.
- [ ] Antes de simular, mudar cada parâmetro Monte Carlo e confirmar que só a configuração é alterada.
- [ ] Depois de simular, mudar cada parâmetro Monte Carlo e confirmar recálculo do resultado atual.

### Botões e ações

- [ ] Selecionar empresa e conferir baseline/biblioteca/carregamento/erro.
- [ ] Acionar **Carregar** em cada item da biblioteca; confirmar preenchimento sem simulação automática.
- [ ] Acionar **Simular cenário** (#simulateScenario) com dados válidos.
- [ ] Acionar **Simular cenário** com valores inválidos e conferir mensagens e limpeza dos resultados derivados.
- [ ] Acionar **Recalcular Monte Carlo** (#runMonteCarloScenario) após haver resultado.
- [ ] Antes de haver resultado, acionar **Recalcular Monte Carlo** e registrar ausência de cálculo/estado vazio.
- [ ] Acionar **Salvar** (#saveScenario) após simular.
- [ ] Antes de simular, acionar **Salvar** e registrar que pode não fazer nada nem mostrar feedback.
- [ ] Acionar **Exportar JSON** (#exportScenario) após simular e conferir arquivo/conteúdo.
- [ ] Antes de simular, acionar **Exportar JSON** e registrar que pode não fazer nada nem mostrar feedback.
- [ ] Acionar **Importar JSON** (#importScenarioFile) com arquivo válido da mesma empresa.
- [ ] Importar JSON malformado e confirmar alert de parsing/validação.
- [ ] Importar objeto sem company_id, scenario_id ou base_scenario_id e confirmar rejeição.
- [ ] Importar cenário de outra empresa e conferir tratamento/isolamento.
- [ ] Forçar indisponibilidade de localStorage após import válido e distinguir log de falha de persistência da aceitação do formulário.
- [ ] Acionar **Carregar** em cada cenário salvo.
- [ ] Acionar **Excluir** para cada item salvo individualmente.
- [ ] Acionar **Limpar salvos** (#clearSavedScenarios) e conferir estado vazio da empresa atual.
- [ ] Confirmar armazenamento local separado por empresa.

### Saídas de leitura

- [ ] Conferir baseline e parâmetros vigentes.
- [ ] Conferir comparação contra baseline, custo e deltas por componente.
- [ ] Conferir validação/qualidade e alertas.
- [ ] Conferir explicação textual “O que mudou”.
- [ ] Conferir biblioteca, avisos e estados vazios.
- [ ] Conferir resumo/tabela probabilística de Monte Carlo.
- [ ] Conferir probabilidade de saving.
- [ ] Conferir histograma.
- [ ] Conferir curva percentílica de saving.
- [ ] Conferir curva do custo total.
- [ ] Conferir importância dos drivers.
- [ ] Conferir scatter.

Registro do grupo:

- Resultado:
- Empresa/cenário/estado inicial:
- Evidência/download:
- Falha ou observação:

## 6. Portal — fase 4: score e mecanismo de avaliação

### Objetivos e perfil

- [ ] Selecionar cada cartão data-profile e conferir nome/pesos preenchidos sem executar busca.
- [ ] Editar #objectiveName.
- [ ] Editar peso #weight_total_cost.
- [ ] Editar peso #weight_service_quality.
- [ ] Editar peso #weight_operational_risk.
- [ ] Editar peso #weight_tax_impact.
- [ ] Editar peso #weight_inventory_efficiency.
- [ ] Conferir preview e validação após cada alteração.

### Restrições e opções

- [ ] Editar #minActiveCds.
- [ ] Editar #maxActiveCds.
- [ ] Editar #maxCdShare.
- [ ] Selecionar cada valor válido de #maxRiskLevel.
- [ ] Confirmar que #optimizationTaxMode está desativado/fixo.
- [ ] Confirmar que #allowTaxDisabled está desativado/fixo.
- [ ] Confirmar que #optimizerMethod só oferece exact_discrete e que não troca método.
- [ ] Editar #maxCandidates (100–10000) e conferir resumo da configuração/estimativa.
- [ ] Editar #optimizerSeed.
- [ ] Confirmar que campos editáveis atualizam preview/tabela sem iniciar busca.

### Busca e resultados

- [ ] Acionar **Rodar busca discreta** (#runOptimizer) com entrada válida.
- [ ] Acionar busca com objetivo inválido e conferir alerta.
- [ ] Acionar busca com restrições inválidas e conferir alerta.
- [ ] Durante busca, confirmar botão desativado e evitar submissão duplicada.
- [ ] Conferir baseline e insumos usados.
- [ ] Conferir estratégia, método solicitado/aplicado, espaço de busca e razão de exatidão.
- [ ] Conferir candidatos gerados, simulados, válidos e inválidos.
- [ ] Conferir qualidade/cobertura fiscal e casos de cobertura limitada.
- [ ] Conferir refinamento, melhor score, cenário e custo.
- [ ] Conferir ranking Top 8 e gráfico.
- [ ] Conferir explicações por peso/critério.
- [ ] Conferir fronteira/tabela de trade-offs custo versus qualidade.
- [ ] Confirmar que não há painel de sensibilidade nesta fase do portal.
- [ ] Conferir estado vazio e bloqueio por qualidade de dados.
- [ ] Simular falha ao carregar uma nova empresa e verificar se painéis anteriores continuam visíveis sob novo rótulo; registrar como possível conteúdo obsoleto.

Registro do grupo:

- Resultado:
- Empresa/estado inicial:
- Evidência:
- Falha ou observação:

## 7. Portal — fase 5: decisão e entrega final

### Campos e seleção

- [ ] Selecionar #phase5SelectionMode: max score.
- [ ] Selecionar #phase5SelectionMode: min cost.
- [ ] Selecionar #phase5SelectionMode: robustness-quality.
- [ ] Selecionar #phase5SelectionMode: manual ID e confirmar exibição do campo.
- [ ] Informar ID manual existente em #phase5ManualScenarioId.
- [ ] Informar ID inexistente/vazio e registrar retorno/erro/estado de ausência.
- [ ] Selecionar perfis disponíveis em #phase5StressProfile.
- [ ] Selecionar variáveis disponíveis em #phase5SensitivityVariable.
- [ ] Selecionar variáveis de #phase5SensitivityX e #phase5SensitivityY.
- [ ] Editar #phase5MaxCandidates e conferir limite entre 100 e 10000.
- [ ] Conferir objetivo/seed herdados da fase 4 ou política canônica quando não existe configuração.
- [ ] Confirmar que evento change nos campos de seleção/risco reexecuta o pipeline; digitar sem change não deve ser tratado como atualização executada.

### Execução e resultados

- [ ] Trocar empresa e confirmar avaliação de alternativas, seleção final, risco, stress, sensibilidade/matriz, robustez, recomendação, audit trail, QA/release e montagem do pacote.
- [ ] Acionar **Reexecutar análise final** (#rerunPhase5).
- [ ] Conferir cards de cenário, custo total, saving, robustez, recomendação e release.
- [ ] Conferir paridade com workbook.
- [ ] Conferir períodos e evidências tributárias.
- [ ] Conferir saída de stress e sensibilidade.
- [ ] Conferir matriz de sensibilidade ou mensagem “Matriz não exibida”.
- [ ] Conferir recomendação, limitações e motivos de bloqueio.
- [ ] Conferir audit trail.
- [ ] Conferir Final QA e release, com dimensões/status separados.
- [ ] Forçar condição bloqueada e confirmar pacote de export vazio; registrar que não há mensagem própria de estado vazio quando não aparecem botões.
- [ ] Simular falha de troca de empresa e conferir se resultado anterior permanece sob rótulo atualizado.

### Downloads por artefato

- [ ] Baixar JSON de decisão, se gerado.
- [ ] Abrir/validar conteúdo e nome do JSON de decisão.
- [ ] Baixar CSV de stress, se gerado.
- [ ] Abrir/validar conteúdo e nome do CSV de stress.
- [ ] Baixar CSV de sensibilidade, se gerado.
- [ ] Abrir/validar conteúdo e nome do CSV de sensibilidade.
- [ ] Baixar relatório executivo HTML, se gerado.
- [ ] Abrir/validar HTML executivo e nome do arquivo.
- [ ] Conferir que cada botão data-export-index baixa o item correspondente à linha.

Registro do grupo:

- Resultado:
- Empresa/estado inicial:
- Evidência/downloads:
- Falha ou observação:

## 8. Network Intelligence — ativação e shell

- [ ] Abrir Network Intelligence usando ?ui=network-intelligence.
- [ ] Abrir Network Intelligence diretamente por cada rota #/network/.
- [ ] Conferir que o portal e Network são runtimes de interface distintos.
- [ ] Acionar **Pular para o conteúdo** e verificar foco em #networkPage.
- [ ] Navegar **Visão executiva**, **Cenários**, **Mecanismo de avaliação** e **Dados & confiança**.
- [ ] Conferir rota ativa e seção pai ativa em cada subrota.
- [ ] Conferir as subnavs: Resumo, Malha, Custos, Tributário; Construir, Resultado, Comparar, Risco & sensibilidade; Configurar, Resultados, Trade-offs; Visão geral, Evidências, Fontes, Validação, Metodologia.
- [ ] Trocar #niCompanySelect e conferir provider/contexto, query company e descarte dos dados anteriores.
- [ ] Confirmar se o estado da sessão inicia fluxo criptográfico para empresa protegida; senha não é garantida em toda troca.
- [ ] Trocar #niScenarioSelect para Baseline.
- [ ] Trocar #niScenarioSelect para cada cenário carregado; conferir estado atualizado, navegação para resultado e execução.
- [ ] Confirmar que a seleção global de cenário altera estado corrente; não assumir persistência durável.
- [ ] Conferir indicadores de Evidence, runtime e empresa como status informativos, não botões.
- [ ] Abrir **Ajuda**.
- [ ] Abrir **Configurações**.
- [ ] Abrir **Style guide**.
- [ ] Conferir que os três drawers são informativos e não têm formulário de preferências.
- [ ] Fechar drawer pelo botão ×.
- [ ] Fechar drawer pelo backdrop.
- [ ] Fechar drawer com Escape.
- [ ] Conferir foco inicial, restauração do foco e trapping de Tab/Shift+Tab.
- [ ] Acionar **Exportar** global e confirmar download do primeiro arquivo disponível.
- [ ] Confirmar diferença entre Exportar global (primeiro arquivo) e botões individuais de validação.
- [ ] Abrir cada alias Network: #/diagnostico-baseline, #/simulacao-otimizacao, #/homologacao-relatorio, #fase-1-validacao, #fase-2-validacao, #dados, #qualidade, #abas, #visao-geral, #baseline, #/validacao, #/arena, #arena4, #/simulacao, #/otimizacao, #/entrega, #/debug e #erros.
- [ ] Abrir Debug/Dev somente se habilitado.

Registro do grupo:

- Resultado:
- Rota/empresa/cenário:
- Evidência:
- Falha ou observação:

## 9. Network Intelligence — Visão executiva (4 rotas)

### Resumo — #/network/overview/summary

- [ ] Conferir KPIs de saving, robustez, Evidence e risco.
- [ ] Conferir recomendação, cenário/empresa ativos e alertas de interpretação.
- [ ] Acionar **Abrir cenário**.
- [ ] Acionar **Executar análise**.
- [ ] Acionar **Construir cenário**.
- [ ] Acionar **Abrir mecanismo de avaliação**.
- [ ] Conferir destino de cada link e grupo pai ativo.

### Malha — #/network/overview/network

- [ ] Conferir topologia e legendas de origem/CD/destino.
- [ ] Conferir mapa do Brasil e estados sem dados.
- [ ] Conferir volume por CD e distribuição de distância.
- [ ] Clicar em cada UF disponível e verificar drawer/rótulo.
- [ ] Usar Tab para focar UF e tentar Enter e Espaço; registrar ausência/presença de ativação por teclado.
- [ ] Conferir aria-label, tabindex e role das áreas do mapa.

### Custos — #/network/overview/costs

- [ ] Conferir decomposição de custo do baseline, logística, tributos e total.
- [ ] Conferir estados de valor indisponível.
- [ ] Conferir existência/ausência do gráfico de custos no runtime e registrar se o canvas ID esperado está presente.

### Tributário — #/network/overview/tax

- [ ] Conferir modo/regime, cobertura, período, referência e transição.
- [ ] Conferir campos ausentes e limitações explicitadas.
- [ ] Confirmar que calendário/tabela é leitura e não possui seletor de período.

Registro do grupo:

- Resultado:
- Rota/empresa:
- Evidência:
- Falha ou observação:

## 10. Network Intelligence — cenários (5 rotas)

### Construir — #/network/scenarios/build

- [ ] Conferir estado inicial/vazio e biblioteca disponível.
- [ ] Conferir campos nome, CDs ativos, frete, demanda, dias de estoque, WACC e modo tributário.
- [ ] Em provider mock, confirmar campos desativados e aviso demo_only/fixture.
- [ ] Editar nome e cada premissa; conferir captura do valor e validação.
- [ ] Marcar/desmarcar CDs.
- [ ] Submeter formulário válido **Simular cenário**.
- [ ] Submeter valores inválidos e conferir toast/erro.
- [ ] Acionar **Repor baseline** e confirmar limpeza do draft e resultado; valores reaparecem via baseline.
- [ ] Acionar **Salvar atual** após resultado.
- [ ] Sem cenário/resultado, confirmar botão salvar desativado.
- [ ] Acionar **Exportar JSON** e validar arquivo.
- [ ] Sem resultado, confirmar botão exportar desativado.
- [ ] Importar primeiro arquivo JSON válido da empresa atual.
- [ ] Confirmar que import persiste, atualiza salvos, define draft/seleção, limpa saída anterior e retorna à construção.
- [ ] Tentar importar JSON malformado, schema incompleto, empresa diferente e arquivo que não seja JSON.
- [ ] Confirmar reset do input para permitir escolher o mesmo arquivo de novo.
- [ ] Carregar cada item da biblioteca e cada cenário salvo.
- [ ] Excluir cada cenário salvo individualmente.
- [ ] Confirmar **Limpar salvos** desativado quando a lista está vazia.
- [ ] Limpar todos os salvos da empresa atual e conferir lista vazia.
- [ ] Confirmar que edição digitada em campo não é descrita como atualização persistida do draft até a ação apropriada.
- [ ] Conferir toast e comportamento diante de indisponibilidade de localStorage.

### Resultado — #/network/scenarios/result

- [ ] Sem cenário, conferir estado vazio.
- [ ] Com cenário, conferir KPIs, custo, qualidade, Evidence e blockers.
- [ ] Acionar **Comparar**.
- [ ] Sem saída de risco, acionar **Calcular risco**.
- [ ] Com risco calculado, acionar **Abrir risco**.
- [ ] Conferir estados de loading, sucesso e erro do provider.

### Comparar — #/network/scenarios/compare

- [ ] Conferir estado vazio sem comparação.
- [ ] Conferir baseline, savings, total e status na tabela.
- [ ] Acionar **Selecionar** em cada cenário elegível.
- [ ] Confirmar que baseline não é item manual selecionável.
- [ ] Confirmar ausência/presença de filtros ou ordenação no runtime.

### Risco — #/network/scenarios/risk e #/network/scenarios/risk/advanced

- [ ] Sem Monte Carlo e sem stress, confirmar estado vazio e ausência do formulário.
- [ ] A partir de cenário simulado, executar **Calcular risco** para criar a saída inicial.
- [ ] Conferir que risco resumido e avançado compartilham os controles/dados.
- [ ] Editar iterations (50–5000).
- [ ] Editar seed.
- [ ] Selecionar profile: balanced, conservative, broad.
- [ ] Selecionar scatter_driver: freight, demand, inventory, WACC, tax.
- [ ] Selecionar stress_profile: perfil padrão ou conservador disponível.
- [ ] Selecionar sensitivity_variable.
- [ ] Selecionar sensitivity_x.
- [ ] Selecionar sensitivity_y.
- [ ] Acionar **Recalcular risco** com entradas válidas.
- [ ] Acionar recalcular com entradas inválidas/limites inválidos.
- [ ] Abrir **Risco avançado**.
- [ ] Voltar a **Risco resumido**.
- [ ] Conferir probabilidade, histograma, curvas, drivers, scatter e matriz de sensibilidade.

Registro do grupo:

- Resultado:
- Rota/empresa/cenário:
- Evidência:
- Falha ou observação:

## 11. Network Intelligence — mecanismo de avaliação (3 rotas)

### Configurar — #/network/optimizer/configure

- [ ] Selecionar profile: balanced, CFO, supply, fiscal, conservative.
- [ ] Editar max_candidates (100–10000).
- [ ] Editar seed.
- [ ] Editar min_active_cds e max_active_cds.
- [ ] Editar max_cd_volume_share (0.01–1).
- [ ] Selecionar max_risk_level.
- [ ] Editar risk_iterations (50–5000).
- [ ] Editar risk_seed.
- [ ] Selecionar risk_profile.
- [ ] Selecionar risk_scatter_driver: freight, demand, inventory, WACC, tax.
- [ ] Selecionar stress_profile.
- [ ] Selecionar sensitivity_variable, sensitivity_x e sensitivity_y.
- [ ] Conferir campos required e validação final pelo validador do mecanismo de avaliação.
- [ ] Conferir baseline usado e resumo de configuração.
- [ ] Acionar **Rodar busca** com entrada válida.
- [ ] Acionar busca com limites inválidos e registrar erros/toast.
- [ ] Conferir bloqueio visual de submissões concorrentes.
- [ ] Conferir estado de erro/loading/sucesso.
- [ ] Registrar os campos/opções efetivamente repassados ao pipeline; não assumir que toda entrada chega ao engine sem rastrear payload.

### Resultados — #/network/optimizer/results

- [ ] Conferir estado vazio antes da busca.
- [ ] Conferir status, cobertura, escopo exato e contagem de candidatos.
- [ ] Conferir gráfico e tabela de ranking.
- [ ] Conferir seletor #niManualScenarioSelect quando há candidatos.
- [ ] Selecionar cenário pelo seletor.
- [ ] Informar ID em #niManualScenarioId.
- [ ] Com ID manual e seletor diferentes, confirmar que ID digitado tem prioridade.
- [ ] Acionar **Executar decisão deste cenário** com ID válido.
- [ ] Executar com ID inválido/desconhecido e registrar feedback.
- [ ] Acionar **Ver trade-offs** e confirmar navegação.
- [ ] Acionar **Executar decisão final** e confirmar que navega à validação; não marcar como nova execução de pipeline se não executou.

### Trade-offs — #/network/optimizer/tradeoffs

- [ ] Conferir estado vazio sem mecanismo de avaliação.
- [ ] Conferir candidatos comparáveis depois da busca.
- [ ] Confirmar se página é tabela de trade-offs e não fronteira Pareto completa.
- [ ] Conferir que página não oferece filtros/ações extras, salvo navegação.

Registro do grupo:

- Resultado:
- Rota/empresa/cenário:
- Evidência:
- Falha ou observação:

## 12. Network Intelligence — Dados & confiança (5 rotas)

### Visão geral — #/network/trust/overview

- [ ] Conferir Evidence, robustez, QA, release, recomendação e limitações como dimensões separadas.
- [ ] Conferir navegação para Evidências, Fontes, Validação e Metodologia.

### Evidências — #/network/trust/evidence

- [ ] Conferir score/status, componentes e blockers.
- [ ] Conferir estado vazio sem relatório/decisão.

### Fontes — #/network/trust/sources

- [ ] Conferir lineage e fontes consumidas.
- [ ] Confirmar que fontes/paths protegidos são sanitizados e não expõem arquivos secretos.
- [ ] Conferir estado sem fontes.

### Validação — #/network/trust/validation

- [ ] Conferir Final QA e resultados dos checks.
- [ ] Conferir status/avisos de release.
- [ ] Conferir audit trail sanitizado.
- [ ] Listar todos os arquivos de export disponíveis.
- [ ] Acionar **Baixar** individualmente para cada arquivo.
- [ ] Conferir nome, MIME/tipo e conteúdo de cada download.
- [ ] Testar índice/arquivo inexistente ou fora do conjunto e registrar fallback para o primeiro item, se aplicável.
- [ ] Acionar **Exportar** global e confirmar que baixa o primeiro arquivo.
- [ ] Sem pacote, confirmar mensagem de erro/ausência de export.

### Metodologia — #/network/trust/methodology

- [ ] Conferir explicação de engines, incerteza, Evidence, dados ausentes e release.
- [ ] Abrir e fechar disclosure **Snapshot técnico**.
- [ ] Conferir que é leitura e não formulário.

Registro do grupo:

- Resultado:
- Rota/empresa:
- Evidência/download:
- Falha ou observação:

## 13. Network Intelligence — debug, aliases e ações sem botão

- [ ] Confirmar que link **Debug** e botão **Dev** só aparecem com debug habilitado.
- [ ] Abrir rota #/network/dev/console diretamente com debug habilitado.
- [ ] Abrir rota com debug desabilitado e confirmar “Console indisponível”.
- [ ] Abrir alias Network #erros e confirmar query tab=errors.
- [ ] Conferir conteúdo/eventos sanitizados e filtro de erros/avisos/falhas.
- [ ] Confirmar que não há abas visuais para alternar all/errors caso assim esteja renderizado.
- [ ] Confirmar que #/network/dev/console não é o mesmo que o centro de diagnóstico do portal.
- [ ] Conferir bindings sem controle visível: data-action=lock-crypto e data-action=run-decision; registrar que handler sem elemento não é botão acionável.
- [ ] Conferir se nenhum botão **Bloquear** aparece no shell Network; separar do #cryptoLockButton do carregador compartilhado.

Registro do grupo:

- Resultado:
- Rota/estado de debug:
- Evidência:
- Falha ou observação:

## 14. Compatibilidade, segurança e cobertura transversal

- [ ] Separar resultado da fixture empresa_mock de qualquer resultado empresarial real.
- [ ] Confirmar rótulo demo_only em resultados de mock.
- [ ] Confirmar troca de empresa limpa contexto anterior e não mistura dados.
- [ ] Confirmar que caso E2E protegido marcado SKIPPED não é prova de descriptografia/fluxo completo.
- [ ] Conferir tratamento de armazenamento indisponível.
- [ ] Conferir validação/importação por empresa e ausência de vazamento entre tenants.
- [ ] Navegar por todos os controles usando teclado, além do mapa e drawers.
- [ ] Conferir foco visível, ordem de Tab, aria-label, nomes acessíveis e estados disabled.
- [ ] Conferir viewport desktop e viewport móvel.
- [ ] Capturar erros de console e falhas de rede durante o fluxo completo.
- [ ] Distinguir falha real, dado ausente, estado vazio, demo, bloqueio por política e etapa não executada.
- [ ] Conferir todos os downloads por nome/MIME/conteúdo, sem incluir dados protegidos em evidência.
- [ ] Comparar a superfície portal versus Network Intelligence e registrar diferenças de paridade.

Registro final:

- Itens marcados:
- Passou:
- Falhou:
- Parcial:
- Bloqueado:
- Não aplicável:
- Principais defeitos:
- Links das evidências:
- Próximas ações:
