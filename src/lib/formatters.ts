/**
 * Shared cell value formatter for consistent data display
 * across TableView and QueryEditor result grids.
 */
export interface CellFormatOptions {
  prettyJson?: boolean;
}

// Browsers render non-printable control bytes as empty square glyphs in inputs/cells.
// Strip them from UI-facing strings while keeping normal whitespace intact.
export function sanitizeRenderableText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");
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
      text: sanitizeRenderableText(stringifyCellValue(value, options)),
      className: "text-foreground font-mono text-[13px]",
    };
  }

  return {
    text: sanitizeRenderableText(stringifyCellValue(value, options)),
    className: "text-foreground font-mono text-[13px]",
  };
}
