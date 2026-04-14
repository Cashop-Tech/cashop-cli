import Table from 'cli-table3';

export interface FormatOpts { mode: 'pretty' | 'json' }

export function format(data: unknown, opts: FormatOpts): string {
  if (opts.mode === 'json') return JSON.stringify(data, null, 2);
  if (typeof data === 'string') return data;
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
    const rows = data as Record<string, unknown>[];
    const head = Object.keys(rows[0]!);
    const t = new Table({ head });
    for (const r of rows) t.push(head.map(h => String(r[h] ?? '')));
    return t.toString();
  }
  if (data && typeof data === 'object') {
    const t = new Table();
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      t.push({ [k]: String(v) });
    }
    return t.toString();
  }
  return String(data);
}
