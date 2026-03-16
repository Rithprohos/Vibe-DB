import type { QueryFilter } from '@/lib/db';

export type TableTransferFormat = 'csv' | 'json' | 'sql';

export interface ExportTableDataInput {
  tableName: string;
  format: TableTransferFormat;
  destinationPath: string;
  filters?: QueryFilter[];
  sortCol?: string | null;
  sortDir?: 'ASC' | 'DESC';
}

export interface ExportTableDataResult {
  rowsExported: number;
  path: string;
  message: string;
}

export interface ImportTableDataInput {
  tableName: string;
  format: Exclude<TableTransferFormat, 'sql'>;
  sourcePath: string;
  excludeColumns?: string[];
}

export interface ImportTableDataResult {
  rowsImported: number;
  message: string;
}

export interface TableTransferContext {
  filters?: QueryFilter[];
  sortCol?: string | null;
  sortDir?: 'ASC' | 'DESC';
}

export interface TableTransferImportedDetail {
  connectionId: string;
  tableName: string;
}
