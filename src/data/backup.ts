import { toCsv } from '../domain/csv';
import type { DataSnapshot } from '../domain/types';
import { downloadText } from './files';

/** Downloads everything as `daftar-YYYY-MM-DD.csv`. */
export function downloadBackup(data: DataSnapshot, today: string): void {
  downloadText(toCsv(data), `daftar-${today}.csv`, 'text/csv;charset=utf-8');
}

/** Files bigger than this can't be a Daftar export, so they're refused before reading. */
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
