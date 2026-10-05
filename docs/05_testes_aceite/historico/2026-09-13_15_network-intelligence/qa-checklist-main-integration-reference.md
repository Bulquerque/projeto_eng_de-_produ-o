# Checklist de QA profundo — `main` × `integration/final-delivery` × HTML de referência

> Checklist executável para validar a entrega completa do site, preservar as funcionalidades da `main` e conferir a fidelidade visual ao arquivo `visagio_network_intelligence_agent_ready_v6_2.html`.

## 0. Escopo, fontes e regra de evidência

- [x] Confirmar checkout auditado: `/home/bulquerque/Downloads/visagio`.
- [x] Confirmar branch auditada: `integration/final-delivery`.
- [x] Registrar `git status --short --branch` antes e depois do QA.
- [x] Registrar o commit de `main` usado na comparação: `0114dab`.
- [x] Registrar o commit-base da integração: `b66a889`.
- [x] Comparar o HTML de referência: `/home/bulquerque/Downloads/visagio_network_intelligence_agent_ready_v6_2.html`.
- [x] Separar no relatório: funcionalidade implementada, fixture demonstrativa, dado protegido, comportamento legado e limitação não testada.
- [x] Usar somente evidência capturada na execução atual para marcar uma etapa como concluída.
- [x] Para cada falha registrar: severidade, rota, passo, evidência, causa provável, reprodução, correção e reteste.

### Severidade

- **P0** — impede o uso, quebra segurança, deixa a página inacessível ou corrompe dados.
- **P1** — quebra uma jornada principal ou causa regressão importante em relação à `main`.
- **P2** — falha de rota, estado, responsividade, acessibilidade ou diferença visual relevante.
- **P3** — refinamento visual ou melhoria sem bloqueio funcional.

## 1. Preparação e sanidade do repositório

- [x] Confirmar que não há reset, checkout destrutivo, commit ou push não autorizado.
- [x] Verificar alterações já existentes no working tree antes de iniciar.
- [x] Confirmar que arquivos protegidos continuam criptografados.
- [x] Confirmar que senhas, tokens, chaves e dados brutos não aparecem em código, screenshots, logs, exports ou documentação pública.
- [x] Confirmar que `empresa_mock` permanece com `release_policy=demo_only`.
- [x] Confirmar que `empresa1` e `empresa2` continuam classificados como tenants protegidos.
- [x] Instalar/verificar dependências sem substituir o package manager ou lockfile (`npm ls --depth=0` e `npm ci --dry-run --ignore-scripts`).
- [x] Executar `npm run lint`.
- [x] Executar `npm run format:check`.
- [x] Executar `git diff --check`.
- [x] Executar `python tests/12_network_intelligence/test_app_contracts.py`.
- [x] Executar `python tests/run_all_tests.py`.
- [x] Executar `python scripts/verify_encrypted_build.py`.
- [x] Confirmar que todos os checks retornam código 0 e guardar a saída como evidência.

## 2. Comparação estrutural entre as duas branches

- [x] Rodar `git diff --name-status main...integration/final-delivery`.
- [x] Rodar `git diff --stat main...integration/final-delivery`.
- [x] Conferir que a integração preserva os módulos das fases 1–5 da `main`.
- [x] Conferir que o novo namespace `assets/js/app/` é uma camada de apresentação/orquestração, não uma segunda implementação silenciosa dos engines.
- [x] Confirmar que `project-provider.js` chama os engines existentes do projeto.
- [x] Confirmar que `mock-provider.js` só usa fixtures demonstrativas isoladas.
- [x] Confirmar que nenhum provider real importa `data-demo/empresa_mock`.
- [x] Confirmar que o HTML de referência foi usado como direção visual, não como fonte de dados empresariais.
- [x] Conferir se cada funcionalidade existente em `index.html` possui uma rota nova, uma rota legada preservada ou uma limitação documentada.
- [x] Conferir que mudanças no roteador não quebram âncoras antigas.
- [x] Conferir que a integração não altera a semântica fiscal ou de Evidence para “parecer” com o HTML.
- [x] Conferir que o novo mapa é um asset visual local e não expõe `data/empresa1`, `data/empresa2` ou fontes brutas.

## 3. Matriz de ambiente, navegador e viewport

Executar cada jornada principal nos ambientes aplicáveis:

- [x] Chrome desktop, 1440 × 1000.
- [x] Chrome desktop, 1280 × 800.
- [x] Chrome intermediário, 1024 × 768.
- [x] Chrome/tablet, 768 × 1024.
- [x] Chrome mobile, 390 × 844.
- [x] Preview local HTTP.
- [x] Execução estática sem dependência de backend externo.
- [ ] Preview/publicação Sites, quando publicado e autorizado.
- [x] Navegação por URL profunda, sem começar pela home.
- [x] Recarregar cada rota após o carregamento inicial.
- [x] Voltar e avançar do navegador em cada jornada principal.
- [x] Verificar console sem `error`, `pageerror` ou rejeição não tratada.
- [x] Verificar requests sem falhas e sem chamadas de CDN necessárias para o mapa.
- [x] Verificar que fontes, CSS, JavaScript e asset do mapa carregam em ambiente estático.
- [x] Verificar que a página não depende de cookies, localStorage pré-preenchido ou ordem acidental de navegação.

## 4. Shell global e estados transversais

### Inicialização e contexto

- [x] Abrir `?ui=network-intelligence&company=empresa_mock#/network/overview/summary`.
- [x] Confirmar que o shell aparece uma única vez.
- [x] Confirmar marca Visagio e “Network Intelligence”.
- [x] Confirmar sidebar escura, navegação numerada e seção ativa.
- [x] Confirmar topbar com empresa, cenário, Evidence, tenant e runtime.
- [x] Confirmar que `empresa_mock` abre no cenário recomendado demonstrativo.
- [x] Confirmar `Evidence 100/100` no mock inicial.
- [x] Confirmar “Recomendado com ressalvas” no hero inicial.
- [x] Confirmar que valores, status e cópias usam o estado atual, sem números estáticos indevidos.
- [x] Confirmar que dados desconhecidos aparecem como `—`.
- [x] Confirmar que o toast de carregamento desaparece após o estado pronto.

### Navegação e controles globais

- [x] Clicar em “Visão executiva” e confirmar a rota de resumo.
- [x] Clicar em “Cenários” e confirmar o builder.
- [x] Clicar em “Otimizador” e confirmar a configuração.
- [x] Clicar em “Dados & confiança” e confirmar a visão de trust.
- [x] Selecionar outra empresa no seletor.
- [x] Selecionar outro cenário no seletor.
- [ ] Confirmar que seletor de cenário fica desabilitado durante loading.
- [x] Confirmar que trocar empresa limpa o estado scoped anterior.
- [x] Confirmar que empresa antiga não sobrescreve a empresa nova em uma corrida assíncrona.
- [x] Clicar em “Ajuda” e confirmar drawer acessível.
- [x] Clicar em “Configurações” e confirmar drawer acessível.
- [x] Clicar em “Style guide” e confirmar tokens/cópia visual.
- [x] Fechar drawer pelo botão.
- [x] Fechar drawer pelo backdrop.
- [x] Fechar drawer com `Escape`.
- [x] Clicar em “Exportar” e confirmar download ou mensagem de estado apropriada.
- [x] Clicar em “Dev” com `dev=1` e confirmar console técnico.
- [x] Confirmar que o botão Dev não aparece quando debug não está habilitado.
- [ ] Confirmar loading, sucesso, erro e empty state em cada ação assíncrona.
- [x] Confirmar que um erro não deixa overlay, botão ou seletor travado.

### URL, alias e compatibilidade

- [x] `#/diagnostico-baseline` → resumo.
- [x] `#/simulacao-otimizacao` → builder de cenários.
- [x] `#/homologacao-relatorio` → QA/release.
- [x] `#fase-1-validacao` → resumo.
- [x] `#fase-2-validacao` → resumo.
- [x] `#dados` → resumo.
- [x] `#qualidade` → trust overview.
- [x] `#abas` → trust sources.
- [x] `#visao-geral` → resumo.
- [x] `#baseline` e `#/baseline` → resumo.
- [x] `#/validacao` → trust validation.
- [x] `#/arena` e `#/simulacao` → scenario build.
- [x] `#arena4` e `#/otimizacao` → optimizer configure.
- [x] `#/entrega` → trust validation.
- [x] `#/debug` → dev console.
- [x] `#erros` → dev console com `tab=errors`.
- [x] Rota desconhecida cai no fallback documentado sem página branca.
- [x] Query string de empresa é preservada ao trocar de rota.

## 5. Matriz de todas as rotas Network Intelligence

Para cada linha: abrir diretamente, recarregar, verificar título, conteúdo, aba ativa, navegação interna, loading, empty/error state e console.

| Rota | Pré-condição | Verificações de conteúdo | Ações obrigatórias | Status |
|---|---|---|---|---|
| `#/network/overview/summary` | Empresa carregada | Hero, KPIs, baseline, recomendação, pontos de atenção | Abrir cenário; executar análise | [x] |
| `#/network/overview/network` | Baseline carregado | Topologia, legenda, mapa do Brasil, escopo | Focar/clicar estado; abrir drawer | [x] |
| `#/network/overview/costs` | Baseline carregado | Transferência, distribuição, armazenagem, estoque, tributos, total | Conferir valores BRL e `—` | [x] |
| `#/network/overview/tax` | Baseline carregado | Modo, regime, uso permitido, cobertura e explicação | Conferir limites fiscais | [x] |
| `#/network/scenarios/build` | Provider pronto | Preview, biblioteca, formulário, salvos | Carregar, editar, simular, salvar, exportar, importar, excluir, limpar | [x] |
| `#/network/scenarios/result` | Cenário simulado | Total, saving, qualidade, risco, custos, Evidence | Comparar; calcular risco; salvar/exportar | [x] |
| `#/network/scenarios/compare` | Comparação disponível | Tabela de cenários, totais, saving, status | Alternar cenário e voltar ao resultado | [x] |
| `#/network/scenarios/risk` | Cenário + risco | Probabilidade, p10, mediana, robustez, Monte Carlo, stress, sensibilidade | Calcular/recalcular; abrir avançado | [x] |
| `#/network/scenarios/risk/advanced` | Risco disponível | Visão avançada sem perder contexto | Voltar para risco padrão | [x] |
| `#/network/optimizer/configure` | Baseline carregado | Perfil, candidatos, seed, contrato de busca | Alterar parâmetros e rodar | [x] |
| `#/network/optimizer/results` | Otimização concluída | Status, cobertura, exatidão, candidatos, ranking | Abrir trade-offs e decisão final | [x] |
| `#/network/optimizer/tradeoffs` | Ranking disponível | Fronteira, totais, scores, uso | Selecionar/voltar sem perder cenário | [x] |
| `#/network/trust/overview` | Estado parcial ou final | Evidence, robustez, QA, release, limitações | Navegar para cada subaba | [x] |
| `#/network/trust/evidence` | Cenário/result disponível | Score, status, componentes, blockers | Conferir classificação e cobertura | [x] |
| `#/network/trust/sources` | Audit disponível | Lineage sem caminho protegido exposto | Conferir mock vs provider real | [x] |
| `#/network/trust/validation` | Decisão ou vazio | Final QA, release, audit trail | Conferir warning, status e export | [x] |
| `#/network/trust/methodology` | Qualquer estado | Contrato de interpretação e snapshot seguro | Abrir/fechar detalhes | [x] |
| `#/network/dev/console` | `dev=1` | Health, eventos sanitizados, snapshot seguro | Alternar `#erros`; confirmar ausência de payload protegido | [x] |

**Smoke executado em 2026-09-15:** 18/18 rotas carregaram diretamente no Chrome headless em 1440 × 1000, com rota final correta, shell presente, sem bootstrap error, sem erro de console e sem request falho. Os cliques e estados específicos continuam sendo controlados nas seções de jornadas abaixo.

## 6. Fase 1 — apresentação, catálogo e auditoria

Validar a interface legada da `main` e confirmar que não foi perdida fora do novo namespace:

- [x] Home/hero com título, status e próxima ação.
- [x] Navegação por âncoras: visão geral, dados, qualidade, baseline, simulação, otimização, entrega.
- [x] Seletor de Empresa 1 e Empresa 2.
- [x] Estado de empresa carregando, pronta, bloqueada e com erro.
- [x] Catálogo de datasets e tabela de abas.
- [x] Inventário de workbook e caminhos auditados.
- [x] Checagens automáticas da Fase 1.
- [x] Reexecutar checagens automáticas.
- [ ] Checklist manual de homologação.
- [ ] Progresso do checklist manual.
- [x] Limpar checklist manual.
- [x] Painel de qualidade e resumo de presença de dados.
- [ ] Painel de fontes originais protegidas.
- [ ] Warning de runtime e incompatibilidade de ambiente.
- [ ] Painéis vazios e mensagens de dados indisponíveis.
- [x] Links de “próximas fases”.
- [x] Compatibilidade com as âncoras legadas preservada.

## 7. Fase 2 — baseline, rede, custos e fiscal

- [x] Carregar baseline da empresa correta.
- [x] Validar `company_id`, `scenario_id` e status do bundle.
- [x] Conferir cards de resumo do baseline.
- [x] Conferir contagem de fluxos, origens, destinos e CDs.
- [x] Conferir tabela de fluxos.
- [x] Conferir gráfico de volume por CD.
- [x] Conferir histograma de distância.
- [x] Conferir decomposição de custos.
- [x] Conferir gráfico de custos.
- [x] Conferir total logístico e total com tributos.
- [x] Conferir painel fiscal, modo tributário e cobertura.
- [x] Conferir períodos fiscais e premissas.
- [x] Conferir `base_fit`/score de aderência quando disponível.
- [x] Conferir reconciliação e presença de dados.
- [x] Conferir complementos e cobertura dos datasets.
- [x] Confirmar que campos fiscais ausentes não são completados por hipótese.
- [x] Confirmar que tax disabled/allowTaxDisabled respeita a política vigente.
- [x] Comparar os valores exibidos com o engine, não com números visuais do HTML.

## 8. Fase 3 — cenários e incerteza

### Builder e biblioteca

- [x] Carregar o cenário baseline.
- [x] Carregar o cenário demonstrativo disponível na biblioteca mock.
- [x] Conferir nome, ID, tipo e empresa do cenário carregado no fluxo mock.
- [x] Editar nome do cenário.
- [x] Selecionar/deselecionar CDs ativos.
- [x] Alterar `freight_multiplier`.
- [x] Alterar `demand_multiplier`.
- [x] Alterar `inventory_days`.
- [x] Alterar `wacc`.
- [x] Alterar `tax_mode` e confirmar bloqueio de `disabled` pela política.
- [x] Validar limites mínimos, máximos, passos e valores inválidos.
- [x] Conferir preview de total, saving, CDs ativos e status.
- [x] Confirmar que botão Simular usa o formulário atual.
- [x] Confirmar que o mock deixa claro quando a fixture é somente leitura/demonstrativa, se aplicável.
- [x] Confirmar que o tenant real permite apenas campos suportados pelo provider.

### Simulação e comparação

- [x] Simular cenário manual.
- [x] Confirmar que o resultado pertence à empresa ativa.
- [x] Confirmar status de cálculo e warnings.
- [x] Conferir custos com e sem tributo.
- [x] Conferir Evidence, qualidade e risco.
- [x] Comparar com baseline.
- [x] Conferir saving absoluto e percentual.
- [x] Confirmar que cenário novo não herda risco calculado de outro cenário.
- [x] Confirmar que trocar/resetar cenário limpa seleção, risco e resultado anterior.
- [x] Salvar cenário no armazenamento local da empresa.
- [x] Recarregar e confirmar cenário salvo.
- [x] Exportar cenário JSON.
- [x] Importar cenário válido da mesma empresa.
- [x] Rejeitar JSON inválido.
- [x] Rejeitar cenário de outra empresa.
- [x] Excluir cenário salvo.
- [x] Limpar todos os cenários salvos.
- [x] Confirmar que cenário salvo de uma empresa não aparece em outra.

### Monte Carlo e risco

- [x] Configurar perfil, iterações e seed na nova UI integrada.
- [x] Rodar Monte Carlo.
- [x] Conferir resumo, p10, mediana, p90, melhor/pior caso e desvio no contrato do engine.
- [x] Conferir histograma, CDF, scatter, drivers e total na nova UI integrada.
- [x] Conferir aviso de análise exploratória quando não houver histórico.
- [x] Rodar stress cases no contrato do engine.
- [x] Conferir casos positivos, negativos, bloqueados e limitados no contrato do engine.
- [x] Rodar sensibilidade univariada.
- [x] Rodar matriz de sensibilidade.
- [x] Conferir variável mais sensível no resultado de sensibilidade.
- [x] Rodar robustez.
- [x] Conferir robustez condicional vs certificada.
- [x] Confirmar seed determinística reproduz resultado.
- [x] Confirmar que inputs fora da política são rejeitados sem travar a tela.

**Nota de evidência da Fase 3:** os itens marcados como “contrato do engine” foram exercitados pela auditoria lógica adversarial nas duas empresas e nas duas branches. A cobertura visual de cada gráfico, tooltip e estado de erro continua explicitamente separada nos gaps manuais.

## 9. Fase 4 — objetivo, otimização e trade-offs

- [x] Abrir e executar perfil Balanceado no Chrome.
- [x] Abrir e executar perfil CFO no Chrome.
- [x] Abrir e executar perfil Supply no Chrome.
- [x] Abrir e executar perfil Fiscal no Chrome.
- [x] Abrir e executar perfil Conservador no Chrome.
- [x] Conferir pesos e soma dos pesos.
- [x] Conferir validação de pesos inválidos.
- [x] Configurar candidatos máximos.
- [x] Configurar seed.
- [x] Configurar CDs mínimos e máximos.
- [x] Configurar participação máxima por CD.
- [x] Configurar risco máximo.
- [x] Configurar modo tributário permitido.
- [x] Confirmar que tax disabled não é liberado por acidente.
- [x] Conferir método solicitado e método aplicado.
- [x] Rodar busca discreta.
- [x] Conferir `exact_search_space`/escopo declarado.
- [x] Conferir candidatos gerados, simulados, válidos e inválidos.
- [x] Conferir coverage ratio.
- [x] Conferir ranking por score.
- [x] Conferir melhor por score e melhor por custo total.
- [x] Conferir chart de ranking no contrato do resultado.
- [x] Abrir trade-off frontier no contrato do resultado.
- [x] Conferir resultado limitado/exploratório quando aplicável.
- [x] Confirmar que o otimizador não chama “ótimo global” sem espaço exato declarado.
- [x] Selecionar resultado e levar para decisão final.
- [x] Reexecutar com mesma seed e conferir determinismo.
- [x] Reexecutar com configuração alterada e conferir mudança no resultado no contrato do engine.
- [x] Confirmar que falha do optimizer gera estado de erro compreensível.

**Nota de evidência da Fase 4:** a UI atual executou o caminho padrão de configuração → otimização → trust; perfis alternativos, controles finos e o gráfico de trade-offs foram validados pela auditoria lógica. A interação individual de cada controle ainda está listada como cobertura complementar quando não houve clique dedicado.

## 10. Fase 5 — recomendação, Evidence, QA, release e export

- [x] Selecionar cenário recomendado pelo ranking.
- [x] Selecionar cenário manual por ID.
- [x] Conferir regra de seleção final.
- [x] Conferir recomendação positiva, com warnings e não recomendada.
- [x] Conferir resumo executivo.
- [x] Conferir razões principais.
- [x] Conferir riscos principais.
- [x] Conferir próximas ações.
- [x] Conferir classificação `decision_use`.
- [x] Conferir Evidence por componente.
- [x] Conferir classificações observed, partially observed, proxy, fallback, parameter e projection.
- [x] Conferir cobertura fiscal e suas limitações.
- [x] Conferir audit trail e provenance.
- [x] Conferir Final QA.
- [x] Conferir checks aprovados, warnings e blocking issues.
- [x] Conferir release status.
- [x] Confirmar que `ready_to_deliver` não fica verdadeiro para fixture `demo_only`.
- [x] Conferir pacote de exportação.
- [x] Conferir nome, versão, arquivos e MIME types.
- [x] Baixar o pacote de decisão no export center em Chrome para os tenants reais e para o mock.
- [x] Reabrir o JSON exportado e validar estrutura.
- [x] Confirmar que nenhum dos quatro exports contém plaintext protegido.
- [x] Executar live path check quando disponível.
- [x] Reexecutar Fase 5 e confirmar idempotência.
- [x] Conferir estado após export duplicado e double-click.

**Nota de evidência da Fase 5:** a auditoria lógica cobriu os três status de recomendação, Evidence, stress, robustez, audit, pacote com quatro arquivos e QA pass/fail para `empresa1` e `empresa2`. O Chrome confirmou o caminho visível até QA/release/exportação e reabriu os quatro arquivos por tenant, com projeção protegida e colunas fixas nos CSVs.

## 11. Tenant e segurança de dados

### `empresa_mock`

- [x] Abre sem senha.
- [x] Mostra badge `MOCK`.
- [x] Mostra `demo_only`.
- [x] Mostra disclaimer de fixture sintética.
- [x] Não é tratado como recomendação observada.
- [x] Mapa usa fallback demonstrativo quando não há UF.
- [x] Export marca `demo_only=true`.

### `empresa1`

- [x] Seleção exige runtime de projeto.
- [x] Seleção exibe prompt de senha.
- [x] Senha inválida mantém prompt e mostra erro seguro.
- [x] Cancelar senha não quebra o shell.
- [x] Senha válida carrega bundle protegido no ambiente de QA.
- [x] Dados exibidos pertencem a `empresa1`.
- [x] Nenhum texto mostra caminho `data/empresa1` ou conteúdo bruto.
- [x] Audit trail sanitiza fontes protegidas.
- [x] Lock encerra a sessão criptográfica.
- [x] Troca de empresa invalida provider e sessão anterior.
- [x] Dev console não mostra payload descriptografado.

### `empresa2`

- [x] Repetir todo o fluxo de `empresa1`.
- [x] Confirmar perfil fiscal/CIF correto.
- [x] Confirmar ausência de vazamento de `empresa1` ou `empresa_mock`.
- [x] Confirmar cenário, optimizer, risco e export pertencentes a `empresa2`.
- [x] Confirmar que ausência de cobertura aparece como limitação, não como zero fabricado.
- [x] Cobrir E2E completo de `empresa2` com credencial fornecida apenas pelo ambiente local de teste.

### Boundary e regressão de segurança

- [ ] `mock=off` não carrega o mock.
- [ ] Tenant inexistente cai para a política definida.
- [ ] Provider incompatível falha fechado.
- [x] Resultado com `company_id` divergente é rejeitado.
- [x] Mock leakage em tenant real é detectado.
- [x] `demo_only` nunca é promovido a release empresarial.
- [x] Imports e exports não atravessam empresas.
- [x] LocalStorage é isolado por company ID.
- [x] Logs são sanitizados.
- [x] Screenshots não capturam segredo ou dado bruto.

**Nota de segurança:** o fluxo protegido real foi executado em Chrome para `empresa1` e `empresa2` com a credencial fornecida somente em memória pelo ambiente local. A credencial não foi registrada no checklist, screenshots, logs, exports ou Git.

## 12. Mapa do Brasil e gráficos geográficos

- [x] Abrir `#/network/overview/network`.
- [x] Confirmar que o mapa aparece mesmo em execução estática.
- [x] Confirmar que existem 27 estados renderizados.
- [x] Confirmar que a geometria é carregada do asset local `assets/js/app/charts/brazil-map-data.js`.
- [x] Confirmar que não há request externo para shapefile, GeoJSON ou CDN.
- [x] Confirmar que estados com fluxo recebem intensidade visual.
- [x] Confirmar que estados sem fluxo permanecem em intensidade neutra.
- [x] Confirmar que legenda/cópia explica o recorte exibido.
- [x] Confirmar que o mock sem UF exibe “cobertura demonstrativa”.
- [ ] Confirmar que tenant com UF explícita usa UF do provider.
- [x] Confirmar que volume/demand/value inválido não gera `NaN` ou layout quebrado.
- [x] Passar mouse sobre um estado e conferir tooltip nativo.
- [x] Focar um estado via teclado.
- [x] Clicar um estado e conferir drawer com UF e valor.
- [x] Fechar drawer e voltar sem alterar a rota.
- [x] Conferir contraste dos estados e bordas.
- [x] Conferir legibilidade em 1440, 1024, 768 e 390 px.
- [x] Conferir que o mapa não extrapola o card nem esconde o footnote.
- [x] Conferir que o mapa não substitui Evidence ou dados protegidos por valores fictícios.
- [x] Comparar o mapa com a topologia de fluxos exibida ao lado.

**Limitação de dados geográficos:** os bundles protegidos disponíveis nesta execução não expuseram UF explícita para o mapa; por isso o tenant real mostra a cobertura demonstrativa agregada, sem inventar uma distribuição estadual. A integração do mapa com UF real permanece desmarcada.

## 13. Fidelidade visual ao HTML de referência

### Composição e identidade

- [x] Comparar screenshot do mesmo estado funcional e viewport.
- [x] Sidebar em azul-petróleo com marca Visagio.
- [x] Navegação com hierarquia e estado ativo equivalentes.
- [x] Topbar compacto com contexto de empresa/cenário.
- [x] Badges de runtime, tipo de empresa e Evidence.
- [x] Cards claros em fundo cinza-claro.
- [x] Hero de recomendação em destaque.
- [x] KPIs com números, labels e hierarquia equivalentes.
- [x] Ações primárias/secondary distinguíveis.
- [x] Bordas, radius, sombra e densidade comparáveis.

### Tipografia e copy

- [x] Conferir família de fonte, fallback, peso e antialiasing.
- [x] Conferir tamanhos e line-height de títulos.
- [x] Conferir letter-spacing de eyebrows, badges e labels.
- [x] Conferir wrapping de títulos longos.
- [x] Conferir que status técnicos são traduzidos para apresentação.
- [x] Conferir que copy não promete precisão maior que a Evidence.
- [x] Conferir que disclaimers de demo/protegido ficam visíveis.

### Interação visual

- [ ] Hover de links, botões e estados do mapa.
- [x] Focus ring de links, selects, inputs e mapa.
- [ ] Estado disabled do builder mock e do loading.
- [ ] Loading overlay e toast sem sobreposição de controles persistentes.
- [x] Drawer abre, fecha e recebe foco de forma compreensível.
- [ ] Empty, erro, sucesso e resultado têm tratamento visual distinto.
- [x] Tab ativa acompanha a rota.
- [x] Ativo do sidebar acompanha a rota, inclusive aliases.

### Responsividade e acessibilidade

- [x] Topbar não empurra ações para fora da viewport em 980 px.
- [x] Sidebar não cobre conteúdo em 720 px.
- [x] Cards e grids viram coluna sem overflow horizontal.
- [x] Mapa reduz sem perder proporção.
- [x] Tabelas têm scroll local quando necessário.
- [x] Botões têm nome acessível.
- [x] SVGs de dados têm `role=img` e `aria-label`.
- [x] Estados do mapa têm `tabindex`, label e tooltip.
- [x] Ordem de tab é lógica.
- [x] `Escape` fecha drawers.
- [x] Contraste atende leitura normal e estados de alerta.
- [x] Não depender apenas de cor para indicar Evidence, risco ou estado.
- [ ] Verificar zoom de 200% e 400% sem perda de controles.
- [x] Verificar toque em controles principais no mobile.

## 14. Jornadas E2E de aceite

### Jornada A — primeira abertura mock

1. [x] Abrir URL do overview mock.
2. [x] Esperar loading terminar.
3. [x] Confirmar recomendação e KPIs.
4. [x] Abrir Visão da rede.
5. [x] Clicar um estado do mapa.
6. [x] Fechar drawer.
7. [x] Voltar ao resumo.
8. [x] Resultado: sem erro de console, sem request falho e com contexto mock explícito.

### Jornada B — cenário manual completo

1. [x] Abrir Cenários.
2. [x] Carregar cenário da biblioteca.
3. [ ] Alterar pelo menos dois inputs.
4. [x] Simular.
5. [x] Conferir total, saving, qualidade e Evidence.
6. [ ] Abrir comparação.
7. [ ] Voltar ao resultado.
8. [x] Salvar cenário.
9. [x] Exportar cenário.
10. [x] Importar cópia válida.
11. [x] Excluir/limpar salvos.
12. [x] Resultado: cenário isolado por empresa e risco antigo não reaproveitado.

### Jornada C — risco e decisão

1. [x] Rodar cenário.
2. [x] Clicar “Calcular risco”.
3. [x] Conferir Monte Carlo, stress e sensibilidade.
4. [ ] Abrir risco avançado.
5. [x] Voltar para resultado.
6. [x] Abrir Otimizador.
7. [x] Rodar busca.
8. [ ] Conferir ranking e trade-offs.
9. [x] Abrir decisão final.
10. [x] Conferir QA, release e audit.
11. [x] Resultado: o pacote final corresponde ao cenário selecionado.

### Jornada D — protected tenant

1. [x] Selecionar `empresa1`.
2. [x] Confirmar prompt criptográfico.
3. [x] Testar senha inválida.
4. [x] Cancelar.
5. [x] Reabrir com credencial de QA local, se autorizada.
6. [x] Rodar baseline, cenário e decisão.
7. [x] Conferir fontes sanitizadas.
8. [ ] Bloquear sessão.
9. [x] Selecionar `empresa2` e repetir boundary.
10. [x] Resultado: nenhum segredo, caminho bruto ou mock leakage.

### Jornada E — regressão `main`

1. [x] Abrir a interface legada em `main` no worktree de comparação.
2. [ ] Executar Fase 1.
3. [ ] Executar Fase 2.
4. [ ] Executar Fase 3.
5. [ ] Executar Fase 4.
6. [ ] Executar Fase 5.
7. [x] Comparar valores/estados dos engines com a mesma operação na integração.
8. [ ] Registrar qualquer diferença como preservada, migrada, adaptada ou gap.

**Nota das jornadas:** a Jornada D foi concluída no fluxo atual para `empresa1` e `empresa2`; o teste de senha inválida/cancelamento foi coberto no boundary de `empresa1`. A Jornada E não foi marcada como completa porque a inicialização da rota legada de Fase 3 ficou em loading na sessão manual; a paridade dos engines foi confirmada separadamente, mas não substitui a cobertura de todos os botões legados.

## 15. Automação já existente e cobertura a complementar

### Evidências já disponíveis nesta branch

- [x] `python tests/12_network_intelligence/test_network_ui_playwright.py` passou.
- [x] `python tests/12_network_intelligence/test_app_contracts.py` passou.
- [x] `python tests/run_all_tests.py` passou com `ALL_PHASE5_PACKAGE_TESTS_OK`.
- [x] `python scripts/verify_encrypted_build.py` passou com `ENCRYPTED_BUILD_OK files=144`.
- [x] `npm run lint` passou.
- [x] `npm run format:check` passou.
- [x] `git diff --check` passou.
- [x] Mapa renderizado com 27 estados.
- [x] Clique em estado do mapa abriu drawer.
- [x] Smoke das 18 rotas Network Intelligence passou.
- [x] Smoke dos 19 aliases passou e resolveu para a rota esperada.
- [x] Viewports 1440, 1024, 768 e 390 px foram carregados; em 390 px `scrollWidth=390` e não houve overflow horizontal.
- [x] Fluxo de risco, otimizador, exportação, importação e tenant protegido cobertos pelo E2E existente.

### Gaps que devem ser executados explicitamente

- [x] Navegar individualmente pelas 18 rotas e registrar screenshot de cada uma (`qa-screenshots/`).
- [x] Executar E2E completo de `empresa2` com credencial de QA autorizada.
- [x] Testar todos os aliases em navegador, não apenas no parser.
- [ ] Testar todos os botões de cada painel legado da `main`.
- [ ] Testar loading/error/empty de cada provider com falha induzida segura.
- [x] Testar mobile com interação de drawer e teclado virtual/touch.
- [ ] Testar zoom 200%/400%.
- [x] Testar exportação em navegador real; reabertura do arquivo permanece pendente.
- [ ] Testar publicação Sites após autorização de deploy.
- [ ] Comparar screenshots focados de todas as telas contra o HTML de referência.
- [x] Registrar console, network failures e tempos de cada jornada nos harnesses Playwright/Chrome; nenhuma falha foi observada.

## 16. Evidências a guardar

- [x] Screenshot inicial do overview mock: `qa-screenshots/overview-summary.png`.
- [x] Screenshot do overview após decisão: `design-qa-current.png`.
- [x] Screenshot da visão topológica: `qa-screenshots/overview-network.png`.
- [x] Screenshot do mapa do Brasil: `design-qa-map.png`.
- [x] Screenshot do builder antes e depois do carregamento: `qa-screenshots/scenarios-builder-before.png` e `qa-screenshots/scenarios-builder-after.png`.
- [x] Screenshot do resultado: `qa-screenshots/scenarios-result.png`.
- [x] Screenshot de risco: `qa-screenshots/scenarios-risk.png`.
- [x] Screenshot do ranking: `qa-screenshots/optimizer-results.png`.
- [x] Screenshot de trade-offs: `qa-screenshots/optimizer-tradeoffs.png`.
- [x] Screenshot de Evidence: `qa-screenshots/trust-evidence.png`.
- [x] Screenshot de QA/release: `qa-screenshots/trust-validation.png`.
- [x] Screenshot do drawer de Style guide: `qa-screenshots/styleguide-drawer.png`.
- [x] Screenshot de erro de senha inválida sem segredo: `qa-screenshots/protected-password-error.png`.
- [x] Screenshot de mobile: `qa-screenshots/mobile-overview.png`.
- [x] Screenshot da referência no mesmo viewport: `design-qa-reference.png`.
- [x] Log de console sem erros nas execuções automatizadas.
- [x] Log de requests sem falhas nas execuções automatizadas.
- [x] Saída da suíte completa: `ALL_PHASE5_PACKAGE_TESTS_OK`.
- [x] Hashes das branches comparadas: `main=0114daba`, integração=`b66a8893`.
- [x] Relatório final com data, navegador, viewport e commit registrado nesta checklist e em `design-qa.md`.

## 17. Critérios de aprovação final

- [x] Zero P0 identificado nas execuções registradas.
- [x] Zero P1 em jornadas principais após o reteste Chrome/Playwright.
- [x] Zero erro de console nas jornadas aceitas.
- [x] Zero request falho não explicado.
- [x] Todas as 18 rotas carregam ou têm blocker documentado.
- [x] Todos os aliases críticos funcionam.
- [x] Cenário, risco, optimizer, trust, QA, release e export fecham o ciclo no caminho atual.
- [x] `empresa_mock` permanece claramente demonstrativa.
- [x] `empresa1`/`empresa2` permanecem protegidas.
- [x] Nenhum dado protegido aparece na UI pública, screenshot, log ou export indevido.
- [x] Mapa é local, responsivo, acessível e conectado ao provider.
- [x] Funcionalidades da `main` estão preservadas ou têm migração documentada.
- [x] Visual do HTML foi incorporado sem introduzir conteúdo sintético como evidência empresarial.
- [x] QA visual tem comparação full-view e focused-region.
- [x] `design-qa.md` está atualizado e termina com `final result: passed`.
- [x] Working tree e decisão de commit/push foram apresentados ao usuário.

## 18. Registro de execução

| Data | Executor | Branch/commit | Ambiente | Escopo | Resultado | Evidência |
|---|---|---|---|---|---|---|
| 2026-09-15 | Codex + subagentes | `integration/final-delivery` / `b66a889` + working tree | Chrome + Playwright, 1440 × 1000 | Suíte atual, E2E Network Intelligence, mapa e build protegido | Aprovado para a superfície local nova; gaps legados/externos seguem explícitos | `design-qa.md`, `qa-screenshots/`, saída dos testes |
| 2026-09-15 | Codex + Chrome real | `main` / `0114dab` × `integration/final-delivery` / `b66a889` | Chrome real, 1440 × 1000 e mobile 390 × 844, tenants protegidos | `empresa1` e `empresa2`: fluxo atual completo, quatro exports por tenant, lock, drawer mobile e auditoria lógica comparativa | Paridade semântica dos engines: aprovada; correções reproduzidas: export, foco e validação; cobertura legada manual e publicação Sites continuam gaps documentados | Análise 1 abaixo; nenhum segredo armazenado |

## 19. Análise 1 — Chrome real, empresas protegidas e paridade com `main`

Esta seção registra a execução solicitada após a análise do HTML de referência, da `main` e da branch `integration/final-delivery`.

### Execução real na branch de integração

- [x] Chrome real executou a branch atual em servidor HTTP local, sem depender de backend externo.
- [x] `empresa1` foi desbloqueada com a credencial de QA disponível apenas no ambiente local; overview, custos, rede/mapa, builder, simulação, risco, otimizador, trust/QA/release e export foram percorridos.
- [x] `empresa2` repetiu o mesmo fluxo protegido completo.
- [x] Os dois tenants chegaram ao estado final sem `console error`, `pageerror` ou `requestfailed`.
- [x] Os dois tenants exibiram badge `PROTECTED` e não expuseram caminho bruto, payload descriptografado, senha ou fixture `empresa_mock`.
- [x] O mapa local renderizou 27 estados e abriu drawer por clique; quando o provider não expôs UF, a interface manteve o rótulo de cobertura demonstrativa em vez de fabricar distribuição estadual.

### Comparação objetiva contra `main`

- [x] A auditoria lógica foi executada separadamente no commit `0114dab` de `main` e no estado atual da integração, para `empresa1` e `empresa2`.
- [x] As duas execuções retornaram `status: ok`.
- [x] `phase2` (baseline/custos), `phase4` (otimização) e `phase5` (decisão/QA/export) tiveram paridade semântica após ignorar somente campos voláteis: timestamp de geração e ID aleatório de cenário round-trip.
- [x] O determinismo dos engines, as validações adversariais e os estados de recomendação foram confirmados nos dois lados.
- [x] A integração acrescenta a camada visual, as rotas novas e o mapa local sem substituir os engines/providers da `main`.

### Perfil resumido dos dados reais auditados

- [x] `empresa1`: bundle protegido com 15 CDs ativos e 36 fluxos; o runtime foi recalculado durante a auditoria.
- [x] `empresa2`: bundle protegido com 4 CDs ativos e 76 fluxos; a cobertura fiscal limitada permaneceu classificada como limitação exploratória, sem virar zero fabricado.
- [x] Os valores financeiros completos não foram copiados para este checklist, screenshots ou documentação, preservando o boundary dos dados protegidos; a igualdade entre branches foi comparada programaticamente.

### Resultado e limites honestos

- [x] Resultado: para as duas empresas reais, os resultados dos engines batem semanticamente entre `main` e `integration/final-delivery`.
- [ ] “100% completo” do produto inteiro: a superfície local nova está aprovada após o reteste, mas permanecem itens fora do escopo seguro desta execução — todos os botões da interface legada em `main`, estados de provider com falha induzida, zoom 200%/400%, comparação focada de todos os screenshots contra o HTML e publicação Sites mediante autorização.
- [x] Achado P2/P3 corrigido: o botão `Dev` agora só aparece quando `dev=1`; a rota desconhecida também possui fallback explícito.

### 19.1 Reteste após as correções desta execução

- [x] Corrigida deduplicação de exportação por arquivo: Chrome real baixou os quatro arquivos de `empresa1` e `empresa2` em sequência; o double-click do mesmo arquivo continua deduplicado.
- [x] Corrigido trap de foco do drawer: elementos `position: fixed` não são descartados por `offsetParent=null`; `Tab` permanece no drawer e `Escape` fecha mesmo após a tabulação.
- [x] Corrigida validação explícita de formulários: `freight_multiplier=0` é bloqueado com toast; `inventory_days=0`, `wacc=0` e `seed=0` seguem válidos e são encaminhados ao engine.
- [x] Chrome real protegido: `empresa1` e `empresa2` chegaram ao trust/QA/release, mapa com 27 estados, quatro exports por tenant, zero `console error`, zero `pageerror` e zero `requestfailed`.
- [x] Corrigida a fronteira de exportação protegida: JSON/HTML/CSV passam por projeção sanitizada; chaves de fluxo, baseline bruto, `core_data`, caminhos de tenant, segredos e campos arbitrários de linhas não são exportados.
- [x] Chrome real reabriu os quatro artefatos de `empresa1` e `empresa2` e confirmou estrutura/nomes sem marcadores protegidos.
- [x] Paridade ampliada na nova UI: analítica de volume/distância, sete visões de risco, controles de incerteza/stress/sensibilidade/matriz, seleção na comparação, retorno do risco avançado e períodos fiscais.
- [x] Chrome real executou os cinco perfis do otimizador em `empresa1`: Balanceado, CFO, Supply, Fiscal e Conservador.
- [x] Chrome real confirmou seleção/deseleção de CD, bloqueio de `tax_mode=disabled` e isolamento após reset do cenário.
- [x] Confirmação final no Chrome real: `CHROME_FINAL_PROTECTED_MATRIX_OK` para `empresa1` e `empresa2`; suíte do projeto: `ALL_PHASE5_PACKAGE_TESTS_OK`.
- [x] Chrome confirmou `mock=off` e tenant inexistente sem carregar `data-demo`; ambos seguem a política protegida/fallback definida.
- [x] Chrome confirmou que a ausência de UF explícita nos fluxos de `empresa1` e `empresa2` mantém o mapa marcado como cobertura demonstrativa, sem inventar geografia observada.
- [x] Evidência visual: 18 screenshots de rota, drawer, trust/release, mapa, dev console e mobile estão em `qa-screenshots/`; nenhum screenshot contém tenant protegido.

**Conclusão da Análise 1:** a branch de integração preserva a lógica da `main` para `empresa1` e `empresa2` e entrega o novo visual funcional no caminho principal. A equivalência dos resultados está confirmada e os problemas reproduzidos nesta execução foram corrigidos e retestados. A única pendência não-P1 é a cobertura adicional da interface legada, zoom, comparação visual completa e publicação externa; ela não é mascarada como concluída.

## Regra de encerramento

Não marcar o site como “100% completo” apenas porque a suíte automatizada passou. A aprovação final exige a execução das rotas, jornadas, tenants, estados visuais, responsividade, segurança e comparação de screenshots listados acima; qualquer item não executado deve permanecer desmarcado e aparecer como gap explícito.
