/**
 * Shared cell value formatter for consistent data display
 * across TableView and QueryEditor result grids.
 */
export interface CellFormatOptions {
  prettyJson?: boolean;
}

export function stringifyCellValue(
  value: unknown,
  options?: CellFormatOptions,
): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" || typeof value === "boolean") {
    return value.toString();
  }

  if (typeof value === "object") {
    try {
      const serialized = JSON.stringify(value, null, options?.prettyJson ? 2 : 0);
      return serialized ?? String(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

export function formatCellValue(
  value: unknown,
  options?: CellFormatOptions,
): {
  text: string;
  className: string;
} {
  if (value === null || value === undefined) {
    return {
      text: "NULL",
      className: "text-muted-foreground/50 italic font-mono text-xs",
    };
  }
  if (typeof value === "number") {
    return {
      text: value.toString(),
      className: "text-foreground font-mono text-xs",
    };
  }
  if (typeof value === "boolean") {
    return {
      text: value.toString(),
      className: "text-amber-500 font-mono text-xs uppercase",
    };
  }

  if (typeof value === "object") {
    return {
      text: stringifyCellValue(value, options),
      className: "text-foreground font-mono text-[13px]",
    };
  }

  return {
    text: stringifyCellValue(value, options),
    className: "text-foreground font-mono text-[13px]",
  };
}
