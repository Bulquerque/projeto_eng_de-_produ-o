# Referências e fontes brutas

Esta pasta preserva os arquivos enviados e usados como origem.

```text
raw_sources/      # envelopes .enc.json; os arquivos originais ficam fora do Git
source_documents_manifest.csv
```

Esses arquivos são rastreabilidade. O site estático consome os dados tratados em `data/`.

Os arquivos desta pasta são envelopes AES-GCM individuais. Os arquivos originais
ficam fora do repositório público e devem ser preservados somente em armazenamento
local autorizado. O manifesto mantém o nome, o hash e o tamanho do plaintext para
rastreabilidade, além do caminho e hash do envelope criptografado.

Esta pasta não faz parte do pacote público do site. A senha fica somente em
`VISAGIO_DATA_PASSWORD`/`.env.local` e nunca deve entrar no Git, em relatórios ou
em artefatos de entrega. Para verificar os envelopes localmente, use
`python scripts/manage_reference_sources.py verify`.

Atualmente `Analise_Malha_Empresa2(1).xlsx` e `Análise Malha Logística - vCaracol(3).xlsx`
possuem o mesmo SHA-256; a segunda é uma referência/alias documental, não uma observação
independente.
