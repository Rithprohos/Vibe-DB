// Constants and types for the Create Table feature

export interface ColumnDef {
  id: string;
  name: string;
  type: string;
  primaryKey: boolean;
  autoIncrement: boolean;
  notNull: boolean;
  unique: boolean;
  defaultOption: string;
  defaultValue: string;
}

export interface SqliteType {
  value: string;
  label: string;
  color: string;
}

export interface DefaultOption {
  value: string;
  label: string;
}

/** SQLite data types – covering the main affinities + common aliases */
export const SQLITE_TYPES: SqliteType[] = [
  { value: "INTEGER", label: "INTEGER", color: "text-amber-500" },
  { value: "TEXT", label: "TEXT", color: "text-emerald-500" },
  { value: "REAL", label: "REAL", color: "text-blue-500" },
  { value: "BLOB", label: "BLOB", color: "text-purple-500" },
  { value: "NUMERIC", label: "NUMERIC", color: "text-rose-500" },
  { value: "BOOLEAN", label: "BOOLEAN", color: "text-cyan-500" },
  { value: "DATETIME", label: "DATETIME", color: "text-orange-500" },
  { value: "VARCHAR", label: "VARCHAR", color: "text-teal-500" },
  { value: "FLOAT", label: "FLOAT", color: "text-indigo-500" },
  { value: "DOUBLE", label: "DOUBLE", color: "text-indigo-400" },
  { value: "BIGINT", label: "BIGINT", color: "text-amber-400" },
  { value: "CHAR", label: "CHAR", color: "text-emerald-400" },
  { value: "DECIMAL", label: "DECIMAL", color: "text-rose-400" },
  { value: "DATE", label: "DATE", color: "text-orange-400" },
  { value: "TIMESTAMP", label: "TIMESTAMP", color: "text-orange-300" },
] as const;

/** Common SQLite default value presets */
export const DEFAULT_OPTIONS: DefaultOption[] = [
  { value: "none", label: "None" },
  { value: "NULL", label: "NULL" },
  { value: "CURRENT_TIMESTAMP", label: "CURRENT_TIMESTAMP" },
  { value: "CURRENT_DATE", label: "CURRENT_DATE" },
  { value: "CURRENT_TIME", label: "CURRENT_TIME" },
  { value: "0", label: "0" },
  { value: "''", label: "'' (empty string)" },
  { value: "custom", label: "Custom..." },
] as const;

/** Default table name for new tables */
export const DEFAULT_TABLE_NAME = "untitled_table";

/** Create a new empty column definition with a unique ID */
export function createEmptyColumn(): ColumnDef {
  return {
    id: `col-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    name: "",
    type: "TEXT",
    primaryKey: false,
    autoIncrement: false,
    notNull: false,
    unique: false,
    defaultOption: "none",
    defaultValue: "",
  };
}

/** Create the default initial column (id INTEGER PRIMARY KEY AUTOINCREMENT) */
export function createDefaultIdColumn(): ColumnDef {
  return {
    ...createEmptyColumn(),
    name: "id",
    type: "INTEGER",
    primaryKey: true,
    autoIncrement: true,
    notNull: true,
  };
}
