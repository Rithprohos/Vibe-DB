import { homeDir, documentDir } from '@tauri-apps/api/path';
import { open, save } from '@tauri-apps/plugin-dialog';
import type { TableTransferFormat } from './types';

const EXPORT_FILTERS: Record<TableTransferFormat, { name: string; extensions: string[] }> = {
  csv: { name: 'CSV', extensions: ['csv'] },
  json: { name: 'JSON', extensions: ['json'] },
  sql: { name: 'SQL', extensions: ['sql'] },
};

const IMPORT_FILTERS: Record<Exclude<TableTransferFormat, 'sql'>, { name: string; extensions: string[] }> = {
  csv: { name: 'CSV', extensions: ['csv'] },
  json: { name: 'JSON', extensions: ['json'] },
};

async function getDefaultDirectory(): Promise<string | undefined> {
  try {
    return await documentDir();
  } catch {
    try {
      return await homeDir();
    } catch {
      return undefined;
    }
  }
}

function ensureExtension(path: string, extension: string): string {
  const normalizedPath = path.trim();
  if (normalizedPath.toLowerCase().endsWith(`.${extension}`)) {
    return normalizedPath;
  }
  return `${normalizedPath}.${extension}`;
}

export async function pickExportPath(
  tableName: string,
  format: TableTransferFormat,
): Promise<string | null> {
  const filter = EXPORT_FILTERS[format];
  const defaultDirectory = await getDefaultDirectory();
  const defaultPath = `${tableName.replace(/\s+/g, '_')}.${filter.extensions[0]}`;

  const selected = await save({
    defaultPath: defaultDirectory ? `${defaultDirectory}/${defaultPath}` : defaultPath,
    filters: [filter],
  });

  if (!selected) {
    return null;
  }

  return ensureExtension(selected as string, filter.extensions[0]);
}

export async function pickImportPath(
  format: Exclude<TableTransferFormat, 'sql'>,
): Promise<string | null> {
  const filter = IMPORT_FILTERS[format];
  const defaultDirectory = await getDefaultDirectory();

  const selected = await open({
    multiple: false,
    defaultPath: defaultDirectory,
    filters: [filter],
  });

  return typeof selected === 'string' ? selected : null;
}
