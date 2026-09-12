# Manual de Contexto para Agentes de IA

Bem-vindo ao desenvolvimento do **Visagio Static Simulator**. Este documento serve como um mapa de contexto arquitetural detalhado para que agentes de IA e modelos de linguagem possam atuar na base de código com segurança, sem cometer erros de regressão ou corromper dados.

---

## 1. Visão Geral da Arquitetura

O simulador é estruturado em módulos independentes organizados por fases e utilitários compartilhados:

```text
/
├── index.html                      # Página principal (validação Fase 1)
├── fase-1-validacao/               # Validação e integridade de dados iniciais
├── fase-2-baseline/                # Análise de Baseline e Paridade
├── fase-3-cenarios/                # Simulador de Cenários Logísticos Manuais
├── fase-4-score-otimizador/        # Otimizador de Cenários (Algoritmo Genético/Procura Leve)
├── fase-5-entrega-final/           # Dashboard executivo, stress-tests e auditorias finais
│
├── assets/js/
│   ├── core/                       # Única camada de módulos compartilhados
│   ├── debug/                      # Debug Center para testes e auditorias em tempo de execução
│   └── phase1/2/3/4/5/             # Entrypoints e módulos de domínio por fase
```

---

## 2. O Fluxo de Dados e Criptografia

Um dos pontos mais críticos do projeto é a carga e descriptografia dos dados das empresas:

1. **Fontes Arquivadas:** Os envelopes criptografados das fontes originais estão em `references/raw_sources/`; os arquivos plaintext ficam fora do repositório público.
2. **Dados Criptografados:** Durante a compilação, o script ETL criptografa os JSONs de dados e os salva em `data/empresa1/` e `data/empresa2/` com a extensão `.enc.json`.
3. **Mapeamento de Entrada:** O arquivo `data/encrypted_manifest.json` descreve a correlação entre o caminho original do arquivo e o arquivo criptografado gerado.
4. **Carregamento (Data Loader):** O arquivo `assets/js/core/data-loader.js` lê o manifesto e chama `assets/js/core/crypto-session.js`.
5. **Prompt de Senha:** O `crypto-session.js` solicita a frase de acesso ao usuário, mantém a senha e as `CryptoKey` somente em memória durante a aba atual, faz a derivação da chave AES-GCM (usando o PBKDF2HMAC) e descriptografa o conteúdo no navegador. A senha nunca é gravada no `sessionStorage`; após recarregar a página, o desbloqueio é solicitado novamente.

> [!WARNING]
> Nunca tente alterar arquivos `.json.enc` diretamente sem sincronizar com o script de ETL ou scripts de geração. Se precisar regenerar dados de teste, use os utilitários apropriados em `etl/` ou execute checagens na suíte de testes.

---

## 3. Estrutura e Orquestração de Testes

Os testes são divididos em 11 pastas temáticas (`00` a `10`) e orquestrados por `tests/run_all_tests.py`.

### Resumo dos Módulos de Testes
* `tests/00_basicos/`: Presença física dos arquivos requeridos no simulador e regras de Code Standards.
* `tests/01_paths_auditoria/`: Verifica se as chaves e caminhos das tabelas coincidem com o mapeamento e auditorias tributárias.
* `tests/02_fase1_frontend/` a `tests/08_fase5_entrega_final/`: Testam a integridade dos scripts de lógica de cálculo (Node.js) e servidores locais HTTP de cada fase específica.
* `tests/10_presentation_e2e/`: Executa testes de interface visual automatizados em Playwright para certificar que o fluxo da banca examinadora está totalmente verde.

---

## 4. Dicas de Debug e Resolução de Problemas para IAs

* **Arquivos Estáticos e Cache:** O simulador usa `fetch(..., { cache: "no-store" })`. Ao fazer alterações em arquivos de dados e testar no navegador, certifique-se de limpar o cache da sessão clicando no botão "Bloquear dados" no canto inferior direito da tela.
* **Imports Relativos:** Ao importar novos arquivos JS nas pastas das fases, prefira caminhos relativos para `assets/js/core/` e mantenha cada `main.js` como entrypoint direto da própria fase.
* **Erros de Tipagem no Python:** Sempre utilize `from __future__ import annotations` se estiver trabalhando com recursos de tipagem modernos do Python em arquivos ETL/Testes, e rode `ruff check .` para garantir conformidade estática.
* **Playwright opcional:** Lembre-se de que os testes E2E do Playwright podem não rodar se o ambiente host não possuir um navegador instalado. O script `tests/run_all_tests.py` está configurado para passar mesmo assim, desde que os testes estruturais e lógicos passem.
