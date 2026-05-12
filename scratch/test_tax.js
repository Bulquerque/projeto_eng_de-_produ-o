import { calculateReformTax } from '../assets/js/shared/tax-reform-engine.js';

const baseTax = {
  icms_estimated: 1000000,
  pis_estimated: 150000,
  cofins_estimated: 700000,
  total_tax_impact: 1850000
};

console.log("Testing Tax Reform Engine...");

const modes = ['reform_2026', 'reform_2027', 'reform_2030', 'reform_2033'];

modes.forEach(mode => {
  const result = calculateReformTax(baseTax, 1.0, mode);
  console.log(`\nMode: ${mode}`);
  console.log(`Total: ${result.total_tax_impact.toLocaleString('pt-BR')}`);
  console.log(`Explanation: ${result.explanation}`);
  console.log(`Breakdown:`, result.breakdown);
});
