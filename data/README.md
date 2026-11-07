# Dados do simulador

Esta pasta reúne catálogos públicos, contratos, complementos, derivados e
envelopes criptografados usados pelo site estático. Use caminhos relativos para
manter o carregamento compatível com `python -m http.server`.

```text
data/
├── catalog.json                 # catálogo lido pela aplicação
├── data_quality_summary.json    # resumo de qualidade dos dados
├── encrypted_manifest.json     # inventário dos envelopes criptografados
├── release-manifest.json        # proveniência do pacote de dados
├── contracts/                   # contratos e esquemas dos dados
├── complements/                 # dados auxiliares por domínio
├── debug/                       # amostras e evidências de diagnóstico
├── empresa1/                    # dados derivados e exports protegidos
├── empresa2/                    # dados derivados e exports protegidos
├── tax/                         # referências e resultados tributários
└── validation/                  # evidências e relatórios de validação
```

Os diretórios de empresa podem conter dados sensíveis protegidos por
criptografia. Não os descriptografe para publicação nem trate o fato de um
arquivo estar criptografado como prova de que outros derivados são públicos.
Confira os manifestos, a proveniência e as regras de `.gitignore` antes de
compartilhar ou gerar pacotes. As referências-fonte gerais ficam em
[`../references/`](../references/), fora de `data/`.
