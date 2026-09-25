# Relatório final de QA do Site — 25/09/2026

## Parecer

**Apto para entrega com ressalvas.** A branch de entrega foi commitada e sincronizada com o GitHub; o Site público recebeu a versão 16; a suíte de qualidade completa passou; e a navegação publicada confirmou que o item principal permanece verde claro em rotas internas de Cenários e Dados & confiança.

As ressalvas são a indisponibilidade da inspeção de Console/Network do Chrome nesta sessão e a falta de emulação responsiva na URL publicada. A suíte local cobre erros de Console/requisições em desktop e o viewport 390×844, mas essa evidência não substitui a verificação do deploy real.

## GitHub e Sites

- Repositório GitHub: `Bulquerque/projeto_eng_de-_produ-o`.
- Branch sincronizada: `integration/final-delivery`.
- Commit GitHub: `83db80b2faef317b9d3a71f3d155cd0b48059d89`; `git ls-remote` confirmou o mesmo SHA na branch remota.
- Site público: [Visagio · Simulador Logístico](https://visagio-logistica.gptgrupo-especial.chatgpt.site/).
- Sites versão **16**, associada ao commit do repositório de fonte do próprio Site `51e995bb052b4f7811bbed33bc7ef679683b2bc4`.
- Deploy `appgdep_6ab67e5d3b788191b0c8676a27b07821`: status `succeeded`.
- O arquivo de publicação contém 142 arquivos, com HTML, módulos JS/CSS e somente fixtures demonstrativas `data-demo/empresa_mock`. A auditoria do archive não encontrou `.env`, planilhas, fontes brutas, dados de `empresa1`/`empresa2`, ZIPs, Python ou blobs `.enc.json`.

O projeto GitHub e o repositório de fonte do Sites são históricos separados; o commit próprio do Sites identifica precisamente o pacote publicado. O archive foi montado a partir de `dist/client`, evitando enviar o `dist` local completo, que contém material fora do escopo público da demonstração.

## Verificações executadas

| Área | Resultado |
|---|---|
| Qualidade local | `npm run quality` passou, incluindo lint/format, testes de fases, regressão, apresentação, Network Intelligence e `ALL_PHASE5_PACKAGE_TESTS_OK`. |
| Menu em `scenarios/build` | A página abriu e o item **Cenários** apareceu com o fundo verde claro de seleção. |
| Subrota `scenarios/compare` | Conteúdo e subnavegação abriram; a captura do Site publicado confirmou **Cenários** ainda selecionado em verde claro e **Comparar** selecionado na navegação interna. |
| Subrota `trust/methodology` | Conteúdo e subnavegação abriram; a captura confirmou **Dados & confiança** ainda selecionado em verde claro e **Metodologia** selecionada na navegação interna. |
| Otimizador | `optimizer/configure` abriu com formulário, valores e ação **Rodar busca** visíveis. Não executei essa ação no deploy nesta rodada. |
| Dados de demonstração | O Site carregou como `Empresa Falsa · MOCK`; o cenário e os valores exibidos estavam identificados como demonstrativos. |
| Pacote público | Archive inspecionado antes de salvar a versão; contém `dist/.openai/hosting.json`, `dist/index.html` e fixtures demo, sem caminhos ou extensões de dados protegidos na lista de bloqueio. |

## Ressalvas restantes

1. **Console e rede do Site publicado:** o Browser interno usado nesta sessão não expõe essas APIs. A tentativa autorizada de abrir a sessão Playwright MCP foi bloqueada porque a instância Chrome já estava ocupada. Portanto, não afirmo ausência de erros de Console/Network no deploy.
2. **Responsividade no deploy:** não consegui emular 390×844 na sessão publicada. O Playwright local passou e inclui contexto 390×844, mas a checagem mobile pública continua pendente.
3. **Ações no Site:** nesta validação ao vivo percorri os menus e conferi os estados; não cliquei em todas as ações, nem rodei todos os fluxos de formulário na produção. A suíte local passou, mas isso não é uma auditoria manual exaustiva de todos os botões publicados.

## Conclusão para a entrega acadêmica

O problema visual dos menus foi corrigido e confirmado no Site público após o deploy. A versão publicada está sincronizada com seu próprio commit de fonte e o commit do código está no GitHub. Para a submissão, recomendo apontar para a branch `integration/final-delivery` ou para o commit `83db80b`; confirme que o professor tem acesso ao link público acima. A classificação permanece **com ressalvas** até haver uma oportunidade de inspecionar Console/Network e viewport mobile na versão publicada.
