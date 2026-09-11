# Referências e fontes brutas

Esta pasta preserva os arquivos enviados e usados como origem.

```text
raw_sources/      # XLSX, PDF, PPTX, ZIP e CSV originais
source_documents_manifest.csv
```

Esses arquivos são rastreabilidade. O site estático consome os dados tratados em `data/`.

Antes de publicar o repositório, confirme a autorização de compartilhamento dos arquivos
em `raw_sources/`: eles estão em formato original e não recebem a proteção criptográfica
aplicada aos dados operacionais em `data/empresa1/` e `data/empresa2/`. O manifesto de
fontes deve ser consultado para distinguir fontes independentes de cópias byte a byte.

Atualmente `Analise_Malha_Empresa2(1).xlsx` e `Análise Malha Logística - vCaracol(3).xlsx`
possuem o mesmo SHA-256; a segunda é uma referência/alias documental, não uma observação
independente.
