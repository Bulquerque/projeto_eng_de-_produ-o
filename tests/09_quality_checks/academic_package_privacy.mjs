import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  copyPrivateFile,
  ensurePrivateDirectory,
  restrictPrivateFile,
  writePrivateFile,
} from '../../scripts/private-artifact-files.mjs';

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'academic-package-privacy-'));
try {
  const packageDir = path.join(tempRoot, 'entregaveis', 'privado', 'pacote');
  await ensurePrivateDirectory(packageDir);
  assert.equal((await fs.stat(path.dirname(packageDir))).mode & 0o777, 0o700);
  assert.equal((await fs.stat(packageDir)).mode & 0o777, 0o700);

  const privateFile = path.join(packageDir, 'relatorio.md');
  await writePrivateFile(privateFile, 'dados agregados de fixture');
  assert.equal((await fs.stat(privateFile)).mode & 0o777, 0o600);

  const source = path.join(tempRoot, 'snapshot.json');
  const copy = path.join(packageDir, 'snapshot.json');
  await fs.writeFile(source, '{"mock":true}', { mode: 0o644 });
  await copyPrivateFile(source, copy);
  assert.equal((await fs.stat(copy)).mode & 0o777, 0o600);

  await fs.chmod(privateFile, 0o644);
  await restrictPrivateFile(privateFile);
  assert.equal((await fs.stat(privateFile)).mode & 0o777, 0o600);

  const builder = await fs.readFile(
    fileURLToPath(new URL('../../scripts/build_academic_package.mjs', import.meta.url)),
    'utf8'
  );
  assert.match(builder, /path\.join\(deliverablesDir, 'privado'\)/);
  assert.match(builder, /pacote_academico_2026-11-06/);
  assert.doesNotMatch(builder, /pacote_relatorio_visagio_2026-09-10/);
  assert.match(builder, /entregaveis\/evidence\.json/);
  assert.doesNotMatch(builder, /writePrivateFile\(path\.join\(outDir, 'evidence\.json'/);
  assert.match(builder, /CLASSIFICACAO_PRIVACIDADE\.md/);
  assert.match(builder, /restrictPrivateFile\(workbookPath\)/);

  console.log('ACADEMIC_PACKAGE_PRIVACY_OK');
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
}
