import Table from 'cli-table3';

export interface FormatOpts { mode: 'pretty' | 'json' }

// Stringify a value for a table cell. Primitives become String(v);
// nested objects/arrays become compact JSON so arrays of objects no longer
// collapse to "[object Object],[object Object]".
function cellString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function format(data: unknown, opts: FormatOpts): string {
  if (opts.mode === 'json') return JSON.stringify(data, null, 2);
  if (typeof data === 'string') return data;
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
    const rows = data as Record<string, unknown>[];
    const head = Object.keys(rows[0]!);
    const t = new Table({ head });
    for (const r of rows) t.push(head.map(h => cellString(r[h])));
    return t.toString();
  }
  if (data && typeof data === 'object') {
    const t = new Table();
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      t.push({ [k]: cellString(v) });
    }
    return t.toString();
  }
  return String(data);
}
