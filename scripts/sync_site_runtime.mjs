import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Update an opened Site while preserving its existing protected runtime data.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];
assert(target && path.isAbsolute(target), 'Provide the absolute opened Site checkout path.');
const manifest = JSON.parse(fs.readFileSync(path.join(root, '.openai/hosting.json'), 'utf8'));
const published = JSON.parse(fs.readFileSync(path.join(target, '.openai/hosting.json'), 'utf8'));
assert.equal(published.project_id, manifest.project_id, 'The Site must match this project.');
const dist = path.join(target, published.static.directory);
assert(fs.existsSync(path.join(dist, 'index.html')), 'Open the existing Site before updating it.');
for (const directory of ['assets', 'data-demo']) {
  fs.rmSync(path.join(dist, directory), { recursive: true, force: true });
  fs.cpSync(path.join(root, directory), path.join(dist, directory), { recursive: true });
}
const protectedManifest = JSON.parse(
  fs.readFileSync(path.join(dist, 'data/encrypted_manifest.json'), 'utf8')
);
for (const entry of protectedManifest.entries) {
  const relative = entry.encrypted_path;
  assert(/^data\/empresa[12]\/.+\.enc\.json$/.test(relative) && !relative.includes('..'));
  assert(fs.existsSync(path.join(dist, relative)), `Missing encrypted runtime input: ${relative}`);
}
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
const files = walk(dist);
for (const file of files) {
  const relative = path.relative(dist, file);
  assert(!/(^|\/)(\.env[^/]*|raw_sources|source_exports|node_modules|\.git)(\/|$)/.test(relative));
  if (/^data\/empresa[12]\//.test(relative)) assert(relative.endsWith('.enc.json'));
}
console.log(
  `SITE_RUNTIME_OK files=${files.length} encrypted_inputs=${protectedManifest.entries.length}`
);
