import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const UF_PATTERN = /^[A-Z]{2}$/;

export function calibrateTransferRates({ rows, source, period }) {
  if (!Array.isArray(rows)) throw new TypeError('O campo rows precisa ser uma lista.');
  if (!String(source || '').trim() || !String(period || '').trim()) {
    throw new TypeError('Informe source e period para registrar a proveniência da calibração.');
  }

  const byUf = new Map();
  const excluded = { invalid_uf: 0, nonpositive_or_missing_input: 0 };
  for (const row of rows) {
    const uf = String(row?.destination_uf || '')
      .trim()
      .toUpperCase();
    if (!UF_PATTERN.test(uf)) {
      excluded.invalid_uf += 1;
      continue;
    }
    const freight = Number(row.freight_brl);
    const weight = Number(row.weight_kg);
    const distance = Number(row.distance_km);
    if (
      !Number.isFinite(freight) ||
      freight <= 0 ||
      !Number.isFinite(weight) ||
      weight <= 0 ||
      !Number.isFinite(distance) ||
      distance <= 0
    ) {
      excluded.nonpositive_or_missing_input += 1;
      continue;
    }
    const aggregate = byUf.get(uf) || {
      rows_used: 0,
      freight_brl_sum: 0,
      weight_distance_kg_km_sum: 0,
    };
    aggregate.rows_used += 1;
    aggregate.freight_brl_sum += freight;
    aggregate.weight_distance_kg_km_sum += weight * distance;
    byUf.set(uf, aggregate);
  }

  const rates_by_destination_uf = Object.fromEntries(
    [...byUf.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([uf, aggregate]) => [
        uf,
        {
          ...aggregate,
          rate_brl_per_kg_km: aggregate.freight_brl_sum / aggregate.weight_distance_kg_km_sum,
        },
      ])
  );
  return {
    source: String(source).trim(),
    period: String(period).trim(),
    method: 'sum_freight_brl_divided_by_sum_weight_kg_times_distance_km',
    unit: 'BRL_per_kg_km',
    input_row_count: rows.length,
    rows_used: Object.values(rates_by_destination_uf).reduce(
      (sum, item) => sum + item.rows_used,
      0
    ),
    rows_excluded: excluded,
    rates_by_destination_uf,
    warning:
      'Agregados para calibração; revise filtros fiscais, período e origem/distância antes de substituir qualquer premissa do modelo.',
  };
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function runCli() {
  const inputPath = readArgument('--input');
  if (!inputPath)
    throw new Error('Uso: node scripts/calibrate_transfer_rates.mjs --input <arquivo.json>');
  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const result = calibrateTransferRates(input);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
