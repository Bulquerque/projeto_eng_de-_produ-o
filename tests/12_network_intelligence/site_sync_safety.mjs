import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const script = path.join(root, 'scripts/sync_site_runtime.mjs');
const projectId = JSON.parse(
  fs.readFileSync(path.join(root, '.openai/hosting.json'), 'utf8')
).project_id;
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'site-sync-safety-'));

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function makeTarget(target, staticDirectory = 'dist') {
  writeJson(path.join(target, '.openai/hosting.json'), {
    project_id: projectId,
    static: { directory: staticDirectory },
  });
  const dist = path.join(target, staticDirectory);
  fs.mkdirSync(path.join(dist, 'data/empresa1'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>old</title>');
  writeJson(path.join(dist, 'build-info.json'), { existing: true });
  const encryptedPath = 'data/empresa1/sample with spaces á.enc.json';
  writeJson(path.join(dist, 'data/encrypted_manifest.json'), {
    entries: [
      {
        company_id: 'empresa1',
        original_path: 'data/empresa1/sample with spaces á.json',
        encrypted_path: encryptedPath,
      },
    ],
  });
  fs.writeFileSync(path.join(dist, encryptedPath), '{"ciphertext":"fixture"}');
  return dist;
}

function runSync(target) {
  return spawnSync(process.execPath, [script, target, 'a'.repeat(40), 'codex/test'], {
    cwd: root,
    encoding: 'utf8',
  });
}

try {
  const target = path.join(scratch, 'site');
  const dist = makeTarget(target);
  fs.writeFileSync(path.join(dist, 'evidence.json'), 'private fixture');
  fs.mkdirSync(path.join(dist, 'entregaveis'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'entregaveis/report.md'), 'private fixture');

  const result = runSync(target);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(path.join(dist, 'evidence.json')), false);
  assert.equal(fs.existsSync(path.join(dist, 'entregaveis')), false);
  assert.equal(fs.existsSync(path.join(dist, 'data/empresa1/sample with spaces á.enc.json')), true);
  assert.equal(fs.existsSync(path.join(dist, 'assets/js/app/main.js')), true);
  assert.equal(fs.existsSync(path.join(dist, 'data-demo/empresa_mock')), true);
  assert.equal(fs.existsSync(path.join(dist, 'data/catalog.json')), true);
  assert.equal(fs.existsSync(path.join(dist, 'data/tax/tax_reform_config.json')), true);

  const sourceExtraTarget = path.join(scratch, 'source-extra-site');
  const sourceExtraDist = makeTarget(sourceExtraTarget);
  const sourceExtraIndex = fs.readFileSync(path.join(sourceExtraDist, 'index.html'), 'utf8');
  const unexpectedSourceFile = path.join(root, 'assets/unexpected-public-fixture.txt');
  fs.writeFileSync(unexpectedSourceFile, 'must not enter the public bundle');
  try {
    const sourceExtraResult = runSync(sourceExtraTarget);
    assert.notEqual(
      sourceExtraResult.status,
      0,
      'must reject files outside the public source allowlist'
    );
    assert.equal(
      fs.readFileSync(path.join(sourceExtraDist, 'index.html'), 'utf8'),
      sourceExtraIndex,
      'must leave the current Site untouched when source content is not allowlisted'
    );
  } finally {
    fs.rmSync(unexpectedSourceFile, { force: true });
  }

  const outsideTarget = path.join(scratch, 'outside-site');
  const escapedDist = makeTarget(outsideTarget);
  fs.mkdirSync(path.join(scratch, 'outside'), { recursive: true });
  fs.cpSync(escapedDist, path.join(scratch, 'outside'), { recursive: true });
  const escapeTarget = path.join(scratch, 'escape-site');
  makeTarget(escapeTarget, '../outside');
  const beforeEscape = fs.readFileSync(path.join(scratch, 'outside/index.html'), 'utf8');
  const escapeResult = runSync(escapeTarget);
  assert.notEqual(escapeResult.status, 0, 'must reject a directory that escapes the Site root');
  assert.equal(fs.readFileSync(path.join(scratch, 'outside/index.html'), 'utf8'), beforeEscape);

  const unsafeManifestTarget = path.join(scratch, 'unsafe-manifest-site');
  const unsafeManifestDist = makeTarget(unsafeManifestTarget);
  const originalIndex = fs.readFileSync(path.join(unsafeManifestDist, 'index.html'), 'utf8');
  writeJson(path.join(unsafeManifestDist, 'data/encrypted_manifest.json'), {
    entries: [
      {
        company_id: 'empresa1',
        original_path: 'data/empresa1/../../outside.json',
        encrypted_path: 'data/empresa1/../../outside.enc.json',
      },
    ],
  });
  const unsafeManifestResult = runSync(unsafeManifestTarget);
  assert.notEqual(unsafeManifestResult.status, 0, 'must reject encrypted paths that escape dist');
  assert.equal(fs.readFileSync(path.join(unsafeManifestDist, 'index.html'), 'utf8'), originalIndex);

  const linkedTarget = path.join(scratch, 'linked-site');
  writeJson(path.join(linkedTarget, '.openai/hosting.json'), {
    project_id: projectId,
    static: { directory: 'dist' },
  });
  const linkedOutside = path.join(scratch, 'linked-outside');
  const linkedDist = makeTarget(linkedOutside);
  fs.symlinkSync(linkedDist, path.join(linkedTarget, 'dist'), 'dir');
  const beforeLinked = fs.readFileSync(path.join(linkedDist, 'index.html'), 'utf8');
  const linkedResult = runSync(linkedTarget);
  assert.notEqual(linkedResult.status, 0, 'must reject a symlinked Site dist directory');
  assert.equal(fs.readFileSync(path.join(linkedDist, 'index.html'), 'utf8'), beforeLinked);

  console.log('SITE_SYNC_SAFETY_OK');
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
