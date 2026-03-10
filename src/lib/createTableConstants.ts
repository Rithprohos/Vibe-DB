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

export type SupportedEngine = "sqlite" | "turso" | "postgres";

export interface DefaultOption {
  value: string;
  label: string;
}

/** SQLite data types – covering the main affinities + common aliases */
interface DataTypeOption extends SqliteType {
  engines: readonly SupportedEngine[];
}

const DATA_TYPE_OPTIONS: readonly DataTypeOption[] = [
  { value: "INTEGER", label: "INTEGER", color: "text-amber-500", engines: ["sqlite", "turso", "postgres"] },
  { value: "TEXT", label: "TEXT", color: "text-emerald-500", engines: ["sqlite", "turso", "postgres"] },
  { value: "REAL", label: "REAL", color: "text-blue-500", engines: ["sqlite", "turso"] },
  { value: "BLOB", label: "BLOB", color: "text-purple-500", engines: ["sqlite", "turso"] },
  { value: "NUMERIC", label: "NUMERIC", color: "text-rose-500", engines: ["sqlite", "turso", "postgres"] },
  { value: "VARCHAR", label: "VARCHAR", color: "text-teal-500", engines: ["sqlite", "turso", "postgres"] },
  { value: "BIGINT", label: "BIGINT", color: "text-amber-400", engines: ["postgres"] },
] as const;

const DATA_TYPE_COLOR_MAP: Record<string, string> = DATA_TYPE_OPTIONS.reduce(
  (acc, type) => {
    acc[type.value.toUpperCase()] = type.color;
    return acc;
  },
  {} as Record<string, string>,
);

export function getSqliteTypeColor(typeName: string): string {
  return DATA_TYPE_COLOR_MAP[typeName.toUpperCase()] ?? "text-foreground";
}

export function getDataTypesForEngine(engine: SupportedEngine): readonly SqliteType[] {
  return DATA_TYPE_OPTIONS
    .filter((option) => option.engines.includes(engine))
    .map(({ value, label, color }) => ({ value, label, color }));
}

export function getEngineTypeLabel(engine: SupportedEngine): string {
  if (engine === "sqlite") return "SQLite types";
  if (engine === "turso") return "Turso types";
  if (engine === "postgres") return "PostgreSQL types";
  return "Types";
}

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
