export interface PageInfo {
  page: number;
  pages: number;
  total: number;
}

export interface OutputOptions {
  json?: boolean;
  headers?: string[];
  rows?: string[][];
  pageInfo?: PageInfo;
}

export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function escapeCell(value: string | undefined | null): string {
  return (value ?? '').replace(/\|/g, '\\|');
}

export function formatTable(
  headers: string[],
  rows: string[][],
  options?: { pageInfo?: PageInfo },
): string {
  if (rows.length === 0) {
    return 'No results found';
  }

  const headerLine = `| ${headers.map(escapeCell).join(' | ')} |`;
  const separatorLine = `| ${headers.map(() => '---').join(' | ')} |`;
  const dataLines = rows.map((row) => `| ${row.map(escapeCell).join(' | ')} |`);

  let result = [headerLine, separatorLine, ...dataLines].join('\n');

  if (options?.pageInfo) {
    const { page, pages, total } = options.pageInfo;
    result += `\nPage ${page}/${pages} (Total: ${total})`;
  }

  return result;
}

export function output(data: unknown, options: OutputOptions): void {
  if (options.json) {
    console.log(formatJson(data));
    return;
  }

  const headers = options.headers ?? [];
  const rows = options.rows ?? [];
  console.log(formatTable(headers, rows, { pageInfo: options.pageInfo }));
}
