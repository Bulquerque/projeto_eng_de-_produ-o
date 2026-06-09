# Diretrizes e Padrões de Código (Code Standards)

Este documento estabelece as diretrizes de desenvolvimento, regras de estilo e boas práticas para manter a qualidade, robustez e manutenibilidade do código do projeto.

---

## 1. Regra Geral de Qualidade

Seguimos princípios rigorosos de desenvolvimento:
* **Clareza antes de esperteza:** Prefira um código explícito e simples a soluções excessivamente complexas ou abstrações precoces.
* **Integridade nos Testes:** Nunca simule ou invente resultados de testes. Se um comportamento falha, ele deve falhar visivelmente.
* **Ausência de placeholders:** Não use comentários como `// TODO: implementar depois` ou códigos fictícios para fingir funcionalidade.

---

## 2. Padrões de JavaScript

A base de código do front-end é construída com JavaScript puro (Vanilla JS) usando módulos ES6.

### Estilo e Formatação
* **Formatador:** Prettier (configuração em `.prettierrc`).
* **Linter:** ESLint (configuração em `.eslintrc.json`).
* **Regras básicas:**
  * Uso obrigatório de ponto e vírgula `;`.
  * Indentação de 2 espaços (sem tabulações).
  * Strings com aspas simples `'`.
  * Linhas com limite de 100 caracteres.
  * Uso estrito de `const` e `let`. A palavra-chave `var` é terminantemente proibida.

### Boas Práticas de Implementação
* **Arquitetura de Módulos:** Toda lógica compartilhada deve ser encapsulada em módulos e exposta via `export`. Evite criar variáveis globais no objeto `window`.
* **Tratamento de Erros:** Funções assíncronas (`async`/`await`) devem ser protegidas por blocos `try/catch`. Capturas de erro devem emitir mensagens claras ou logs estruturados para auditoria (ex: através do `debug-tools.js`).
* **Responsabilidade Única:** Mantenha funções pequenas e com uma única responsabilidade clara.

---

## 3. Padrões de Python

Os scripts auxiliares em `etl/`, `tests/` e geradores usam Python 3.10+.

### Estilo e Formatação
* **Ferramenta unificada:** Ruff (configurado em `pyproject.toml`). O Ruff substitui `black`, `flake8` e `isort`.
* **Regras básicas:**
  * PEP 8 estrito.
  * Comprimento de linha máximo de 120 caracteres.
  * Uso de aspas simples `'` por padrão.
  * Organização automática de imports (`isort` integrado).

### Boas Práticas de Python
* **Tipagem:** Utilize anotações de tipo em funções críticas sempre que possível para melhorar a legibilidade e detecção de bugs estáticos.
* **Tratamento de Exceções:** Evite cláusulas `except Exception: pass`. Caso precise omitir um erro específico, faça-o capturando a exceção específica e comentando o motivo.
* **Portabilidade de Caminhos:** Sempre use a biblioteca `pathlib` (ex: `Path(__file__)`) em vez de manipulação de strings com caminhos absolutos ou relativos.

---

## 4. Padrões de CSS e HTML

* **CSS Limpo:** Use variáveis nativas do CSS (`--color-primary`, `--font-main`) no arquivo `assets/styles.css` para garantir uma identidade visual consistente.
* **HTML Semântico:** Utilize tags HTML5 adequadas (`<header>`, `<main>`, `<section>`, `<article>`) para estruturar as páginas de cada fase.
* **Identificadores Únicos:** Elementos interativos importantes e botões devem possuir IDs únicos e descritivos para facilitar os testes automatizados (Playwright).

---

## 5. Como Executar as Checagens Localmente

Antes de enviar qualquer código, execute as validações locais:

### Validar JavaScript (ESLint e Prettier)
```bash
# Instalar ferramentas de desenvolvimento na primeira execução
npm install

# Checar formatação e linting
npm run lint:js
npm run format:js:check

# Corrigir automaticamente problemas cosméticos
npm run format:js:write
```

### Validar Python (Ruff)
```bash
# Rodar o linter Ruff
ruff check .

# Formatar automaticamente o código Python
ruff format .
```
