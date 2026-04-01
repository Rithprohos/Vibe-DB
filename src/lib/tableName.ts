const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SQLITE_RESERVED_PREFIX = "sqlite_";

function validateIdentifier(
  value: string,
  label: "Table" | "Column" | "View" | "Enum",
): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return `${label} name is required`;
  }
  if (!IDENTIFIER_PATTERN.test(trimmed)) {
    return `${label} name must start with a letter/underscore and contain only letters, numbers, and underscores`;
  }
  if (
    (label === "Table" || label === "View") &&
    trimmed.toLowerCase().startsWith(SQLITE_RESERVED_PREFIX)
  ) {
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

export function validateViewName(value: string): string | null {
  const error = validateIdentifier(value, "View");
  if (error === "Table name cannot start with 'sqlite_'") {
    return "View name cannot start with 'sqlite_'";
  }
  return error;
}

export function validateEnumName(value: string): string | null {
  return validateIdentifier(value, "Enum");
}
