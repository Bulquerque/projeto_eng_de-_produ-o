function readFormValue(data, rawValues, name) {
  return Object.prototype.hasOwnProperty.call(rawValues, name) ? rawValues[name] : data.get(name);
}

function readFormNumber(data, rawValues, name, fallback) {
  const raw = readFormValue(data, rawValues, name);
  return raw === null || raw === '' ? fallback : Number(raw);
}

function validationError(message) {
  return { valid: false, message };
}

export function parseScenarioForm(data, checkedActiveCds, rawValues = {}) {
  return {
    scenario_name: readFormValue(data, rawValues, 'scenario_name') || 'Cenário manual',
    active_cds: [...checkedActiveCds].map((input) => input.value),
    freight_multiplier: readFormNumber(data, rawValues, 'freight_multiplier', 1),
    demand_multiplier: readFormNumber(data, rawValues, 'demand_multiplier', 1),
    inventory_days: readFormNumber(data, rawValues, 'inventory_days', 45),
    wacc: readFormNumber(data, rawValues, 'wacc', 0.15),
    tax_mode: data.get('tax_mode') || 'current',
  };
}

export function validateScenarioValues(values) {
  if (!values.scenario_name.trim()) return validationError('Informe um nome para o cenário.');
  if (!values.active_cds.length) return validationError('Selecione ao menos um CD ativo.');
  if (!Number.isFinite(values.freight_multiplier) || values.freight_multiplier < 0.1) {
    return validationError('O multiplicador de frete deve ser maior ou igual a 0,1.');
  }
  if (!Number.isFinite(values.demand_multiplier) || values.demand_multiplier < 0.1) {
    return validationError('O multiplicador de demanda deve ser maior ou igual a 0,1.');
  }
  if (!Number.isFinite(values.inventory_days) || values.inventory_days < 0) {
    return validationError('Dias de estoque não pode ser negativo.');
  }
  if (!Number.isFinite(values.wacc) || values.wacc < 0) {
    return validationError('WACC não pode ser negativo.');
  }
  if (values.tax_mode === 'disabled') {
    return validationError('O modo tributário desligado não é permitido pela política vigente.');
  }
  return { valid: true, message: '' };
}

export function parseOptimizerForm(data, rawValues = {}) {
  return {
    max_candidates: readFormNumber(data, rawValues, 'max_candidates', 2000),
    seed: readFormNumber(data, rawValues, 'seed', 42),
    constraints: {
      min_active_cds: readFormNumber(data, rawValues, 'min_active_cds', 1),
      max_active_cds: readFormNumber(data, rawValues, 'max_active_cds', 999),
      max_cd_volume_share: readFormNumber(data, rawValues, 'max_cd_volume_share', 0.75),
      max_risk_level: data.get('max_risk_level') || 'high',
      allow_tax_disabled: false,
    },
    profile_id: data.get('profile_id') || 'balanced',
    risk_config: {
      iterations: readFormNumber(data, rawValues, 'risk_iterations', 300),
      seed: readFormNumber(data, rawValues, 'risk_seed', 42),
      profile: data.get('risk_profile') || 'balanced',
      scatter_driver: data.get('risk_scatter_driver') || 'freight_multiplier',
      stress_profile: data.get('stress_profile') || 'standard',
      sensitivity_variable: data.get('sensitivity_variable') || 'freight_multiplier',
      sensitivity_x: data.get('sensitivity_x') || 'freight_multiplier',
      sensitivity_y: data.get('sensitivity_y') || 'demand_multiplier',
    },
  };
}

export function validateOptimizerValues(values) {
  const { max_candidates: maxCandidates, seed, constraints = {} } = values;
  if (!Number.isInteger(maxCandidates) || maxCandidates < 100 || maxCandidates > 10000) {
    return validationError('Máximo de candidatos deve ser um inteiro entre 100 e 10.000.');
  }
  if (!Number.isInteger(seed)) return validationError('Seed deve ser um número inteiro.');
  const minCds = constraints.min_active_cds;
  const maxCds = constraints.max_active_cds;
  if (!Number.isInteger(minCds) || minCds < 1) {
    return validationError('CDs mínimos deve ser um inteiro maior ou igual a 1.');
  }
  if (!Number.isInteger(maxCds) || maxCds < minCds) {
    return validationError('CDs máximos deve ser maior ou igual aos CDs mínimos.');
  }
  if (
    !Number.isFinite(constraints.max_cd_volume_share) ||
    constraints.max_cd_volume_share < 0.01 ||
    constraints.max_cd_volume_share > 1
  ) {
    return validationError('A concentração máxima deve estar entre 0,01 e 1.');
  }
  if (!['low', 'medium', 'high'].includes(constraints.max_risk_level)) {
    return validationError('Selecione um nível de risco válido.');
  }
  return { valid: true, message: '' };
}

export function parseRiskForm(data, rawValues = {}) {
  return {
    iterations: readFormNumber(data, rawValues, 'iterations', 300),
    seed: readFormNumber(data, rawValues, 'seed', 42),
    profile: data.get('profile') || 'balanced',
    scatter_driver: data.get('scatter_driver') || 'freight_multiplier',
    stress_profile: data.get('stress_profile') || 'standard',
    sensitivity_variable: data.get('sensitivity_variable') || 'freight_multiplier',
    sensitivity_x: data.get('sensitivity_x') || 'freight_multiplier',
    sensitivity_y: data.get('sensitivity_y') || 'demand_multiplier',
  };
}

export function validateRiskValues(values) {
  if (!Number.isInteger(values.iterations) || values.iterations < 50 || values.iterations > 5000) {
    return validationError('Iterações devem ser um inteiro entre 50 e 5.000.');
  }
  if (!Number.isInteger(values.seed))
    return validationError('Seed do risco deve ser um número inteiro.');
  if (!['balanced', 'conservative', 'broad'].includes(values.profile)) {
    return validationError('Selecione um perfil de incerteza válido.');
  }
  if (!['standard', 'conservative'].includes(values.stress_profile)) {
    return validationError('Selecione um perfil de stress válido.');
  }
  if (values.sensitivity_x === values.sensitivity_y) {
    return validationError('As variáveis X e Y da matriz precisam ser diferentes.');
  }
  return { valid: true, message: '' };
}
