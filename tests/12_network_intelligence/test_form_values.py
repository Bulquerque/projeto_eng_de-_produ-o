import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = r"""
import assert from 'node:assert/strict';
import {
  parseOptimizerForm,
  parseRiskForm,
  parseScenarioForm,
  validateOptimizerValues,
  validateRiskValues,
  validateScenarioValues,
} from './assets/js/app/form-values.js';

const form = (values) => ({ get: (name) => values[name] ?? null });
const validScenarioData = form({ scenario_name: 'Cenário A', tax_mode: 'current' });
const scenario = parseScenarioForm(validScenarioData, [{ value: 'CD-1' }]);
assert.deepEqual(scenario, {
  scenario_name: 'Cenário A', active_cds: ['CD-1'], freight_multiplier: 1,
  demand_multiplier: 1, inventory_days: 45, wacc: 0.15, tax_mode: 'current',
});
assert.deepEqual(validateScenarioValues(scenario), { valid: true, message: '' });
assert.equal(parseScenarioForm(form({ scenario_name: ' ' }), []).scenario_name, ' ');
assert.equal(validateScenarioValues({ ...scenario, scenario_name: ' ' }).message, 'Informe um nome para o cenário.');
assert.equal(validateScenarioValues({ ...scenario, active_cds: [] }).message, 'Selecione ao menos um CD ativo.');
assert.equal(validateScenarioValues({ ...scenario, freight_multiplier: 0 }).message, 'O multiplicador de frete deve ser maior ou igual a 0,1.');
assert.equal(validateScenarioValues({ ...scenario, demand_multiplier: 0 }).message, 'O multiplicador de demanda deve ser maior ou igual a 0,1.');
assert.equal(validateScenarioValues({ ...scenario, inventory_days: -1 }).message, 'Dias de estoque não pode ser negativo.');
assert.equal(validateScenarioValues({ ...scenario, wacc: -1 }).message, 'WACC não pode ser negativo.');
assert.equal(validateScenarioValues({ ...scenario, tax_mode: 'disabled' }).message, 'O modo tributário desligado não é permitido pela política vigente.');

const optimizer = parseOptimizerForm(form({}), {});
assert.deepEqual(optimizer, {
  max_candidates: 2000, seed: 42,
  constraints: { min_active_cds: 1, max_active_cds: 999, max_cd_volume_share: 0.75, max_risk_level: 'high', allow_tax_disabled: false },
  profile_id: 'balanced',
  risk_config: { iterations: 300, seed: 42, profile: 'balanced', scatter_driver: 'freight_multiplier', stress_profile: 'standard', sensitivity_variable: 'freight_multiplier', sensitivity_x: 'freight_multiplier', sensitivity_y: 'demand_multiplier' },
});
assert.deepEqual(validateOptimizerValues(optimizer), { valid: true, message: '' });
assert.equal(validateOptimizerValues({ ...optimizer, max_candidates: 99 }).message, 'Máximo de candidatos deve ser um inteiro entre 100 e 10.000.');
assert.equal(validateOptimizerValues({ ...optimizer, seed: 1.5 }).message, 'Seed deve ser um número inteiro.');
assert.equal(validateOptimizerValues({ ...optimizer, constraints: { ...optimizer.constraints, min_active_cds: 0 } }).message, 'CDs mínimos deve ser um inteiro maior ou igual a 1.');
assert.equal(validateOptimizerValues({ ...optimizer, constraints: { ...optimizer.constraints, max_active_cds: 0 } }).message, 'CDs máximos deve ser maior ou igual aos CDs mínimos.');
assert.equal(validateOptimizerValues({ ...optimizer, constraints: { ...optimizer.constraints, max_cd_volume_share: 0 } }).message, 'A concentração máxima deve estar entre 0,01 e 1.');
assert.equal(validateOptimizerValues({ ...optimizer, constraints: { ...optimizer.constraints, max_risk_level: 'invalid' } }).message, 'Selecione um nível de risco válido.');

const rawOptimizer = parseOptimizerForm(form({ max_candidates: '2000' }), { max_candidates: '2e' });
assert.ok(Number.isNaN(rawOptimizer.max_candidates), 'incomplete raw numeric input remains invalid instead of falling back to FormData');
assert.equal(parseOptimizerForm(form({ max_candidates: '' }), { max_candidates: '' }).max_candidates, 2000);
assert.equal(parseScenarioForm(form({ scenario_name: 'Cenário' }), [], { scenario_name: '  ' }).scenario_name, '  ');

const risk = parseRiskForm(form({}), {});
assert.deepEqual(risk, {
  iterations: 300, seed: 42, profile: 'balanced', scatter_driver: 'freight_multiplier',
  stress_profile: 'standard', sensitivity_variable: 'freight_multiplier',
  sensitivity_x: 'freight_multiplier', sensitivity_y: 'demand_multiplier',
});
assert.deepEqual(validateRiskValues(risk), { valid: true, message: '' });
assert.equal(validateRiskValues({ ...risk, iterations: 49 }).message, 'Iterações devem ser um inteiro entre 50 e 5.000.');
assert.equal(validateRiskValues({ ...risk, seed: 1.5 }).message, 'Seed do risco deve ser um número inteiro.');
assert.equal(validateRiskValues({ ...risk, profile: 'invalid' }).message, 'Selecione um perfil de incerteza válido.');
assert.equal(validateRiskValues({ ...risk, stress_profile: 'invalid' }).message, 'Selecione um perfil de stress válido.');
assert.equal(validateRiskValues({ ...risk, sensitivity_y: risk.sensitivity_x }).message, 'As variáveis X e Y da matriz precisam ser diferentes.');
console.log('NETWORK_FORM_VALUES_OK');
"""

result = subprocess.run(
    ['node', '--input-type=module', '-e', SCRIPT],
    cwd=ROOT,
    check=True,
    capture_output=True,
    text=True,
)
assert result.stdout.strip().endswith('NETWORK_FORM_VALUES_OK')
print('NETWORK_FORM_VALUES_OK')
