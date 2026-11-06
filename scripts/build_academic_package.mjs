import fs from 'node:fs/promises';
import path from 'node:path';
import { access } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  buildAcademicPackageNarratives,
  buildHistoricalSnapshotNotice,
  buildMonteCarloRow,
  buildOptimizationRow,
  normalizePackageNumber,
  safeScenarioCost,
  safeScenarioTotal,
} from './academic-package-content.mjs';
import {
  copyPrivateFile,
  ensurePrivateDirectory,
  restrictPrivateFile,
  writePrivateFile,
} from './private-artifact-files.mjs';

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
    await access(inputPath);
    await writePrivateFile(
      outputPath,
      `Anexo de origem identificado, mas não incluído por conter texto-fonte: ${label}.\n` +
        'Consulte o original local autorizado. O conteúdo não foi copiado para o pacote.\n',
      'utf8'
    );
    return { label, status: 'available_not_copied', source: path.relative(root, inputPath) };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writePrivateFile(
      outputPath,
      `Recurso opcional não disponível nesta execução: ${label}.\n` +
        'O pacote foi gerado sem esse anexo textual; consulte references/raw_sources e o manifesto de fontes.\n',
      'utf8'
    );
    return { label, status: 'not_available' };
  }
}
const deliverablesDir = path.join(root, 'entregaveis');
const privateDir = path.join(deliverablesDir, 'privado');
const outDir = path.join(privateDir, 'pacote_academico_2026-11-06');
await ensurePrivateDirectory(deliverablesDir);
await ensurePrivateDirectory(privateDir);
await ensurePrivateDirectory(outDir);
const evidencePath = path.join(deliverablesDir, 'evidence.json');
const evidence = JSON.parse(await fs.readFile(evidencePath, 'utf8'));
await restrictPrivateFile(evidencePath);
const { report, validation, taxAudit, statusRows } = buildAcademicPackageNarratives(evidence);
const companies = Object.entries(evidence.companies || {});
const e1 = evidence.companies?.empresa1 || {};
const e2 = evidence.companies?.empresa2 || {};

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
await writePrivateFile(
  path.join(outDir, 'matriz_plano_trabalho.csv'),
  csv([['id', 'item', 'status_atual', 'prioridade', 'acao_para_relatorio'], ...statusRows]),
  'utf8'
);

await writePrivateFile(path.join(outDir, 'LEIA_ME_PRIMEIRO.md'), report, 'utf8');
await writePrivateFile(path.join(outDir, 'AUDITORIA_TRIBUTARIA_PROFISSIONAL.md'), taxAudit, 'utf8');
await writePrivateFile(path.join(outDir, 'VALIDACAO_FINAL.md'), validation, 'utf8');
const packagedAt = new Date().toISOString();
const snapshotInputs = [];
for (const file of [
  'METODOLOGIA_MODELO.md',
  'RELATORIO_FINAL_ACADEMICO.md',
  'ESTUDO_PROPRIO_TRIBUTACAO.md',
  'CHECKLIST_ENTREGA_EMPRESAS.md',
  'PROJECT_STRUCTURE.md',
]) {
  const sourcePath = path.join(root, file);
  try {
    const [stat, content] = await Promise.all([
      fs.stat(sourcePath),
      fs.readFile(sourcePath, 'utf8'),
    ]);
    const notice = buildHistoricalSnapshotNotice(content, {
      sourcePath: file,
      packagedAt,
      fileModifiedAt: stat.mtime.toISOString(),
    });
    await writePrivateFile(path.join(outDir, file), notice, 'utf8');
    snapshotInputs.push({
      kind: 'documentation',
      source: file,
      package_file: file,
      status: 'copied_document_snapshot',
      packaged_at: packagedAt,
      file_modified_at_filesystem: stat.mtime.toISOString(),
      interpretation: 'Cópia prefixada com aviso; original mantido sem edição.',
    });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    snapshotInputs.push({
      kind: 'documentation',
      source: file,
      package_file: null,
      status: 'not_available',
    });
  }
}
for (const file of [
  'data/validation/release-report.json',
  'data/validation/phase_tests.json',
  'data/validation/presentation_e2e/presentation_e2e_report.json',
]) {
  const sourcePath = path.join(root, file);
  const packageFile = path.basename(file);
  try {
    const stat = await fs.stat(sourcePath);
    await copyPrivateFile(sourcePath, path.join(outDir, packageFile));
    snapshotInputs.push({
      kind: 'validation',
      source: file,
      package_file: packageFile,
      status: 'copied_historical_snapshot',
      file_modified_at_filesystem: stat.mtime.toISOString(),
      interpretation:
        'O horário de modificação é metadado do sistema de arquivos, não a data da execução. Anexo de referência; não comprova estado atual do checkout.',
    });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    snapshotInputs.push({
      kind: 'validation',
      source: file,
      package_file: null,
      status: 'not_available',
    });
  }
}
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
await writePrivateFile(
  path.join(outDir, 'package-input-status.json'),
  JSON.stringify(
    {
      optional_inputs: optionalInputs,
      historical_document_snapshots: snapshotInputs.filter((item) => item.kind === 'documentation'),
      validation_snapshots: snapshotInputs.filter((item) => item.kind === 'validation'),
    },
    null,
    2
  ),
  'utf8'
);
await writePrivateFile(
  path.join(outDir, 'CLASSIFICACAO_PRIVACIDADE.md'),
  '# Material privado com dados empresariais\n\n' +
    'Este diretório contém resultados agregados derivados de evidência empresarial e não é um pacote distribuível.\n' +
    'Os arquivos são separados do bundle compartilhável; não compartilhe nem publique este diretório.\n' +
    'O evidence.json bruto permanece em entregaveis/evidence.json, fora deste pacote.\n',
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
  'Mecanismo de avaliação',
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
      safeScenarioTotal(e1.baseline),
      normalizePackageNumber(e1.source_counts?.active_cd_count),
      normalizePackageNumber(e1.source_counts?.flows),
      e1.reconciliation?.operational?.status || 'n.a.',
      e1.baseline?.simulation_status || 'status não registrado',
    ],
    [
      'Empresa 2',
      safeScenarioTotal(e2.baseline),
      normalizePackageNumber(e2.source_counts?.active_cd_count),
      normalizePackageNumber(e2.source_counts?.flows),
      e2.reconciliation?.operational?.status || 'n.a.',
      e2.baseline?.simulation_status || 'status não registrado',
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
        safeScenarioCost(e1.baseline, 'transfer_cost'),
        safeScenarioCost(e1.baseline, 'distribution_cost'),
        safeScenarioCost(e1.baseline, 'storage_cost'),
        safeScenarioCost(e1.baseline, 'inventory_cost'),
        safeScenarioCost(e1.baseline, 'tax_impact'),
        safeScenarioCost(e1.baseline, 'total_logistics_cost'),
        safeScenarioTotal(e1.baseline),
      ],
      [
        'Empresa 2',
        safeScenarioCost(e2.baseline, 'transfer_cost'),
        safeScenarioCost(e2.baseline, 'distribution_cost'),
        safeScenarioCost(e2.baseline, 'storage_cost'),
        safeScenarioCost(e2.baseline, 'inventory_cost'),
        safeScenarioCost(e2.baseline, 'tax_impact'),
        safeScenarioCost(e2.baseline, 'total_logistics_cost'),
        safeScenarioTotal(e2.baseline),
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
  for (const r of c.reconciliation?.operational?.rows || [])
    recRows.push([
      cid,
      r.metric,
      normalizePackageNumber(r.reference),
      safeScenarioTotal(c.baseline) != null ? normalizePackageNumber(r.simulated) : null,
      safeScenarioTotal(c.baseline) != null ? normalizePackageNumber(r.percentage_error) : null,
      r.status,
    ]);
for (const [cid, c] of companies) {
  const tax = c.reconciliation?.tax;
  if (!tax) continue;
  const comparable = safeScenarioTotal(c.baseline) != null;
  recRows.push([
    cid,
    'tributário bruto',
    comparable ? normalizePackageNumber(tax.summary?.canonical_total) : null,
    comparable ? normalizePackageNumber(tax.summary?.raw_matrix_total) : null,
    comparable ? normalizePackageNumber(tax.summary?.raw_difference_pct) : null,
    tax.status || 'n.a.',
  ]);
}
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
        normalizePackageNumber(e1.inventory_independence_test?.one_cd?.active_cds_count),
        normalizePackageNumber(e1.inventory_independence_test?.one_cd?.demand_multiplier),
        normalizePackageNumber(e1.inventory_independence_test?.one_cd?.inventory_days),
        normalizePackageNumber(e1.inventory_independence_test?.one_cd?.wacc),
        safeScenarioCost(e1.inventory_independence_test?.one_cd, 'inventory_cost'),
        e1.inventory_independence_test?.comparison_status === 'compared' &&
        safeScenarioCost(e1.inventory_independence_test?.one_cd, 'inventory_cost') != null &&
        safeScenarioCost(e1.inventory_independence_test?.all_cds, 'inventory_cost') != null
          ? e1.inventory_independence_test.equal_inventory_cost
          : null,
      ],
      [
        'Empresa 1',
        'Todos os CDs',
        normalizePackageNumber(e1.inventory_independence_test?.all_cds?.active_cds_count),
        normalizePackageNumber(e1.inventory_independence_test?.all_cds?.demand_multiplier),
        normalizePackageNumber(e1.inventory_independence_test?.all_cds?.inventory_days),
        normalizePackageNumber(e1.inventory_independence_test?.all_cds?.wacc),
        safeScenarioCost(e1.inventory_independence_test?.all_cds, 'inventory_cost'),
        e1.inventory_independence_test?.comparison_status === 'compared' &&
        safeScenarioCost(e1.inventory_independence_test?.one_cd, 'inventory_cost') != null &&
        safeScenarioCost(e1.inventory_independence_test?.all_cds, 'inventory_cost') != null
          ? e1.inventory_independence_test.equal_inventory_cost
          : null,
      ],
      [
        'Empresa 2',
        '1 CD',
        normalizePackageNumber(e2.inventory_independence_test?.one_cd?.active_cds_count),
        normalizePackageNumber(e2.inventory_independence_test?.one_cd?.demand_multiplier),
        normalizePackageNumber(e2.inventory_independence_test?.one_cd?.inventory_days),
        normalizePackageNumber(e2.inventory_independence_test?.one_cd?.wacc),
        safeScenarioCost(e2.inventory_independence_test?.one_cd, 'inventory_cost'),
        e2.inventory_independence_test?.comparison_status === 'compared' &&
        safeScenarioCost(e2.inventory_independence_test?.one_cd, 'inventory_cost') != null &&
        safeScenarioCost(e2.inventory_independence_test?.all_cds, 'inventory_cost') != null
          ? e2.inventory_independence_test.equal_inventory_cost
          : null,
      ],
      [
        'Empresa 2',
        'Todos os CDs',
        normalizePackageNumber(e2.inventory_independence_test?.all_cds?.active_cds_count),
        normalizePackageNumber(e2.inventory_independence_test?.all_cds?.demand_multiplier),
        normalizePackageNumber(e2.inventory_independence_test?.all_cds?.inventory_days),
        normalizePackageNumber(e2.inventory_independence_test?.all_cds?.wacc),
        safeScenarioCost(e2.inventory_independence_test?.all_cds, 'inventory_cost'),
        e2.inventory_independence_test?.comparison_status === 'compared' &&
        safeScenarioCost(e2.inventory_independence_test?.one_cd, 'inventory_cost') != null &&
        safeScenarioCost(e2.inventory_independence_test?.all_cds, 'inventory_cost') != null
          ? e2.inventory_independence_test.equal_inventory_cost
          : null,
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
  mcRows.push(buildMonteCarloRow(cid, c.monte_carlo));
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
  for (const [profile, o] of Object.entries(c.optimization || {})) {
    optRows.push(buildOptimizationRow(cid, profile, o));
  }
header(
  sheets['Mecanismo de avaliação'],
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
      'Projeto Visagio',
      'evidence.json',
      `Timestamp registrado: ${evidence.generated_at || 'não informado'}; agregados fornecidos nesta execução.`,
    ],
    ['Fontes externas', 'Não consultadas pelo gerador', 'Pendente de verificação atual'],
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
sheets['Mecanismo de avaliação'].getRange('F4:F11').format.numberFormat = '0.00';
sheets['Mecanismo de avaliação'].getRange('G4:G11').format.numberFormat = '"R$" #,##0.00';
sheets['Mecanismo de avaliação'].getRange('H4:H11').format.numberFormat = '0.00"%"';
const xlsx = await SpreadsheetFile.exportXlsx(wb);
const workbookPath = path.join(outDir, 'pacote_dados_corrigidos.xlsx');
await xlsx.save(workbookPath);
await restrictPrivateFile(workbookPath);
console.log(outDir);
