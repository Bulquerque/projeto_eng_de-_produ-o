# Core JS

Este diretório contém a única camada de utilitários compartilhados do runtime.

Os módulos de domínio e seus entrypoints ficam em `assets/js/phase1/` a `assets/js/phase5/`. Todos importam daqui.

Use este diretório como referência para novas funções compartilhadas e para reduzir acoplamento entre fases.

`evidence-quality-engine.js` é a camada compartilhada de proveniência e suporte
da evidência. Ela classifica cada componente como observado, parcialmente
observado, proxy, fallback, parâmetro, projeção ou reconciliado. O relatório de
evidência é descritivo e pode bloquear uma recomendação forte, mas não altera
valores do modelo nem fabrica intervalos estatísticos.
