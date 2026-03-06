const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SQLITE_RESERVED_PREFIX = "sqlite_";

function validateIdentifier(value: string, label: "Table" | "Column"): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return `${label} name is required`;
  }
  if (!IDENTIFIER_PATTERN.test(trimmed)) {
    return `${label} name must start with a letter/underscore and contain only letters, numbers, and underscores`;
  }
  if (label === "Table" && trimmed.toLowerCase().startsWith(SQLITE_RESERVED_PREFIX)) {
    return "Table name cannot start with 'sqlite_'";
  }
  return null;
}

export function validateTableName(value: string): string | null {
  return validateIdentifier(value, "Table");
}

export function validateColumnName(value: string): string | null {
  return validateIdentifier(value, "Column");
}
