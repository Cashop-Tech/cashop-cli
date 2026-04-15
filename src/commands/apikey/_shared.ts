import Table from 'cli-table3';
import type { AuthProvider } from '../../core/auth-provider/index.js';
import { BadArgsError } from '../../core/errors.js';
import type { ApiKeyListItem } from '../../types/api.js';

export function requireOAuthDevice(provider: AuthProvider): void {
  if (provider.kind !== 'oauth-device') {
    throw new BadArgsError(
      'This command requires a device login. Run: cashop login --device',
    );
  }
}

export function formatIsoUtc(ms: number | null): string {
  if (ms == null) return '—';
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function renderListTable(items: ApiKeyListItem[]): string {
  const t = new Table({
    head: ['kid', 'name', 'created', 'expires', 'last used'],
  });
  for (const it of items) {
    t.push([
      it.kid,
      it.name,
      formatIsoUtc(it.createdAt),
      formatIsoUtc(it.expiresAt),
      formatIsoUtc(it.lastUsedAt),
    ]);
  }
  return t.toString();
}
