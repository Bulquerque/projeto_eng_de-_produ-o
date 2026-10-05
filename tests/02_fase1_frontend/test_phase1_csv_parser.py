import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = r'''
import assert from 'node:assert/strict';
import { parseCsv } from './assets/js/phase1/csv-parser.js';

assert.deepEqual(parseCsv('name,value\nAlpha,1\nBeta,2\n'), [
  { name: 'Alpha', value: '1' },
  { name: 'Beta', value: '2' },
]);
assert.deepEqual(parseCsv('name,description\r\nAlpha,"one, two"\r\nBeta,"line 1\nline 2"\r\n'), [
  { name: 'Alpha', description: 'one, two' },
  { name: 'Beta', description: 'line 1\nline 2' },
]);
assert.deepEqual(parseCsv('key,value\nquote,"say ""hello"""\nshort\n'), [
  { key: 'quote', value: 'say "hello"' },
  { key: 'short', value: '' },
]);
assert.deepEqual(parseCsv(''), []);
'''


subprocess.run(
    ['node', '--input-type=module', '-e', SCRIPT],
    cwd=ROOT,
    check=True,
    text=True,
)
print('PHASE1_CSV_PARSER_OK')
