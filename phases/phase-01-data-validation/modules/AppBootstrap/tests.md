# Testes

```json
{
  "unit": [
    "initApp cria estado inicial com empresa1",
    "showFatalError não deixa a página em branco"
  ],
  "integration": [
    "site abre via http.server",
    "todos os artefatos da Fase 1 são carregados"
  ],
  "manual": [
    "abrir / e confirmar que os painéis aparecem",
    "abrir /fase-1-validacao/ e confirmar que redireciona/mostra o mesmo app"
  ],
  "acceptance": [
    "não usa path absoluto",
    "não quebra se um painel tiver warning"
  ]
}
```
