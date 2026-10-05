import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = r"""
import assert from 'node:assert/strict';
import { renderTable } from './assets/js/phase1/table-view.js';

assert.equal(
  renderTable([], [{ key: 'name', label: 'Nome' }]),
  '<p class="small-note">Sem registros para exibir.</p>'
);

const html = renderTable(
  [
    { name: '<Empresa>', path: 'data/a&b.csv', rows: 1250 },
    { name: 'Segunda', path: 'data/second.csv', rows: 2 },
  ],
  [
    { key: 'name', label: '<Nome>' },
    { key: 'path', label: 'Caminho', isPath: true },
    { key: 'rows', label: 'Linhas' },
  ],
  { limit: 1 }
);

assert.match(html, /&lt;Nome&gt;/);
assert.match(html, /&lt;Empresa&gt;/);
assert.match(html, /class="path-cell">data\/a&amp;b\.csv/);
assert.match(html, /1\.250/);
assert.match(html, /Mostrando 1 de 2 registros/);
assert.doesNotMatch(html, /Segunda/);
"""

subprocess.run(
    ['node', '--input-type=module', '-e', SCRIPT],
    cwd=ROOT,
    check=True,
    text=True,
)
print('PHASE1_TABLE_VIEW_OK')
