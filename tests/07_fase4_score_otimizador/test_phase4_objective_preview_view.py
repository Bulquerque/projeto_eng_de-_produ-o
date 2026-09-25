import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
code = r"""
import assert from 'node:assert/strict';
import { buildObjectivePreviewHtml } from './assets/js/phase4/objective-preview-view.js';

assert.equal(
  buildObjectivePreviewHtml({
    objective: { objective_name: 'Custo & serviço', valid: true, errors: [] },
    previewText: 'Peso <principal>',
  }),
  '<strong>Custo &amp; serviço</strong><p>Peso &lt;principal&gt;</p><span class="status-chip status-ok">objetivo válido</span>'
);
assert.equal(
  buildObjectivePreviewHtml({
    objective: { objective_name: 'Teste', valid: false, errors: ['Peso <100', 'Campo & vazio'] },
    previewText: 'Inválido',
  }),
  '<strong>Teste</strong><p>Inválido</p><div class="alert-box error">Peso &lt;100; Campo &amp; vazio</div>'
);
console.log('PHASE4_OBJECTIVE_PREVIEW_VIEW_OK');
"""
result = subprocess.run(['node', '--input-type=module', '-e', code], cwd=ROOT, text=True, capture_output=True)
assert result.returncode == 0, result.stderr + result.stdout
print(result.stdout.strip())
