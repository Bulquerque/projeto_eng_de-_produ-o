/**
 * Parse a comma-separated file with quoted fields and escaped quotes.
 * Returns each data row as an object keyed by the header row.
 */
export function parseCsv(text) {
  const rows = [];
  let current = [];
  let cell = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      current.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      current.push(cell);
      if (current.some((value) => value !== '')) rows.push(current);
      current = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell.length || current.length) {
    current.push(cell);
    if (current.some((value) => value !== '')) rows.push(current);
  }

  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? '';
    });
    return record;
  });
}
