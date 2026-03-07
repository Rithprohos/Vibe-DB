/**
 * Shared cell value formatter for consistent data display
 * across TableView and QueryEditor result grids.
 */
export function formatCellValue(value: any): {
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
  return {
    text: String(value),
    className: "text-foreground font-mono text-[13px]",
  };
}
