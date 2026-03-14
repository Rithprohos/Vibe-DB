import type { ColumnInfo } from "@/store/useAppStore";
import {
  isBooleanColumn,
  isJsonColumn,
  isNumericColumn,
} from "@/lib/sql/columnTypes";

export const normalizeJsonInput = (value: string): string =>
  value.replace(/[\u201C\u201D]/g, '"').trim();

interface ParseStructuredColumnValueOptions {
  emptyStringBehavior?: "null" | "omit" | "keep";
}

const DEFAULT_PARSE_OPTIONS: ParseStructuredColumnValueOptions = {
  emptyStringBehavior: "null",
};

export const parseStructuredColumnValue = (
  value: string,
  columnInfo?: ColumnInfo,
  options: ParseStructuredColumnValueOptions = DEFAULT_PARSE_OPTIONS,
): unknown => {
  const { emptyStringBehavior = "null" } = options;

  if (value === "") {
    if (emptyStringBehavior === "omit") return undefined;
    if (emptyStringBehavior === "keep") return value;
    return null;
  }

  const trimmed = value.trim();
  if (trimmed === "NULL") {
    return null;
  }

  if (columnInfo && isJsonColumn(columnInfo.col_type)) {
    const normalizedJson = normalizeJsonInput(value);
    try {
      return JSON.parse(normalizedJson);
    } catch {
      throw new Error(
        "Please enter valid JSON. Use double quotes for keys and string values.",
      );
    }
  }

  if (columnInfo && isBooleanColumn(columnInfo.col_type)) {
    const normalized = trimmed.toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
    throw new Error("Please enter true, false, 1, or 0");
  }

  if (columnInfo && isNumericColumn(columnInfo.col_type)) {
    const numericValue = Number(trimmed);
    if (!Number.isFinite(numericValue)) {
      throw new Error("Please enter a valid number");
    }
    return numericValue;
  }

  return value;
};
