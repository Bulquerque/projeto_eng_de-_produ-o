# Assets do site estático

`index.html` carrega [`js/app/main.js`](js/app/main.js), que inicia a shell da
Network Intelligence. A interface é dividida em módulos por área, serviços,
providers, visualizações e utilitários compartilhados.

```text
js/app/                   # shell, navegação, páginas e providers
js/app/chart-pipeline.js   # despacho dos gráficos por rota
js/app/presentation/       # rótulos de status, evidência e robustez
js/app/cost-components.js  # componentes de custo compartilhados
js/core/                  # serviços e utilitários compartilhados
js/phase1..5/             # engines e módulos de domínio das fases
styles.css                # estilos globais
```

Os diretórios por fase não são entrypoints carregados diretamente pela página
principal. Antes de mover ou remover qualquer módulo, confira seus imports,
providers e contratos de compatibilidade.
