# Relatório de QA do Site publicado — 25/09/2026

## Escopo e veredito

Foi feita uma navegação manual read-only na URL pública do Site com `company=empresa_mock`, além de consulta ao estado de versões e aos logs do Sites. Foram abertas as 18 rotas da Network Intelligence. Também foram executados dois fluxos demonstrativos: simulação de cenário e execução do pipeline do otimizador até QA/release.

**Veredito: com ressalvas; não declarar a versão pública sincronizada com o checkout atual nem pronta sem ressalvas para a avaliação.** A UI local passa a suíte completa, mas o endereço público ainda serve uma versão anterior e reproduz o problema de destaque do item pai no menu.

## Evidências da publicação e do Git

- Sites informa o projeto ativo `Visagio · Simulador Logístico`, versão mais recente salva **v15**, commit `052a7748b24ca6d3b483a735a06bf296cb235a5c`, arquivo com 201 itens e sem `deployment_id`.
- A **v14** aponta para `661672819ea0bbbeac7c3450f3c1cb33e8823d0f` e tem implantação concluída (`succeeded`) na URL pública do projeto. A evidência do Sites indica que a live continua na v14; v15 está salva, mas não publicada.
- A branch local `integration/final-delivery` e `origin/integration/final-delivery` coincidem em `6d8872115a54e143b56fd7d1ba98ab7b7f649f3f`. O checkout, porém, contém modificações e arquivos ainda não rastreados.
- Os commits informados pelo Sites não estão presentes como objetos Git na cópia local, então não foi possível fazer comparação arquivo a arquivo ou afirmar paridade de conteúdo. **Checkout, GitHub e live não estão sincronizados no estado atual.**

## Navegação e fluxos observados

| Grupo | Rotas abertas | Resultado observado |
|---|---|---|
| Visão executiva | `overview/summary`, `overview/network`, `overview/costs`, `overview/tax` | As quatro páginas renderizaram conteúdo e navegação da seção; sem overlay de carregamento persistente ou erro visível. |
| Cenários | `scenarios/build`, `result`, `compare`, `risk`, `risk/advanced` | As cinco rotas renderizaram conteúdo e subnavegação. O botão **Simular cenário** da fixture levou a Resultado com estado `SUCCESS`, custos e Evidence identificados como demonstrativos. |
| Otimizador | `optimizer/configure`, `results`, `tradeoffs` | Formulário e páginas de resultado disponíveis. **Rodar busca** concluiu o pipeline e abriu Validação. |
| Dados e confiança | `trust/overview`, `evidence`, `sources`, `validation`, `methodology` | As cinco páginas abriram. A Validação exibiu `Final QA PASSED`, release `demo_only`, audit trail da fixture e opção de download. |
| Desenvolvimento | `dev/console` | A rota abriu e mostrou “Console indisponível”; o próprio conteúdo informa que o console técnico está desabilitado neste runtime. Não tratei isso como falha de carregamento. |

## Pontos de atenção

1. **Menu principal:** nas capturas de `scenarios/compare` e `trust/validation`, o item pai correspondente na lateral não recebeu o fundo verde claro de seleção; a subaba da rota atual apareceu selecionada em branco. Isso reproduz no Site publicado o problema informado pelo usuário. O ajuste existente no checkout ainda não chegou à live.
2. **Versão publicada:** a última versão salva não tem implantação; a página pública está associada à v14. A v15 precisa ser publicada e novamente verificada para que seus ajustes cheguem ao professor. Esta auditoria não publicou nem alterou Sites.
3. **Console/rede do navegador:** o CUA permitiu navegação e capturas, mas não expôs Console/Network. A chamada autorizada ao Playwright MCP falhou porque a instância do browser estava ocupada. O Sites Worker não reportou eventos de erro nos 30 minutos após os fluxos testados; isso não substitui a inspeção do console e da rede do cliente.
4. **Responsividade da live:** não foi possível emular 390×844 na sessão do Browser. O E2E local cobre 390×844; essa evidência é da cópia local, não da publicação v14.
5. **Dados protegidos:** só foi usada a empresa mock. O QA não abriu dados protegidos nem tentou desbloqueio.

## Próximo gate antes da entrega

- Publicar somente após decisão explícita do responsável; em seguida validar que a URL está na versão pretendida.
- Repetir no Site publicado o destaque da navegação principal, o fluxo de cenário e a decisão final.
- Rodar inspeção de Console/Network e viewport 390×844 no ambiente publicado quando a sessão de browser estiver disponível.
- Confirmar que o commit/deployment publicado corresponde exatamente ao artefato que será avaliado.

## Limites desta rodada

Os estados observados vieram da navegação pública em desktop e da fixture `empresa_mock`. A rodada percorreu todas as rotas, mas executou apenas os fluxos de simulação e decisão; não clicou em todos os controles do inventário. Logs sem erros não provam ausência de erros no cliente. O navegador CUA capturou as telas de comparação e validação durante a rodada, mas não foi possível gravar essas capturas como arquivos locais nesta sessão.

Capturas e checklist de uma rodada local anterior estão arquivados em [evidências visuais históricas](historico/2026-09-13_15_network-intelligence/README.md); elas não substituem as observações deste relatório nem representam o Site público de 25/09.
