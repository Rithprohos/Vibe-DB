/**
 * @deprecated Use backend SQL generation instead. This function will be removed.
 * Frontend should send structured data to insert_rows/update_rows/delete_rows commands.
 */
export const quoteIdentifier = (identifier: string): string =>
  `"${identifier.replace(/"/g, '""')}"`;

/**
 * @deprecated Use backend SQL generation instead. This function will be removed.
 * Frontend should send structured data to insert_rows/update_rows/delete_rows commands.
 */
export const quoteTableName = (tableName: string): string =>
  tableName
    .split(".")
    .map((part) => quoteIdentifier(part.trim()))
    .join(".");
