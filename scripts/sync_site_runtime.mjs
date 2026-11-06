import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Rebuild only the public runtime in the opened Site, preserving encrypted inputs.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicComplementFiles = ['data/complements/shared/tax_reference/icms_interstate_matrix.json'];
const targetArgument = process.argv[2];
const sourceCommit = process.argv[3] ?? null;
const sourceBranch = process.argv[4] ?? null;
assert(
  targetArgument && path.isAbsolute(targetArgument),
  'Provide the absolute opened Site checkout path.'
);
assert(
  sourceCommit === null || /^[a-f0-9]{40}$/i.test(sourceCommit),
  'Provide the full source commit SHA when updating build metadata.'
);
assert(
  sourceBranch === null || /^[A-Za-z0-9._/-]{1,200}$/.test(sourceBranch),
  'Provide a simple branch name when updating build metadata.'
);

function assertRegularFile(file, description) {
  const stat = fs.lstatSync(file);
  assert(stat.isFile() && !stat.isSymbolicLink(), `${description} must be a regular file.`);
}

function assertDirectory(directory, description) {
  const stat = fs.lstatSync(directory);
  assert(
    stat.isDirectory() && !stat.isSymbolicLink(),
    `${description} must be a regular directory.`
  );
}

function assertTreeHasNoSymlinks(directory, description) {
  assertDirectory(directory, description);
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    const stat = fs.lstatSync(file);
    assert(!stat.isSymbolicLink(), `${description} contains a symbolic link.`);
    if (stat.isDirectory()) assertTreeHasNoSymlinks(file, description);
    else assert(stat.isFile(), `${description} contains a non-regular file.`);
  }
}

function safeRelativePath(value, description) {
  assert(typeof value === 'string' && value.length > 0, `${description} is missing.`);
  assert(!path.isAbsolute(value) && !value.includes('\\'), `${description} must be relative.`);
  const parts = value.split('/');
  assert(
    parts.every(
      (part) => part && part !== '.' && part !== '..' && /^[\p{L}\p{N} _().-]+$/u.test(part)
    ),
    `${description} contains an unsafe path component.`
  );
  assert(path.posix.normalize(value) === value, `${description} must be normalized.`);
  return value;
}

const targetPath = path.resolve(targetArgument);
assertDirectory(targetPath, 'The Site checkout');
const target = fs.realpathSync(targetPath);
const targetHostingPath = path.join(target, '.openai/hosting.json');
assertRegularFile(targetHostingPath, 'The Site hosting manifest');
const manifest = JSON.parse(fs.readFileSync(path.join(root, '.openai/hosting.json'), 'utf8'));
const published = JSON.parse(fs.readFileSync(targetHostingPath, 'utf8'));
assert.equal(published.project_id, manifest.project_id, 'The Site must match this project.');

const staticDirectory = safeRelativePath(published.static?.directory, 'Static directory');
const dist = path.resolve(target, ...staticDirectory.split('/'));
const relativeDist = path.relative(target, dist);
assert(
  relativeDist &&
    relativeDist !== '..' &&
    !relativeDist.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativeDist),
  'The static directory must stay inside the Site checkout.'
);
assertTreeHasNoSymlinks(dist, 'The Site static directory');
assertRegularFile(path.join(dist, 'index.html'), 'Existing Site entrypoint');
assertRegularFile(path.join(dist, 'build-info.json'), 'Existing Site build metadata');
const publishedManifestPath = path.join(dist, 'data/encrypted_manifest.json');
assertRegularFile(publishedManifestPath, 'Encrypted input manifest');
const buildInfoSource = JSON.parse(fs.readFileSync(path.join(dist, 'build-info.json'), 'utf8'));
assert(buildInfoSource && typeof buildInfoSource === 'object' && !Array.isArray(buildInfoSource));
const protectedManifest = JSON.parse(fs.readFileSync(publishedManifestPath, 'utf8'));
assert(Array.isArray(protectedManifest.entries) && protectedManifest.entries.length > 0);

const encryptedEntries = protectedManifest.entries.map((entry) => {
  const companyId = entry.company_id;
  assert(['empresa1', 'empresa2'].includes(companyId), 'Encrypted entry has an unknown company.');
  const originalPath = safeRelativePath(entry.original_path, 'Encrypted source path');
  const encryptedPath = safeRelativePath(entry.encrypted_path, 'Encrypted runtime path');
  assert(
    originalPath.startsWith(`data/${companyId}/`) && originalPath.endsWith('.json'),
    'Encrypted source path is outside its company namespace.'
  );
  assert(
    encryptedPath.startsWith(`data/${companyId}/`) && encryptedPath.endsWith('.enc.json'),
    'Encrypted runtime path is outside its company namespace.'
  );
  const targetFile = path.resolve(dist, ...encryptedPath.split('/'));
  const relativeFile = path.relative(dist, targetFile);
  assert(
    relativeFile &&
      relativeFile !== '..' &&
      !relativeFile.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativeFile),
    'Encrypted runtime path escapes the static directory.'
  );
  assertRegularFile(targetFile, 'Encrypted runtime input');
  return {
    company_id: companyId,
    original_path: originalPath,
    encrypted_path: encryptedPath,
    ...(typeof entry.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(entry.sha256)
      ? { sha256: entry.sha256 }
      : {}),
  };
});
const encryptedPaths = new Set(encryptedEntries.map((entry) => entry.encrypted_path));
assert.equal(
  encryptedPaths.size,
  encryptedEntries.length,
  'Encrypted runtime paths must be unique.'
);

for (const sourceDirectory of ['assets', 'data-demo', 'data/tax']) {
  const source = path.join(root, sourceDirectory);
  assertTreeHasNoSymlinks(source, `Public source ${sourceDirectory}`);
}
for (const file of publicComplementFiles) assertRegularFile(path.join(root, file), file);
assertRegularFile(path.join(root, 'index.html'), 'Source entrypoint');
assertRegularFile(path.join(root, 'data/catalog.json'), 'Public data catalog');

const pathParts = relativeDist.split(path.sep);
let cursor = target;
for (const part of pathParts.slice(0, -1)) {
  cursor = path.join(cursor, part);
  assertDirectory(cursor, 'Static directory parent');
}

const staging = fs.mkdtempSync(path.join(path.dirname(dist), '.site-sync-stage-'));
const backup = path.join(
  path.dirname(dist),
  `.site-sync-backup-${process.pid}-${crypto.randomUUID()}`
);
let oldDistMoved = false;
try {
  for (const sourceDirectory of ['assets', 'data-demo', 'data/tax']) {
    const destination = path.join(staging, sourceDirectory);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(path.join(root, sourceDirectory), destination, { recursive: true });
  }
  fs.mkdirSync(path.join(staging, 'data'), { recursive: true });
  fs.copyFileSync(path.join(root, 'data/catalog.json'), path.join(staging, 'data/catalog.json'));
  for (const file of publicComplementFiles) {
    const destination = path.join(staging, ...file.split('/'));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, file), destination);
  }

  const entrypoint = fs
    .readFileSync(path.join(root, 'index.html'), 'utf8')
    .replace('content="included"', 'content="omitted"')
    .replace(
      /src="assets\/js\/app\/main\.js(?:\?v=[^"]*)?"/,
      `src="assets/js/app/main.js?v=${sourceCommit?.slice(0, 12) || 'local-build'}"`
    );
  fs.writeFileSync(path.join(staging, 'index.html'), entrypoint);

  const priorCommit = /^[a-f0-9]{40}$/i.test(buildInfoSource.code_commit || '')
    ? buildInfoSource.code_commit
    : null;
  const buildInfo = {
    code_commit: sourceCommit || priorCommit,
    branch: sourceBranch,
    date: new Date().toISOString().slice(0, 10),
  };
  fs.writeFileSync(
    path.join(staging, 'build-info.json'),
    `${JSON.stringify(buildInfo, null, 2)}\n`
  );

  const manifestOutput = { version: 1, entries: encryptedEntries };
  const stagedManifestPath = path.join(staging, 'data/encrypted_manifest.json');
  fs.mkdirSync(path.dirname(stagedManifestPath), { recursive: true });
  fs.writeFileSync(stagedManifestPath, `${JSON.stringify(manifestOutput, null, 2)}\n`);
  for (const relative of encryptedPaths) {
    const source = path.join(dist, ...relative.split('/'));
    const destination = path.join(staging, ...relative.split('/'));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }

  const allowedFiles = new Set([
    'index.html',
    'build-info.json',
    'data/catalog.json',
    'data/encrypted_manifest.json',
    ...publicComplementFiles,
    'data-demo/empresa_mock/baseline.json',
    'data-demo/empresa_mock/objective.json',
    'data-demo/empresa_mock/scenarios.json',
    'data-demo/empresa_mock/stress-cases.json',
    'data/tax/tax_reform_config.json',
    'assets/README.md',
    'assets/js/core/README.md',
    'assets/icons/bootstrap-icons/LICENSE',
  ]);
  for (const directory of ['assets', 'data-demo']) {
    const source = path.join(staging, directory);
    for (const relative of fs.readdirSync(source, { recursive: true })) {
      const fullPath = path.join(source, relative);
      if (fs.statSync(fullPath).isFile()) {
        const childRelative = `${directory}/${relative.split(path.sep).join('/')}`;
        if (/^assets\/.*\.(?:js|css|svg)$/u.test(childRelative)) allowedFiles.add(childRelative);
      }
    }
  }
  const allowedDirectories = new Set();
  for (const file of [...allowedFiles, ...encryptedPaths]) {
    const parts = file.split('/');
    for (let index = 1; index < parts.length; index += 1)
      allowedDirectories.add(parts.slice(0, index).join('/'));
  }
  function assertPublicAllowlist(directory = staging, relative = '') {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      const childPath = path.join(directory, entry.name);
      const stat = fs.lstatSync(childPath);
      assert(!stat.isSymbolicLink(), 'Staged Site content must not contain symbolic links.');
      if (stat.isDirectory()) {
        assert(
          allowedDirectories.has(childRelative),
          `Unexpected public directory: ${childRelative}`
        );
        assertPublicAllowlist(childPath, childRelative);
      } else {
        assert(stat.isFile(), 'Staged Site content must contain only regular files.');
        assert(
          allowedFiles.has(childRelative) || encryptedPaths.has(childRelative),
          `Unexpected public file: ${childRelative}`
        );
      }
    }
  }
  assertPublicAllowlist();

  fs.renameSync(dist, backup);
  oldDistMoved = true;
  fs.renameSync(staging, dist);
  oldDistMoved = false;
  fs.rmSync(backup, { recursive: true, force: true });
} catch (error) {
  if (oldDistMoved && !fs.existsSync(dist)) fs.renameSync(backup, dist);
  throw error;
} finally {
  if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
}

console.log(`SITE_RUNTIME_OK encrypted_inputs=${encryptedPaths.size}`);
