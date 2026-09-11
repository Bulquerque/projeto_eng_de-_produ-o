import fs from 'node:fs/promises';
import path from 'node:path';
import { access } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

async function loadArtifactTool() {
  const candidates = [];
  if (process.env.VISAGIO_ARTIFACT_TOOL_PATH) {
    candidates.push(process.env.VISAGIO_ARTIFACT_TOOL_PATH);
  }
  candidates.push(path.join(root, 'node_modules/@oai/artifact-tool/dist/artifact_tool.mjs'));
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return import(pathToFileURL(candidate).href);
    } catch {
      // Try the next explicitly supported installation location.
    }
  }
  throw new Error(
    'Dependência de planilha ausente. Instale @oai/artifact-tool no projeto ou defina VISAGIO_ARTIFACT_TOOL_PATH com um caminho local válido; nenhum caminho absoluto do ambiente é usado automaticamente.'
  );
}

const { Workbook, SpreadsheetFile } = await loadArtifactTool();
async function copyOptionalInput(inputPath, outputPath, label) {
  try {
    await fs.copyFile(inputPath, outputPath);
    return { label, status: 'copied', path: inputPath };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await fs.writeFile(
      outputPath,
      `Recurso opcional não disponível nesta execução: ${label}.\n` +
        'O pacote foi gerado sem esse anexo textual; consulte references/raw_sources e o manifesto de fontes.\n',
      'utf8'
    );
    return { label, status: 'not_available' };
  }
}
const outDir = path.join(root, 'entregaveis', 'pacote_relatorio_visagio_2026-09-10');
await fs.mkdir(outDir, { recursive: true });
const evidence = JSON.parse(
  await fs.readFile(path.join(root, 'entregaveis/evidence.json'), 'utf8')
);
const p = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const brl = (v) =>
  p(v) == null
    ? 'n.a.'
    : `R$ ${p(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const e1 = evidence.companies.empresa1,
  e2 = evidence.companies.empresa2;

const statusRows = [
  [
    '1',
    'Reconciliar Tabela 7 e savings',
    'Corrigido nos dados deste pacote; a fonte anterior tinha números incompatíveis.',
    'Alta',
    'Usar published_scenarios e fórmula saving = (baseline - cenário) / baseline.',
  ],
  [
    '2',
    'Definir papel do Monte Carlo',
    'Corrigido no pacote: módulo funcional, exploratório e reprodutível por seed.',
    'Alta',
    'Documentar iterações, seed, perfil e não misturar com números determinísticos.',
  ],
  [
    '3',
    'Dependência do estoque de CDs',
    'Confirmado: custo idêntico com 1 e todos os CDs sob os mesmos drivers.',
    'Alta',
    'Manter Escolha B e retirar alegação de pooling de risco.',
  ],
  [
    '4',
    'Calibração cruzada de transferência E1',
    'Confirmada e explicitamente marcada como proxy de engenharia da E2.',
    'Alta',
    'Não chamar de tarifa observada da Empresa 1.',
  ],
  [
    '5',
    'Desvio de baseline',
    'Verificado: E2 operacional alinhada; diferença tributária de fonte de 1,97%; E1 não tem benchmark externo no conjunto fornecido.',
    'Alta',
    'Incluir tabela de paridade e declarar a diferença de fonte como dado, não como erro de software.',
  ],
  [
    '6',
    'Pesos w1-w5',
    'Executado em quatro perfis; E1 mantém o mesmo candidato; E2 muda entre perfil custo e demais.',
    'Média',
    'Reportar sensibilidade da recomendação, não só um ranking.',
  ],
  [
    '7',
    'Fallbacks',
    'Parâmetros centralizados no model-configuration.js; frequência por cenário foi exportada.',
    'Média',
    'Descrever 2,5%, 40% e 0,005 R$/kg-km.',
  ],
  [
    '8',
    'Fixo/variável de armazenagem',
    'Dado de decomposição fixa/variável não está presente na base; o fallback proporcional está identificado.',
    'Média',
    'Marcar como hipótese de engenharia baseada na ausência do dado.',
  ],
  [
    '9',
    'Duplicidade core/tax',
    'Verificado: os arquivos atuais são usados pelo orquestrador; não há código morto comprovado neste item.',
    'Média',
    'Não remover. A crítica do plano está desatualizada em relação ao checkout atual.',
  ],
  [
    '10',
    'Justificar não uso de MILP',
    'A justificativa está no referencial; deve ser antecipada e alinhada à enumeração discreta.',
    'Baixa',
    'Usar “melhor cenário na busca avaliada”, salvo espaço exato.',
  ],
  [
    '11',
    'Proxy tributário E1',
    'Já sinalizado na camada de dados/runtime; precisa aparecer nas tabelas do relatório.',
    'Baixa',
    'Adicionar coluna Fonte/status tributário.',
  ],
  [
    '12',
    'Revisão final do relatório',
    'Necessária após incorporar os números deste pacote.',
    'Alta',
    'Revisar texto, tabelas, figuras, equações e sumário.',
  ],
];

const csv = (rows) =>
  rows
    .map((row) =>
      row
        .map((x) => {
          const s = String(x ?? '');
          return /[;,\n"]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
        })
        .join(';')
    )
    .join('\n') + '\n';
await fs.writeFile(
  path.join(outDir, 'matriz_plano_trabalho.csv'),
  csv([['id', 'item', 'status_atual', 'prioridade', 'acao_para_relatorio'], ...statusRows]),
  'utf8'
);

const taxAudit = `# Auditoria tributária profissional do simulador

## Conclusão

A camada tributária foi reforçada e está tecnicamente adequada para simulação exploratória de cenários logísticos, com ledger por fluxo, componentes CBS/IBS/IS/créditos, cobertura, fonte, período e método. Ela não é uma apuração fiscal oficial porque os dados fornecidos não contêm, para todos os fluxos, a combinação completa de origem, destino, receita, NCM, CFOP, CST, regime e documentos de entrada necessários para cálculo de créditos e regras específicas.

## Tributos atuais

O motor preserva o valor atual como carga efetiva agregada para manter a reconciliação com o baseline. Quando a fonte fornece os campos, o ledger também registra ICMS, ICMS-ST, IPI, PIS, Cofins e ISS separadamente. Campos inexistentes não são preenchidos com zero: permanecem ausentes e o resultado informa a cobertura. Essa decisão impede que ausência de dado seja confundida com inexistência do tributo.

## Reforma

O motor contém CBS, IBS, Imposto Seletivo e créditos, com cálculo por fluxo e quebra por destino/categoria. As taxas numéricas são parâmetros de cenário, não alíquotas efetivas oficiais por operação. O Imposto Seletivo só pode incidir quando o fluxo é classificado como seletivo. Créditos são uma aproximação por categoria até que existam documentos e regras de crédito por aquisição.

## Cronograma utilizado

2026 é ano-teste de CBS 0,9% e IBS 0,1%, com compensação conforme as regras aplicáveis. Em 2027 e 2028, CBS/IBS entram no período inicial, PIS/Cofins são extintos, o IPI é reduzido a zero salvo exceções da ZFM e o IS é instituído. De 2029 a 2032, IBS substitui gradualmente ICMS/ISS em 10%, 20%, 30% e 40%. Em 2033, o novo modelo vigora integralmente. Fonte: Receita Federal.^1

## Dados intermediários

O fluxo fiscal carrega origem, destino, receita, categoria, NCM, CFOP, CST, base de crédito, elegibilidade, regime, método de cálculo, origem da taxa e confiança da fonte. A qualidade registra fluxos de entrada, elegíveis, receita, origem, classificação fiscal completa, proxies e exclusões. Na rodada atual, a cobertura fiscal completa permanece zero nas duas empresas porque faltam classificações completas nos fluxos.

## Fontes

1. Receita Federal. [Entenda a Reforma Tributária do Consumo](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/entenda).
2. Receita Federal. [Legislação da Reforma Tributária do Consumo](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/legislacao/legislacao-da-reforma-tributaria-do-consumo).
3. Brasil. [Lei Complementar nº 214, de 16 de janeiro de 2025](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm).
4. Receita Federal. [Orientações para 2026](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/orientacoes-2026).
`;
const report = `# Pacote final de dados e metodologia para o relatório Visagio

Data de geração: 10/09/2026. Este pacote separa instruções dos documentos anexados da solicitação de trabalho. O relatório recebido é uma fonte de afirmações e números a revisar; o Plano de trabalho é uma lista de pendências/decisões. A solicitação do usuário é gerar uma análise completa e um conjunto reutilizável de dados corrigidos, explicados e rastreáveis.

## Conclusão executiva

O código atual já implementa as cinco fases, o motor Monte Carlo, reconciliação e rastreabilidade. A redação correta é: a execução principal de cenários é determinística e existe um módulo estocástico exploratório, com seed e 300 iterações nesta evidência.

O teste de estoque confirmou a crítica do plano: com os mesmos dias de estoque, WACC e multiplicador de demanda, o custo de estoque não depende do número de CDs. Isso é uma decisão metodológica explícita, chamada Escolha B, e não deve ser interpretada como efeito de consolidação de risco de Eppen.

Na Empresa 2, o baseline operacional reproduz a referência do workbook com erro zero nos oito indicadores comparados. A reconciliação tributária bruta mostra diferença de R$ 513.907,63, ou 1,97%, entre scenario_totals e a matriz tributária. Isso é uma diferença de dados/fontes que precisa ser declarada, não uma pendência de software. Na Empresa 1, o conjunto fornecido não contém referência operacional consolidada equivalente e a transferência usa proxy calibrado na Empresa 2.

## Valores principais recalculados

| Cadeia | Baseline com tributo | CDs no baseline | Fluxos | Paridade | Observação |
|---|---:|---:|---:|---|---|
| Empresa 1 | ${brl(e1.baseline.total_with_tax)} | ${e1.source_counts.active_cds} | ${e1.source_counts.flows} | Sem benchmark fornecido | Dados de distribuição observados + proxy de transferência cruzado |
| Empresa 2 | ${brl(e2.baseline.total_with_tax)} | ${e2.source_counts.active_cds} | ${e2.source_counts.flows} | Operacional alinhada; tributária divergente | Cobertura fiscal parcial/proxy |

## Correções de leitura que devem entrar no relatório

1. Trocar “simulação exclusivamente determinística” por “motor determinístico de cenários, complementado por Monte Carlo exploratório”. Informar seed 42, 300 iterações, perfil balanced e driver freight_multiplier para esta rodada.
2. Remover a explicação de que a centralização reduz o custo de estoque por pooling de risco. O resultado calculado usa \`base.inventory_cost × dm × (inventory_days/45) × (wacc/0,15)\`; active_cds não entra na fórmula.
3. Classificar a transferência da Empresa 1 como proxy de engenharia derivado da Empresa 2, não como dado observado. A taxa por UF publicada é um snapshot com rastreabilidade limitada.
4. Incluir a tabela de reconciliação da Empresa 2 e declarar que a diferença tributária de 1,97% permanece aberta. Não chamar a validação tributária de oficial.
5. Recalcular savings sempre com o mesmo baseline e os mesmos componentes de custo. Não misturar total logístico sem tributo com total com tributo.

## Fallbacks e limitações

Os parâmetros centralizados são: frete ausente = 2,5% da receita; transferência heurística = 40% do custo de distribuição quando aplicável; taxa quilométrica de fallback = 0,005 R$/kg-km; taxas proxy por UF = SP 0,0083, MG 0,0049, ES 0,0176 e RJ 0,0133 R$/kg-km. A frequência observada na rodada baseline pode ser consultada em evidence.json, nos campos diagnostics.fallback_counts e diagnostics.transfer_method_counts. A ausência de uma decomposição fixa/variável observada para armazenagem deve ser apresentada como limitação e hipótese, não como medição.

## Sensibilidade da recomendação

Foram executados quatro perfis: custo, equilibrado, serviço e tributo. Na Empresa 1, os quatro perfis selecionaram o mesmo candidato nesta configuração de busca. Na Empresa 2, o perfil custo selecionou candidate_002, enquanto os demais selecionaram candidate_008. Isso demonstra que a recomendação depende dos pesos e que a seção de resultados deve reportar robustez, não apenas uma configuração vencedora.

## Resultado da validação final

Todos os testes automatizados disponíveis no checkout passaram, incluindo caminhos, contratos, Fases 1 a 5, reconciliação, invariantes, incerteza, integridade dos dados protegidos, lint, formatação e fluxo E2E desktop/mobile. A única ressalva restante é de dados e escopo: a Empresa 1 não possui benchmark operacional equivalente no material fornecido; a matriz tributária da Empresa 2 não fecha exatamente com scenario_totals; e os proxies tributários/físicos devem ser nomeados como proxies.

## Governança dos dados

O ZIP contém somente agregados derivados, CSVs de auditoria, o workbook e documentação. Os arquivos-fonte protegidos permanecem criptografados no projeto e a senha não é exportada. Para regenerar a evidência, execute \`node scripts/generate_academic_evidence.mjs\`; para reconstruir o workbook/pacote, execute \`node scripts/build_academic_package.mjs\`. Os números não devem ser tratados como validação fiscal oficial nem como previsão histórica.
`;
await fs.writeFile(path.join(outDir, 'LEIA_ME_PRIMEIRO.md'), report, 'utf8');
await fs.writeFile(path.join(outDir, 'AUDITORIA_TRIBUTARIA_PROFISSIONAL.md'), taxAudit, 'utf8');
await fs.writeFile(
  path.join(outDir, 'VALIDACAO_FINAL.md'),
  `# Validação final do pacote

## Software

Suíte automatizada do projeto: aprovada. Foram aprovados os contratos de dados, auditoria de caminhos, Fases 1 a 5, reconciliação, complementos tributários, invariantes do modelo, contratos de incerteza, integridade dos dados protegidos, lint, formatação e E2E desktop/mobile.

## Dados

- Empresa 1: estrutura e fluxos disponíveis, mas o pacote não fornece um benchmark operacional consolidado equivalente para uma paridade histórica direta.
- Empresa 2: oito métricas operacionais fecham com a referência do workbook, erro 0,00%.
- Empresa 2: a matriz tributária bruta difere de scenario_totals em R$ 513.907,63, ou 1,97%. A diferença está exposta e não é mascarada.
- Transferência Empresa 1: proxy cruzado calibrado a partir da Empresa 2, explicitamente identificado.
- Estoque: Escolha B confirmada; o número de CDs não entra na fórmula atual.

## Regra para a defesa

Não apresentar proxy como observação, não apresentar Monte Carlo como previsão histórica, não apresentar o melhor cenário avaliado como ótimo global quando o espaço não é exato e não apresentar a simulação tributária como validação fiscal oficial. Essas são qualificações de dados e escopo, não pendências de implementação.
`,
  'utf8'
);
for (const file of [
  'METODOLOGIA_MODELO.md',
  'RELATORIO_FINAL_ACADEMICO.md',
  'CHECKLIST_ENTREGA_EMPRESAS.md',
  'PROJECT_STRUCTURE.md',
]) {
  await fs.copyFile(path.join(root, file), path.join(outDir, file));
}
for (const file of [
  'data/validation/release-report.json',
  'data/validation/phase_tests.json',
  'data/validation/presentation_e2e/presentation_e2e_report.json',
]) {
  await fs.copyFile(path.join(root, file), path.join(outDir, path.basename(file)));
}
await fs.writeFile(path.join(outDir, 'evidence.json'), JSON.stringify(evidence, null, 2), 'utf8');
const optionalInputs = [];
optionalInputs.push(
  await copyOptionalInput(
    path.join(root, 'references/raw_sources/R_SPRINT3_Grupo2_Visagio(1).txt'),
    path.join(outDir, 'relatorio_recebido_extraido.txt'),
    'relatório recebido extraído'
  )
);
optionalInputs.push(
  await copyOptionalInput(
    path.join(root, 'references/raw_sources/Plano de trabalho(1).txt'),
    path.join(outDir, 'plano_trabalho_recebido_extraido.txt'),
    'plano de trabalho recebido extraído'
  )
);
await fs.writeFile(
  path.join(outDir, 'package-input-status.json'),
  JSON.stringify(optionalInputs, null, 2),
  'utf8'
);

const wb = Workbook.create();
const sheets = {};
for (const name of [
  'Resumo',
  'Baseline',
  'Reconciliação',
  'Estoque teste',
  'Monte Carlo',
  'Otimizador',
  'Plano',
  'Fontes',
])
  sheets[name] = wb.worksheets.add(name);
const colName = (index) => {
  let n = index + 1,
    name = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    name = String.fromCharCode(65 + r) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
};
const header = (sheet, title, rows, widths = []) => {
  sheet.getRange('A1').values = [[title]];
  sheet.getRange('A1').format.font = { bold: true, size: 14, color: '#000000' };
  sheet.getRange('A3').write(rows);
  const lastCol = colName(rows[0].length - 1);
  sheet.getRange(`A3:${lastCol}${2 + rows.length}`).format.borders = {
    preset: 'all',
    style: 'thin',
    color: '#D9D9D9',
  };
  sheet.getRange(`A3:${lastCol}3`).format = {
    fill: '#1F4E78',
    font: { bold: true, color: '#FFFFFF' },
    wrapText: true,
  };
  sheet.showGridLines = false;
  sheet.getUsedRange()?.format.autofitColumns();
  widths.forEach((width, index) => {
    sheet.getRange(`${colName(index)}:${colName(index)}`).format.columnWidth = width;
  });
};
header(
  sheets.Resumo,
  'Resumo executivo da revisão',
  [
    ['Cadeia', 'Baseline com tributo', 'CDs', 'Fluxos', 'Paridade', 'Uso recomendado'],
    [
      'Empresa 1',
      e1.baseline.total_with_tax,
      e1.source_counts.active_cds,
      e1.source_counts.flows,
      'Sem benchmark fornecido',
      'Exploratório condicionado',
    ],
    [
      'Empresa 2',
      e2.baseline.total_with_tax,
      e2.source_counts.active_cds,
      e2.source_counts.flows,
      'Operacional alinhada / tributária divergente',
      'Exploratório; não validação fiscal oficial',
    ],
  ],
  [22, 18, 8, 10, 32, 44]
);
header(
  sheets.Baseline,
  'Componentes do baseline',
  [
    [
      'Cadeia',
      'Transferência',
      'Distribuição',
      'Armazenagem',
      'Estoque',
      'Tributo',
      'Logística total',
      'Total com tributo',
    ],
    ...[
      [
        'Empresa 1',
        e1.baseline.costs.transfer_cost,
        e1.baseline.costs.distribution_cost,
        e1.baseline.costs.storage_cost,
        e1.baseline.costs.inventory_cost,
        e1.baseline.costs.tax_impact,
        e1.baseline.costs.total_logistics_cost,
        e1.baseline.total_with_tax,
      ],
      [
        'Empresa 2',
        e2.baseline.costs.transfer_cost,
        e2.baseline.costs.distribution_cost,
        e2.baseline.costs.storage_cost,
        e2.baseline.costs.inventory_cost,
        e2.baseline.costs.tax_impact,
        e2.baseline.costs.total_logistics_cost,
        e2.baseline.total_with_tax,
      ],
    ],
  ],
  [22, 18, 18, 18, 18, 18, 18, 18]
);
const recRows = [['Cadeia', 'Métrica', 'Referência', 'Simulado', 'Erro %', 'Status']];
for (const [cid, c] of [
  ['Empresa 1', e1],
  ['Empresa 2', e2],
])
  for (const r of c.reconciliation.operational.rows || [])
    recRows.push([cid, r.metric, r.reference, r.simulated, r.percentage_error, r.status]);
recRows.push([
  'Empresa 2',
  'tributário bruto',
  e2.reconciliation.tax.summary?.canonical_total,
  e2.reconciliation.tax.summary?.raw_matrix_total,
  e2.reconciliation.tax.summary?.raw_difference_pct,
  e2.reconciliation.tax.status,
]);
header(
  sheets['Reconciliação'],
  'Reconciliação contra referências',
  recRows,
  [20, 26, 18, 18, 16, 18]
);
header(
  sheets['Estoque teste'],
  'Teste controlado de independência do estoque',
  [
    ['Cadeia', 'Cenário', 'CDs', 'Demanda', 'Dias', 'WACC', 'Custo estoque', 'Igual ao outro caso'],
    ...[
      [
        'Empresa 1',
        '1 CD',
        e1.inventory_independence_test.one_cd.active_cds_count,
        1,
        45,
        0.15,
        e1.inventory_independence_test.one_cd.costs.inventory_cost,
        e1.inventory_independence_test.equal_inventory_cost,
      ],
      [
        'Empresa 1',
        'Todos os CDs',
        e1.inventory_independence_test.all_cds.active_cds_count,
        1,
        45,
        0.15,
        e1.inventory_independence_test.all_cds.costs.inventory_cost,
        e1.inventory_independence_test.equal_inventory_cost,
      ],
      [
        'Empresa 2',
        '1 CD',
        e2.inventory_independence_test.one_cd.active_cds_count,
        1,
        45,
        0.15,
        e2.inventory_independence_test.one_cd.costs.inventory_cost,
        e2.inventory_independence_test.equal_inventory_cost,
      ],
      [
        'Empresa 2',
        'Todos os CDs',
        e2.inventory_independence_test.all_cds.active_cds_count,
        1,
        45,
        0.15,
        e2.inventory_independence_test.all_cds.costs.inventory_cost,
        e2.inventory_independence_test.equal_inventory_cost,
      ],
    ],
  ],
  [22, 18, 8, 12, 8, 8, 18, 20]
);
const mcRows = [
  ['Cadeia', 'Iterações', 'Seed', 'Perfil', 'Driver', 'Média saving %', 'P10', 'P50', 'P90'],
];
for (const [cid, c] of [
  ['Empresa 1', e1],
  ['Empresa 2', e2],
]) {
  const s = c.monte_carlo.summary || {};
  mcRows.push([
    cid,
    s.iterations,
    s.seed,
    s.profile,
    s.scatter_driver,
    s.mean_saving_pct,
    s.p10_saving_pct,
    s.median_saving_pct,
    s.p90_saving_pct,
  ]);
}
header(
  sheets['Monte Carlo'],
  'Monte Carlo exploratório',
  mcRows,
  [20, 12, 8, 14, 22, 16, 16, 16, 16]
);
const optRows = [
  [
    'Cadeia',
    'Perfil de pesos',
    'Status',
    'Escopo',
    'Melhor cenário',
    'Score',
    'Total com tributo',
    'Saving %',
    'Risco',
  ],
];
for (const [cid, c] of [
  ['Empresa 1', e1],
  ['Empresa 2', e2],
])
  for (const [profile, o] of Object.entries(c.optimization)) {
    const b = o.best?.[0] || {};
    optRows.push([
      cid,
      profile,
      o.optimizer_status,
      o.result_scope,
      b.scenario_id,
      b.score,
      b.total_with_tax,
      b.saving_pct,
      b.risk_level,
    ]);
  }
header(
  sheets.Otimizador,
  'Sensibilidade da recomendação aos pesos',
  optRows,
  [20, 18, 24, 26, 30, 14, 18, 14, 12]
);
header(
  sheets.Plano,
  'Matriz de execução do plano de trabalho',
  [['ID', 'Item', 'Status atual', 'Prioridade', 'Ação para o relatório'], ...statusRows],
  [8, 32, 76, 12, 72]
);
header(
  sheets.Fontes,
  'Fontes normativas e dados usados',
  [
    ['Fonte', 'Título', 'Uso'],
    [
      'Receita Federal',
      'Entenda a Reforma Tributária do Consumo',
      'Cronograma, tributos e transição',
    ],
    ['Receita Federal', 'Legislação da Reforma Tributária do Consumo', 'Marcos regulatórios'],
    ['Planalto', 'Lei Complementar nº 214/2025', 'IBS, CBS, IS e créditos'],
    ['Projeto Visagio', 'Bundles e tabelas protegidas', 'Baseline, fluxos e custos observados'],
  ],
  [22, 48, 42]
);
for (const s of Object.values(sheets)) {
  const used = s.getUsedRange();
  if (used) {
    used.format.font = { name: 'Arial', size: 10, color: '#000000' };
    used.format.verticalAlignment = 'center';
    used.format.wrapText = true;
  }
}
sheets.Resumo.getRange('B4:B5').format.numberFormat = '"R$" #,##0.00';
sheets.Baseline.getRange('B4:H5').format.numberFormat = '"R$" #,##0.00';
sheets['Reconciliação'].getRange('C4:D12').format.numberFormat = '"R$" #,##0.00';
sheets['Reconciliação'].getRange('E4:E12').format.numberFormat = '0.00"%"';
sheets['Estoque teste'].getRange('F4:F7').format.numberFormat = '0.00%';
sheets['Estoque teste'].getRange('G4:G7').format.numberFormat = '"R$" #,##0.00';
sheets['Monte Carlo'].getRange('F4:I5').format.numberFormat = '0.00"%"';
sheets.Otimizador.getRange('F4:F11').format.numberFormat = '0.00';
sheets.Otimizador.getRange('G4:G11').format.numberFormat = '"R$" #,##0.00';
sheets.Otimizador.getRange('H4:H11').format.numberFormat = '0.00"%"';
const xlsx = await SpreadsheetFile.exportXlsx(wb);
await xlsx.save(path.join(outDir, 'pacote_dados_corrigidos.xlsx'));
console.log(outDir);
