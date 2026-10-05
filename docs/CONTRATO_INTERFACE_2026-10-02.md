# Contrato da interface

Decisão do agente principal, anterior à implementação delegada.

## Navegação

- Visão geral: `/network/overview/{summary,network,costs,tax}`. Retrato da operação de referência, sem recomendação ou resultado futuro.
- Simulação: `/network/scenarios/build`. Editar parâmetros; resultado somente após executar.
- Recomendações: `/network/optimizer/configure`. Perfil e limites essenciais; opções técnicas em `details` fechado.
- Resultados: `/network/results/{summary,comparison,tradeoffs,risk,risk/advanced}`. Casa única de simulação, ranking, seleção e risco. Links antigos são aliases.
- Dados e metodologia: `/network/trust/*`. Acesso secundário, com cobertura fiscal, evidência, método e validações distintas.

## Contexto e execução

Empresa e cenário ativo são selecionados somente no cabeçalho. Trocar cenário carrega um rascunho em Simulação; não executa automaticamente. Uma opção Referência substitui o rascunho inteiro. Não duplicar seletores de presets no formulário.

`ui.scenario_draft` contém `scenario_name` e `changes` do formulário, `ui.scenario_dirty` indica edição. Edições invalidam TODOS os derivados, inclusive optimizer, auditoria e export. `meta.result_kind` é `simulation` ou `optimization` após execução. Navegar preserva rascunho. Trocar empresa limpa tudo e operações antigas não podem comitar.

Formulários mantêm IDs `niScenarioForm`, `niOptimizerForm`, `niRiskForm` e nomes de parâmetros do parser. Ações mantêm contratos de bindings. Novas ações devem ser comunicadas ao principal antes de serem usadas.

## Visual e conteúdo

Preservar petróleo `#00363d`, menta `#a9fdac`, âmbar `#f2b84b`, superfícies claras e base existente. Uma H1 por tela, sem eyebrow redundante ou herói explicativo. Preferir linhas de métricas, divisórias e tabelas. Sem IDs, enums, implementação ou texto metalinguístico na leitura principal. Dados indisponíveis são `—`, nunca zero fabricado.

Rotular estados em português por `businessLabel` de `view-helpers.js`. Demonstração aparece uma vez no contexto. Preservar aviso específico quando necessário para impedir interpretar amostras como simulações executadas.

## Responsabilidades

Principal: arquitetura, roteador, shell, estado, controller, bindings, integração, testes globais e publicação.
Luna UX: páginas e renderer de resultados dentro deste contrato.
Luna dados: provider demo e testes desse contrato; nenhum motor novo.
Luna visual: CSS existente e estilos dos componentes acordados, sem mudança de paleta.
