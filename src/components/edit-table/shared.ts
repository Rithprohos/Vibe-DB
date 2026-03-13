import type { Tab } from '../../store/useAppStore';

export const FORM_FIELD_CLASS =
  'h-9 bg-background border-border placeholder:text-muted-foreground/40 text-sm ' +
  'font-medium focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary';

export const FIELD_ERROR_CLASS =
  'border-destructive/70 focus-visible:ring-destructive focus-visible:border-destructive';

export function quoteIdentifier(name: string): string {
  return `"${name.split('"').join('""')}"`;
}

export function quoteTableName(name: string): string {
  return name
    .split('.')
    .map((part) => quoteIdentifier(part.trim()))
    .join('.');
}

export function validateIndexName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Index name is required';
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
    return 'Index name must start with a letter/underscore and contain only letters, numbers, and underscores';
  }
  if (trimmed.toLowerCase().startsWith('sqlite_')) {
    return "Index name cannot start with 'sqlite_'";
  }
  return null;
}

export function getTableTabTitle(type: Tab['type'], tableName: string): string {
  if (type === 'data') return `${tableName} (Data)`;
  if (type === 'structure') return `${tableName} (Structure)`;
  if (type === 'visualize') return `${tableName} (Visualize)`;
  if (type === 'edit-table') return `${tableName} (Edit)`;
  return tableName;
}
