import type { ColumnDef } from "./createTableConstants";

/**
 * Generate a CREATE TABLE SQL statement from the table definition.
 * Returns an empty string if the table name or columns are invalid.
 */
export function generateCreateTableSQL(
  tableName: string,
  columns: ColumnDef[],
  ifNotExists: boolean,
): string {
  if (!tableName.trim()) return "";

  const colDefs = columns
    .filter((col) => col.name.trim())
    .map((col) => {
      const parts: string[] = [`"${col.name.trim()}"`];
      parts.push(col.type);

      if (col.primaryKey) {
        parts.push("PRIMARY KEY");
      }
      if (col.autoIncrement && col.primaryKey && col.type === "INTEGER") {
        parts.push("AUTOINCREMENT");
      }
      if (col.notNull && !col.primaryKey) {
        parts.push("NOT NULL");
      }
      if (col.unique && !col.primaryKey) {
        parts.push("UNIQUE");
      }

      // Handle default value
      const defaultVal =
        col.defaultOption === "custom"
          ? col.defaultValue.trim()
          : col.defaultOption;
      if (defaultVal && defaultVal !== "none") {
        parts.push(`DEFAULT ${defaultVal}`);
      }

      return `  ${parts.join(" ")}`;
    });

  if (colDefs.length === 0) return "";

  const ifNotExistsStr = ifNotExists ? " IF NOT EXISTS" : "";
  return `CREATE TABLE${ifNotExistsStr} "${tableName.trim()}" (\n${colDefs.join(",\n")}\n);`;
}

/**
 * Validate columns before saving. Returns an error message or null if valid.
 */
export function validateCreateTable(
  tableName: string,
  columns: ColumnDef[],
  connId: string | undefined,
): string | null {
  if (!connId) return "No active database connection";
  if (!tableName.trim()) return "Table name is required";

  const validColumns = columns.filter((col) => col.name.trim());
  if (validColumns.length === 0) {
    return "At least one column with a name is required";
  }

  // Check for duplicate column names
  const names = validColumns.map((c) => c.name.trim().toLowerCase());
  const dupes = names.filter((name, idx) => names.indexOf(name) !== idx);
  if (dupes.length > 0) {
    return `Duplicate column name: "${dupes[0]}"`;
  }

  return null;
}
