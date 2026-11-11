# Auditoria e handoff TCC Implementation Plan

**Goal:** Auditar o simulador, corrigir problemas verificáveis e produzir evidência rastreável para revisão acadêmica.

**Architecture:** Preservar main e dados originais; trabalhar em branch isolada a partir de a7e4a1d7a95ae23dcdc9168be3fea3095ff61532. Separar resultados observados, ancorados, exploratórios e bloqueados; gerar pacote compartilhável somente com dados permitidos e validar independentemente.

**Tech Stack:** JavaScript ES modules, Python, testes existentes, Git e ZIP.

**Spec:** PLANO_MESTRE_AGENCIA_CODIGO_TCC_VISAGIO_V2.md fornecido pelo usuário, incluindo adendo V2.

## Etapas e gates

1. Congelar versão, inventariar fontes e estabelecer testes de referência; não expor segredos.
2. Investigar C01–C15 e H1–H12, priorizando ancoragem, transferência, WACC e fiscal; corrigir somente com evidência de causa e testes de regressão, registrar lacunas sem imputar dados.
3. Implementar Monte Carlo pareado com choques iguais no baseline e alternativa, testes de identidade e reprodutibilidade e identificação do método legado.
4. Executar pipeline privado com fontes acessíveis, distinguir cenários equivalentes e hipóteses não validadas, gerar resultados após alterações e registrar impedimentos.
5. Construir ZIP de handoff com registry, manifestos, guias e evidências disponíveis; validar estrutura, integridade e ausência de informação sensível em processo independente. Qualquer P0 sem evidência bloqueia alegações numéricas finais.
6. Rodar testes pertinentes e verificar diferenças; publicar branch/PR e atualizar site apenas quando mudanças e gate de dados públicos estiverem prontos, com rastreabilidade de versão.

## Revisão prioritária

- Baseline e alternativa com mesmas premissas, ano e choque.
- Fontes indisponíveis não são confundidas com zero ou resultado sintético.
- Custos físicos e fiscais têm unidades, abrangência e proveniência explícitas.
- Ranking parcial não é apresentado como ótimo global.
- Arquivos protegidos, segredos e dados comerciais não entram em Git ou ZIP compartilhável.
