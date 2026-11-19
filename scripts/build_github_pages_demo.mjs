import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requestedOutput = process.argv[2] || 'dist/github-pages-demo';
const outputRoot = path.resolve(repoRoot, requestedOutput);
const buildId = process.env.PAGES_DEMO_BUILD_ID || new Date().toISOString().slice(0, 10).replaceAll('-', '');
if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(buildId)) {
  throw new Error('PAGES_DEMO_BUILD_ID precisa ser um identificador simples de versão.');
}
const releaseRoot = path.join(outputRoot, 'releases', buildId);

if (outputRoot === repoRoot || !outputRoot.startsWith(`${repoRoot}${path.sep}`)) {
  throw new Error('O destino precisa ser um diretório dentro do repositório.');
}

try {
  const existing = await readdir(outputRoot);
  if (existing.length > 0) {
    throw new Error(`O destino já contém arquivos; não vou sobrescrevê-lo: ${outputRoot}`);
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

await mkdir(outputRoot, { recursive: true });
await mkdir(path.join(releaseRoot, 'assets', 'js', 'app'), { recursive: true });

async function copyTree(sourceRelative, targetRelative, { exclude = new Set() } = {}) {
  const source = path.join(repoRoot, sourceRelative);
  const target = path.join(releaseRoot, targetRelative);
  await mkdir(target, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (exclude.has(entry.name)) continue;
    if (entry.isSymbolicLink()) {
      throw new Error(`Link simbólico fora da allowlist: ${sourceRelative}/${entry.name}`);
    }
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) {
    await copyTree(path.relative(repoRoot, from), path.relative(releaseRoot, to), { exclude });
    } else if (entry.isFile() && !entry.name.toLowerCase().endsWith('.md')) {
      await cp(from, to);
    }
  }
}

const appConfig = `export const APP_CONFIG = Object.freeze({
  default_runtime_mode: 'project',
  default_company_id: 'empresa_mock',
  default_route: '#/network/overview/summary',
  project_module_base: '../',
  app_build: 'network-intelligence-public-demo',
  debug_default: false,
  mock_query_key: 'mock',
});

const MOCK_DEFINITION = Object.freeze({
  id: 'empresa_mock', label: 'Empresa demonstrativa', kind: 'mock', provider: 'mock',
  data_access: 'embedded', encrypted: false, requires_project: false, requires_crypto: false,
  release_policy: 'demo_only', calculation_profile: 'synthetic_fixture',
  default_route: APP_CONFIG.default_route,
});

export function readRuntimeRequest() {
  return { company_id: 'empresa_mock', runtime_mode: 'project', mock_disabled: false, debug_requested: false };
}
export function resolveRuntimeMode() { return 'project'; }
export function resolveInitialCompany() { return 'empresa_mock'; }
export function buildAppConfig() {
  return Object.freeze({ ...APP_CONFIG, runtime_mode: 'project', company_id: 'empresa_mock',
    company_definition: MOCK_DEFINITION, debug_enabled: false, mock_disabled: false });
}
`;

const companyRegistry = `const COMPANY_REGISTRY = Object.freeze({
  empresa_mock: Object.freeze({
    id: 'empresa_mock', label: 'Empresa demonstrativa', kind: 'mock', provider: 'mock',
    data_access: 'embedded', encrypted: false, requires_project: false, requires_crypto: false,
    release_policy: 'demo_only', calculation_profile: 'synthetic_fixture',
    default_route: '#/network/overview/summary',
  }),
});
export { COMPANY_REGISTRY };
export function getCompanyDefinition(companyId) { return COMPANY_REGISTRY[companyId] || null; }
export function assertKnownCompany(companyId) {
  const definition = getCompanyDefinition(companyId);
  if (!definition) throw new Error('Somente a empresa demonstrativa está disponível nesta publicação.');
  return definition;
}
export function resolveProviderKind(companyId) { return assertKnownCompany(companyId).provider; }
export function isMockTenant(companyId) { return assertKnownCompany(companyId).kind === 'mock'; }
export function isRealTenant() { return false; }
export function assertCompanyPolicy(companyId, { providerKind } = {}) {
  const definition = assertKnownCompany(companyId);
  if (providerKind && providerKind !== 'mock') throw new Error('Provider real desabilitado nesta demonstração.');
  return definition;
}
`;

const indexHtml = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Demonstração sintética do simulador de malha logística.">
    <meta name="robots" content="noindex">
    <title>Simulador de Malha Logística · Demonstração</title>
    <link rel="icon" href="releases/${buildId}/assets/icons/bootstrap-icons/diagram-3.svg" type="image/svg+xml">
  </head>
  <body>
    <script type="module" src="releases/${buildId}/assets/js/app/main.js"></script>
  </body>
</html>
`;

await writeFile(path.join(outputRoot, 'index.html'), indexHtml);
await writeFile(path.join(releaseRoot, 'assets', 'js', 'app', 'config.js'), appConfig);
await writeFile(path.join(releaseRoot, 'assets', 'js', 'app', 'company-registry.js'), companyRegistry);
await copyTree('assets/js/app', 'assets/js/app', { exclude: new Set(['config.js', 'company-registry.js', 'providers']) });
await writeFile(path.join(releaseRoot, 'assets', 'js', 'app', 'config.js'), appConfig);
await writeFile(path.join(releaseRoot, 'assets', 'js', 'app', 'company-registry.js'), companyRegistry);
await copyTree('assets/js/core', 'assets/js/core');
for (const phase of ['phase1', 'phase2', 'phase3', 'phase4', 'phase5']) {
  await copyTree(`assets/js/${phase}`, `assets/js/${phase}`);
}
await cp(path.join(repoRoot, 'assets', 'styles.css'), path.join(releaseRoot, 'assets', 'styles.css'));
await copyTree('assets/icons/bootstrap-icons', 'assets/icons/bootstrap-icons');
await copyTree('data-demo/empresa_mock', 'data-demo/empresa_mock');
await mkdir(path.join(releaseRoot, 'assets', 'js', 'app', 'providers'), { recursive: true });
await cp(
  path.join(repoRoot, 'assets/js/app/providers/mock-provider.js'),
  path.join(releaseRoot, 'assets/js/app/providers/mock-provider.js')
);
await cp(
  path.join(repoRoot, 'assets/js/app/providers/provider-contract.js'),
  path.join(releaseRoot, 'assets/js/app/providers/provider-contract.js')
);

async function inventory(directory, relative = '') {
  const entries = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const local = path.join(relative, item.name);
    const absolute = path.join(directory, item.name);
    if (item.isSymbolicLink()) throw new Error(`Link simbólico não permitido: ${local}`);
    if (item.isDirectory()) entries.push(...(await inventory(absolute, local)));
    else if (item.isFile()) entries.push(local.split(path.sep).join('/'));
  }
  return entries;
}

const files = (await inventory(outputRoot)).sort();
const forbidden = files.filter((file) =>
  /(^|\/)(data|references|docs|tests|scripts|etl|debug)(\/|$)|\.env|\.enc\.json|\.md$/i.test(file)
);
if (forbidden.length) throw new Error(`Arquivos fora da allowlist: ${forbidden.join(', ')}`);
if (files.some((file) => file.includes('project-provider.js'))) {
  throw new Error('Provider de dados reais não pode integrar o bundle público.');
}
const companyRegistryText = await readFile(
  path.join(releaseRoot, 'assets/js/app/company-registry.js'),
  'utf8'
);
if (/empresa1|empresa2/.test(companyRegistryText)) {
  throw new Error('O registro público deve expor exclusivamente a fixture sintética.');
}

const inventoryWithHashes = [];
for (const file of files) {
  const content = await readFile(path.join(outputRoot, file));
  const info = await stat(path.join(outputRoot, file));
  inventoryWithHashes.push({ path: file, bytes: info.size, sha256: createHash('sha256').update(content).digest('hex') });
}
await writeFile(
  path.join(outputRoot, 'PUBLIC_PAYLOAD_MANIFEST.json'),
  `${JSON.stringify({ kind: 'synthetic-demo-only', files: inventoryWithHashes }, null, 2)}\n`
);
console.log(`PAGES_DEMO_BUNDLE_OK files=${files.length + 1} output=${outputRoot}`);
