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
  { value: "BOOLEAN", label: "BOOLEAN", color: "text-lime-500", engines: ["postgres"] },
  { value: "SMALLINT", label: "SMALLINT", color: "text-amber-400", engines: ["postgres"] },
  { value: "BIGINT", label: "BIGINT", color: "text-amber-400", engines: ["postgres"] },
  { value: "SERIAL", label: "SERIAL", color: "text-cyan-400", engines: ["postgres"] },
  { value: "BIGSERIAL", label: "BIGSERIAL", color: "text-cyan-400", engines: ["postgres"] },
  { value: "DOUBLE PRECISION", label: "DOUBLE PRECISION", color: "text-blue-400", engines: ["postgres"] },
  { value: "MONEY", label: "MONEY", color: "text-emerald-400", engines: ["postgres"] },
  { value: "UUID", label: "UUID", color: "text-fuchsia-400", engines: ["postgres"] },
  { value: "JSON", label: "JSON", color: "text-pink-400", engines: ["postgres"] },
  { value: "JSONB", label: "JSONB", color: "text-pink-400", engines: ["postgres"] },
  { value: "BYTEA", label: "BYTEA", color: "text-purple-400", engines: ["postgres"] },
  { value: "DATE", label: "DATE", color: "text-orange-400", engines: ["postgres"] },
  { value: "TIME", label: "TIME", color: "text-orange-400", engines: ["postgres"] },
  { value: "TIMETZ", label: "TIMETZ", color: "text-orange-400", engines: ["postgres"] },
  { value: "TIMESTAMP", label: "TIMESTAMP", color: "text-orange-400", engines: ["postgres"] },
  { value: "TIMESTAMPTZ", label: "TIMESTAMPTZ", color: "text-orange-400", engines: ["postgres"] },
  { value: "INTERVAL", label: "INTERVAL", color: "text-orange-300", engines: ["postgres"] },
  { value: "CHAR", label: "CHAR", color: "text-teal-400", engines: ["postgres"] },
  { value: "BPCHAR", label: "BPCHAR", color: "text-teal-400", engines: ["postgres"] },
  { value: "XML", label: "XML", color: "text-rose-400", engines: ["postgres"] },
  { value: "INET", label: "INET", color: "text-sky-400", engines: ["postgres"] },
  { value: "CIDR", label: "CIDR", color: "text-sky-400", engines: ["postgres"] },
  { value: "MACADDR", label: "MACADDR", color: "text-sky-400", engines: ["postgres"] },
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
