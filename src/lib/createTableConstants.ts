// Constants and types for the Create Table feature

/** Type parameter configuration for parameterized types like VARCHAR(n), NUMERIC(p,s) */
export interface TypeParams {
  length?: number;
  precision?: number;
  scale?: number;
}

export type TypeParamKind = 'length' | 'precision-scale' | 'precision';

export interface TypeParamConfig {
  supportsParams: boolean;
  paramType?: TypeParamKind;
}

export interface ColumnDef {
  id: string;
  name: string;
  type: string;
  /** Type parameters for parameterized types (VARCHAR(n), NUMERIC(p,s), etc.) */
  typeParams?: TypeParams;
  primaryKey: boolean;
  autoIncrement: boolean;
  notNull: boolean;
  unique: boolean;
  defaultOption: string;
  defaultValue: string;
}

/** Foreign key constraint definition */
export interface ForeignKeyConstraint {
  id: string;
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete?: 'cascade' | 'set_null' | 'set_default' | 'restrict' | 'no_action';
  onUpdate?: 'cascade' | 'set_null' | 'set_default' | 'restrict' | 'no_action';
}

export type CheckConstraintMode = 'builder' | 'custom';
export type CheckConstraintScope = 'column' | 'table';

export type CheckConstraintOperator =
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'eq'
  | 'neq'
  | 'like'
  | 'regex';

/** Check constraint definition */
export interface CheckConstraint {
  id: string;
  name: string;
  expression: string;
  mode: CheckConstraintMode;
  scope: CheckConstraintScope;
  field: string;
  compareField: string;
  operator: CheckConstraintOperator;
  value: string;
}

/** Table constraint definitions */
export interface TableConstraints {
  foreignKeys: ForeignKeyConstraint[];
  checks: CheckConstraint[];
}

export interface SqliteType {
  value: string;
  label: string;
  color: string;
  supportsParams?: boolean;
  paramType?: TypeParamKind;
}

export type SupportedEngine = "sqlite" | "turso" | "postgres";

interface CheckConstraintOperatorConfig {
  label: string;
  requiresValue: boolean;
  valuePlaceholder: string;
}

const CHECK_CONSTRAINT_OPERATOR_CONFIG: Record<
  CheckConstraintOperator,
  CheckConstraintOperatorConfig
> = {
  gt: {
    label: 'Greater than (>)',
    requiresValue: true,
    valuePlaceholder: '0',
  },
  gte: {
    label: 'Greater than or equal (>=)',
    requiresValue: true,
    valuePlaceholder: '0',
  },
  lt: {
    label: 'Less than (<)',
    requiresValue: true,
    valuePlaceholder: '0',
  },
  lte: {
    label: 'Less than or equal (<=)',
    requiresValue: true,
    valuePlaceholder: '0',
  },
  eq: {
    label: 'Equals (=)',
    requiresValue: true,
    valuePlaceholder: '1 or active',
  },
  neq: {
    label: 'Not equals (!=)',
    requiresValue: true,
    valuePlaceholder: '0 or archived',
  },
  like: {
    label: 'LIKE pattern',
    requiresValue: true,
    valuePlaceholder: '%admin%',
  },
  regex: {
    label: 'Regex match',
    requiresValue: true,
    valuePlaceholder: '^[A-Za-z0-9_]+$',
  },
};

export const CHECK_CONSTRAINT_OPERATOR_OPTIONS: {
  value: CheckConstraintOperator;
  label: string;
}[] = (Object.entries(CHECK_CONSTRAINT_OPERATOR_CONFIG) as Array<
  [CheckConstraintOperator, CheckConstraintOperatorConfig]
>).map(([value, config]) => ({
  value,
  label: config.label,
}));

export const CHECK_CONSTRAINT_SCOPE_OPTIONS: {
  value: CheckConstraintScope;
  label: string;
}[] = [
  { value: 'column', label: 'Column-level' },
  { value: 'table', label: 'Table-level' },
];

const SQL_LITERAL_NUMBER_PATTERN = /^-?(?:\d+|\d*\.\d+)$/;
const SQL_LITERAL_BOOLEAN_OR_NULL_PATTERN = /^(?:true|false|null)$/i;
const SQL_SINGLE_QUOTED_PATTERN = /^'(?:[^']|'')*'$/;
const SQL_DOUBLE_QUOTED_PATTERN = /^"(?:[^"]|"")*"$/;

function quoteExpressionIdentifier(identifier: string): string {
  return `"${identifier.split('"').join('""')}"`;
}

function asSqlValueLiteral(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (
    SQL_LITERAL_NUMBER_PATTERN.test(trimmed) ||
    SQL_LITERAL_BOOLEAN_OR_NULL_PATTERN.test(trimmed) ||
    SQL_SINGLE_QUOTED_PATTERN.test(trimmed) ||
    SQL_DOUBLE_QUOTED_PATTERN.test(trimmed)
  ) {
    return trimmed;
  }

  return `'${trimmed.split("'").join("''")}'`;
}

export function getCheckConstraintValuePlaceholder(
  operator: CheckConstraintOperator,
): string {
  return CHECK_CONSTRAINT_OPERATOR_CONFIG[operator].valuePlaceholder;
}

export function buildCheckConstraintExpression(
  constraint: CheckConstraint,
  engine: SupportedEngine,
): string {
  if (constraint.mode === 'custom') {
    return constraint.expression.trim();
  }

  const scope = constraint.scope;
  const leftField = constraint.field.trim();
  if (!leftField) {
    return '';
  }

  const operatorSql: Record<CheckConstraintOperator, string> = {
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
    eq: '=',
    neq: '!=',
    like: 'LIKE',
    regex: engine === 'postgres' ? '~' : 'REGEXP',
  };

  if (scope === 'table') {
    const rightField = constraint.compareField.trim();
    if (!rightField) {
      return '';
    }
    return `${quoteExpressionIdentifier(leftField)} ${operatorSql[constraint.operator]} ${quoteExpressionIdentifier(rightField)}`;
  }

  const config = CHECK_CONSTRAINT_OPERATOR_CONFIG[constraint.operator];
  const rawValue = constraint.value.trim();
  if (config.requiresValue && !rawValue) {
    return '';
  }
  const sqlValue = asSqlValueLiteral(rawValue);
  if (config.requiresValue && !sqlValue) {
    return '';
  }

  return `${quoteExpressionIdentifier(leftField)} ${operatorSql[constraint.operator]} ${sqlValue}`.trim();
}

export interface DefaultOption {
  value: string;
  label: string;
}

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SQLITE_AUTOINCREMENT_TYPES = new Set(["INTEGER"]);
const POSTGRES_AUTOINCREMENT_TYPES = new Set([
  "SMALLINT",
  "SMALLSERIAL",
  "INTEGER",
  "INT",
  "SERIAL",
  "BIGINT",
  "BIGSERIAL",
]);

/** SQLite data types – covering the main affinities + common aliases */
interface DataTypeOption extends SqliteType {
  engines: readonly SupportedEngine[];
}

const DATA_TYPE_OPTIONS: readonly DataTypeOption[] = [
  { value: "INTEGER", label: "INTEGER", color: "text-amber-500", engines: ["sqlite", "turso", "postgres"] },
  { value: "TEXT", label: "TEXT", color: "text-emerald-500", engines: ["sqlite", "turso", "postgres"] },
  { value: "REAL", label: "REAL", color: "text-blue-500", engines: ["sqlite", "turso"] },
  { value: "BLOB", label: "BLOB", color: "text-purple-500", engines: ["sqlite", "turso"] },
  { value: "NUMERIC", label: "NUMERIC", color: "text-rose-500", engines: ["sqlite", "turso", "postgres"], supportsParams: true, paramType: "precision-scale" },
  { value: "VARCHAR", label: "VARCHAR", color: "text-teal-500", engines: ["sqlite", "turso", "postgres"], supportsParams: true, paramType: "length" },
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
  { value: "TIME", label: "TIME", color: "text-orange-400", engines: ["postgres"], supportsParams: true, paramType: "precision" },
  { value: "TIMETZ", label: "TIMETZ", color: "text-orange-400", engines: ["postgres"], supportsParams: true, paramType: "precision" },
  { value: "TIMESTAMP", label: "TIMESTAMP", color: "text-orange-400", engines: ["postgres"], supportsParams: true, paramType: "precision" },
  { value: "TIMESTAMPTZ", label: "TIMESTAMPTZ", color: "text-orange-400", engines: ["postgres"], supportsParams: true, paramType: "precision" },
  { value: "INTERVAL", label: "INTERVAL", color: "text-orange-300", engines: ["postgres"], supportsParams: true, paramType: "precision" },
  { value: "CHAR", label: "CHAR", color: "text-teal-400", engines: ["postgres"], supportsParams: true, paramType: "length" },
  { value: "BPCHAR", label: "BPCHAR", color: "text-teal-400", engines: ["postgres"], supportsParams: true, paramType: "length" },
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
    .map(({ value, label, color, supportsParams, paramType }) => ({
      value,
      label,
      color,
      supportsParams,
      paramType,
    }));
}

export function getEngineTypeLabel(engine: SupportedEngine): string {
  if (engine === "sqlite") return "SQLite types";
  if (engine === "turso") return "Turso types";
  if (engine === "postgres") return "PostgreSQL types";
  return "Types";
}

export function canUseAutoIncrement(
  engine: SupportedEngine,
  typeValue: string,
): boolean {
  const normalized = typeValue.trim().toUpperCase();
  if (engine === "postgres") {
    return POSTGRES_AUTOINCREMENT_TYPES.has(normalized);
  }
  return SQLITE_AUTOINCREMENT_TYPES.has(normalized);
}

export function validateConstraintIdentifier(
  value: string,
  label: string,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return `${label} is required`;
  }
  if (!IDENTIFIER_PATTERN.test(trimmed)) {
    return `${label} must start with a letter/underscore and contain only letters, numbers, and underscores`;
  }
  return null;
}

export function validateQualifiedConstraintIdentifier(
  value: string,
  label: string,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return `${label} is required`;
  }

  const segments = trimmed
    .split('.')
    .map((segment) => segment.trim());
  if (segments.some((segment) => !segment)) {
    return `${label} contains an empty identifier segment`;
  }

  if (!segments.every((segment) => IDENTIFIER_PATTERN.test(segment))) {
    return `${label} must use valid identifiers separated by dots`;
  }

  return null;
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

/** Get parameter config for a data type. */
export function getTypeParamConfig(typeValue: string): TypeParamConfig | null {
  const typeOption = DATA_TYPE_OPTIONS.find(t => t.value === typeValue);
  if (!typeOption) return null;
  return {
    supportsParams: typeOption.supportsParams ?? false,
    paramType: typeOption.paramType,
  };
}

/** Check if a type supports parameters. */
export function supportsTypeParams(typeValue: string): boolean {
  return getTypeParamConfig(typeValue)?.supportsParams ?? false;
}

/** Remove params that do not apply to the selected type. */
export function normalizeTypeParams(
  typeValue: string,
  params?: TypeParams,
): TypeParams | undefined {
  const config = getTypeParamConfig(typeValue);
  if (!config?.supportsParams || !params) {
    return undefined;
  }

  switch (config.paramType) {
    case 'length':
      return params.length !== undefined ? { length: params.length } : undefined;
    case 'precision-scale':
      if (params.precision === undefined && params.scale === undefined) {
        return undefined;
      }
      return {
        precision: params.precision,
        scale: params.scale,
      };
    case 'precision':
      return params.precision !== undefined ? { precision: params.precision } : undefined;
    default:
      return undefined;
  }
}

/** Format a type with its parameters for SQL generation. */
export function formatTypeWithParams(typeValue: string, params?: TypeParams): string {
  const config = getTypeParamConfig(typeValue);
  const normalizedParams = normalizeTypeParams(typeValue, params);
  if (!config?.supportsParams || !normalizedParams) {
    return typeValue;
  }

  switch (config.paramType) {
    case 'length':
      if (normalizedParams.length !== undefined && normalizedParams.length > 0) {
        return `${typeValue}(${normalizedParams.length})`;
      }
      break;
    case 'precision-scale':
      if (normalizedParams.precision !== undefined && normalizedParams.precision > 0) {
        if (normalizedParams.scale !== undefined && normalizedParams.scale >= 0) {
          return `${typeValue}(${normalizedParams.precision},${normalizedParams.scale})`;
        }
        return `${typeValue}(${normalizedParams.precision})`;
      }
      break;
    case 'precision':
      if (normalizedParams.precision !== undefined && normalizedParams.precision >= 0) {
        return `${typeValue}(${normalizedParams.precision})`;
      }
      break;
  }
  return typeValue;
}

/** Create a new empty foreign key constraint */
export function createEmptyForeignKey(): ForeignKeyConstraint {
  return {
    id: `fk-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    columnName: '',
    referencedTable: '',
    referencedColumn: '',
    onDelete: undefined,
    onUpdate: undefined,
  };
}

/** Create a new empty check constraint */
export function createEmptyCheckConstraint(): CheckConstraint {
  return {
    id: `chk-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    name: '',
    mode: 'builder',
    scope: 'column',
    field: '',
    compareField: '',
    operator: 'gt',
    value: '',
    expression: '',
  };
}

/** Foreign key action options */
export const FK_ACTION_OPTIONS: { value: ForeignKeyConstraint['onDelete']; label: string }[] = [
  { value: undefined, label: 'No Action' },
  { value: 'cascade', label: 'CASCADE' },
  { value: 'set_null', label: 'SET NULL' },
  { value: 'set_default', label: 'SET DEFAULT' },
  { value: 'restrict', label: 'RESTRICT' },
  { value: 'no_action', label: 'NO ACTION' },
];

/** Validate type parameters. */
export function validateTypeParams(typeValue: string, params?: TypeParams): string | null {
  const config = getTypeParamConfig(typeValue);
  const normalizedParams = normalizeTypeParams(typeValue, params);
  if (!config?.supportsParams || !normalizedParams) {
    return null;
  }

  switch (config.paramType) {
    case 'length':
      if (normalizedParams.length !== undefined) {
        if (normalizedParams.length < 1) {
          return 'Length must be at least 1';
        }
        if (normalizedParams.length > 10485760) {
          return 'Length is too large';
        }
      }
      break;
    case 'precision-scale':
      if (normalizedParams.precision !== undefined) {
        if (normalizedParams.precision < 1) {
          return 'Precision must be at least 1';
        }
        if (normalizedParams.precision > 1000) {
          return 'Precision is too large';
        }
      }
      if (normalizedParams.scale !== undefined) {
        if (normalizedParams.scale < 0) {
          return 'Scale cannot be negative';
        }
        if (
          normalizedParams.precision !== undefined &&
          normalizedParams.scale > normalizedParams.precision
        ) {
          return 'Scale cannot exceed precision';
        }
      }
      break;
    case 'precision':
      if (normalizedParams.precision !== undefined) {
        if (normalizedParams.precision < 0) {
          return 'Precision cannot be negative';
        }
        if (normalizedParams.precision > 6) {
          return 'Precision cannot exceed 6';
        }
      }
      break;
  }
  return null;
}
