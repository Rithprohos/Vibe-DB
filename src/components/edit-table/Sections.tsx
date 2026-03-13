import type { SqliteType, TypeParams } from '../../lib/createTableConstants';
import { getSqliteTypeColor, supportsTypeParams } from '../../lib/createTableConstants';
import { isSchemaFlagEnabled } from '../../lib/schemaFlags';
import type { ColumnInfo, IndexInfo } from '../../store/useAppStore';
import { TypeParameterFields } from '../TypeParameterFields';
import { formatColumnTypeDisplay } from '../../lib/typeDisplay';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  Hash,
  Loader2,
  PencilRuler,
  RefreshCw,
  Table2,
  Trash2,
  Type,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FIELD_ERROR_CLASS, FORM_FIELD_CLASS } from './shared';

interface EditTableHeaderProps {
  currentTableName: string;
  loadingColumns: boolean;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  connectionName?: string;
  onRefresh: () => void;
}

export function EditTableHeader({
  currentTableName,
  loadingColumns,
  columns,
  indexes,
  connectionName,
  onRefresh,
}: EditTableHeaderProps) {
  return (
    <header className="rounded-md border border-border bg-surface/30 backdrop-blur-sm">
      <div className="border-b border-border/60 px-4 py-3 md:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={
                'flex h-8 w-8 items-center justify-center rounded-sm ' +
                'border border-primary/30 bg-primary/10'
              }
            >
              <PencilRuler size={15} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Edit Table</h2>
              <p className="text-[11px] text-muted-foreground">
                Apply ALTER TABLE operations on{' '}
                <span className="font-mono text-foreground">{currentTableName}</span>
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loadingColumns}
            className="border-border/60 bg-background/40 text-xs"
          >
            {loadingColumns ? (
              <Loader2 size={12} className="mr-1.5 animate-spin" />
            ) : (
              <RefreshCw size={12} className="mr-1.5" />
            )}
            Refresh Schema
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 py-3 text-[11px] md:grid-cols-5 md:px-5">
        <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-2">
          <div className="text-muted-foreground">Columns</div>
          <div className="mt-1 font-mono text-foreground">{columns.length}</div>
        </div>
        <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-2">
          <div className="text-muted-foreground">Primary Keys</div>
          <div className="mt-1 font-mono text-foreground">
            {columns.filter((column) => isSchemaFlagEnabled(column.pk)).length}
          </div>
        </div>
        <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-2">
          <div className="text-muted-foreground">Required</div>
          <div className="mt-1 font-mono text-foreground">
            {columns.filter((column) => isSchemaFlagEnabled(column.notnull)).length}
          </div>
        </div>
        <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-2">
          <div className="text-muted-foreground">Indexes</div>
          <div className="mt-1 font-mono text-foreground">{indexes.length}</div>
        </div>
        <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-2">
          <div className="text-muted-foreground">Connection</div>
          <div className="mt-1 truncate font-mono text-foreground">
            {connectionName ?? 'Unknown'}
          </div>
        </div>
      </div>
    </header>
  );
}

interface EditTableErrorBannerProps {
  error: string;
}

export function EditTableErrorBanner({ error }: EditTableErrorBannerProps) {
  return (
    <div
      className={
        'flex items-start gap-2 rounded-sm border ' +
        'border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive'
      }
    >
      <AlertCircle size={14} className="mt-0.5 shrink-0" />
      <span className="whitespace-pre-wrap break-words">{error}</span>
    </div>
  );
}

interface EditTableOperationsPanelProps {
  loadingColumns: boolean;
  isBusy: (action: string) => boolean;
  columns: ColumnInfo[];
  manageableIndexes: IndexInfo[];
  currentTableName: string;
  engineTypeLabel: string;
  engineDataTypes: readonly SqliteType[];
  nextTableName: string;
  onNextTableNameChange: (value: string) => void;
  renameTableNameError: string | null;
  onRenameTable: () => void;
  newColumnName: string;
  onNewColumnNameChange: (value: string) => void;
  newColumnNameError: string | null;
  newColumnType: string;
  onNewColumnTypeChange: (value: string) => void;
  newColumnTypeParams?: TypeParams;
  onNewColumnTypeParamsChange?: (params: TypeParams | undefined) => void;
  newColumnTypeParamError: string | null;
  newColumnDefault: string;
  onNewColumnDefaultChange: (value: string) => void;
  newColumnNotNull: boolean;
  onNewColumnNotNullChange: (checked: boolean) => void;
  onAddColumn: () => void;
  renameColumnFrom: string;
  onRenameColumnFromChange: (value: string) => void;
  renameColumnTo: string;
  onRenameColumnToChange: (value: string) => void;
  renameColumnToError: string | null;
  onRenameColumn: () => void;
  newIndexName: string;
  onNewIndexNameChange: (value: string) => void;
  newIndexNameError: string | null;
  newIndexUnique: boolean;
  onNewIndexUniqueChange: (checked: boolean) => void;
  newIndexColumns: string[];
  onToggleIndexColumn: (columnName: string) => void;
  selectedCreateIndexColumnsCount: number;
  createIndexColumnsError: string | null;
  onCreateIndex: () => void;
  dropIndexName: string;
  onDropIndexNameChange: (value: string) => void;
  dropIndexConfirm: boolean;
  onDropIndexConfirmChange: (checked: boolean) => void;
  onDropIndex: () => void;
  dropColumnName: string;
  onDropColumnNameChange: (value: string) => void;
  dropConfirm: boolean;
  onDropConfirmChange: (checked: boolean) => void;
  onDropColumn: () => void;
}

export function EditTableOperationsPanel({
  loadingColumns,
  isBusy,
  columns,
  manageableIndexes,
  currentTableName,
  engineTypeLabel,
  engineDataTypes,
  nextTableName,
  onNextTableNameChange,
  renameTableNameError,
  onRenameTable,
  newColumnName,
  onNewColumnNameChange,
  newColumnNameError,
  newColumnType,
  onNewColumnTypeChange,
  newColumnTypeParams,
  onNewColumnTypeParamsChange,
  newColumnTypeParamError,
  newColumnDefault,
  onNewColumnDefaultChange,
  newColumnNotNull,
  onNewColumnNotNullChange,
  onAddColumn,
  renameColumnFrom,
  onRenameColumnFromChange,
  renameColumnTo,
  onRenameColumnToChange,
  renameColumnToError,
  onRenameColumn,
  newIndexName,
  onNewIndexNameChange,
  newIndexNameError,
  newIndexUnique,
  onNewIndexUniqueChange,
  newIndexColumns,
  onToggleIndexColumn,
  selectedCreateIndexColumnsCount,
  createIndexColumnsError,
  onCreateIndex,
  dropIndexName,
  onDropIndexNameChange,
  dropIndexConfirm,
  onDropIndexConfirmChange,
  onDropIndex,
  dropColumnName,
  onDropColumnNameChange,
  dropConfirm,
  onDropConfirmChange,
  onDropColumn,
}: EditTableOperationsPanelProps) {
  return (
    <div className="space-y-4">
      <section className="rounded-md border border-border bg-surface/20 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Table2 size={14} className="text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Rename Table
          </h3>
        </div>
        <div className="flex flex-col gap-2 md:flex-row">
          <Input
            value={nextTableName}
            onChange={(e) => onNextTableNameChange(e.target.value)}
            placeholder="New table name"
            className={cn(FORM_FIELD_CLASS, renameTableNameError && FIELD_ERROR_CLASS)}
          />
          <Button
            onClick={onRenameTable}
            disabled={
              loadingColumns ||
              isBusy('rename-table') ||
              !nextTableName.trim() ||
              nextTableName.trim() === currentTableName ||
              Boolean(renameTableNameError)
            }
            className="h-9 md:min-w-[130px]"
          >
            {isBusy('rename-table') ? (
              <Loader2 size={14} className="mr-1.5 animate-spin" />
            ) : null}
            Rename
          </Button>
        </div>
        {renameTableNameError && (
          <p className="mt-2 text-[11px] text-destructive">{renameTableNameError}</p>
        )}
      </section>

      <section className="rounded-md border border-border bg-surface/20 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Type size={14} className="text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Add Column
          </h3>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            value={newColumnName}
            onChange={(e) => onNewColumnNameChange(e.target.value)}
            placeholder="Column name"
            className={cn(FORM_FIELD_CLASS, newColumnNameError && FIELD_ERROR_CLASS)}
          />
          <Select value={newColumnType} onValueChange={onNewColumnTypeChange}>
            <SelectTrigger className={cn(FORM_FIELD_CLASS, 'justify-start gap-2')}>
              <span
                className={cn(
                  'font-mono text-xs font-semibold tracking-wider',
                  getSqliteTypeColor(newColumnType),
                )}
              >
                {newColumnType}
              </span>
            </SelectTrigger>
            <SelectContent className="border-border/80">
              <SelectGroup>
                <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {engineTypeLabel}
                </SelectLabel>
                {engineDataTypes.map((typeOption) => (
                  <SelectItem
                    key={typeOption.value}
                    value={typeOption.value}
                    className={cn(
                      'font-mono text-xs font-semibold tracking-wider focus:bg-background/70',
                      getSqliteTypeColor(typeOption.value),
                    )}
                  >
                    {typeOption.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {/* Type Parameters */}
          {supportsTypeParams(newColumnType) && onNewColumnTypeParamsChange ? (
            <TypeParameterFields
              typeValue={newColumnType}
              params={newColumnTypeParams}
              onChange={onNewColumnTypeParamsChange}
              size="default"
            />
          ) : null}
          <Input
            value={newColumnDefault}
            onChange={(e) => onNewColumnDefaultChange(e.target.value)}
            placeholder="DEFAULT value/expression (optional)"
            className={cn(FORM_FIELD_CLASS, 'md:col-span-2')}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={newColumnNotNull}
              onCheckedChange={(value) => onNewColumnNotNullChange(!!value)}
            />
            NOT NULL
          </label>
          <Button
            onClick={onAddColumn}
            disabled={
              loadingColumns ||
              isBusy('add-column') ||
              !newColumnName.trim() ||
              Boolean(newColumnNameError) ||
              Boolean(newColumnTypeParamError)
            }
            className="h-8"
          >
            {isBusy('add-column') ? (
              <Loader2 size={13} className="mr-1.5 animate-spin" />
            ) : null}
            Add Column
          </Button>
        </div>
        {newColumnNameError && (
          <p className="mt-2 text-[11px] text-destructive">{newColumnNameError}</p>
        )}
      </section>

      <section className="rounded-md border border-border bg-surface/20 p-4">
        <div className="mb-3 flex items-center gap-2">
          <PencilRuler size={14} className="text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Rename Column
          </h3>
        </div>
        <div className="grid gap-2 md:grid-cols-[1fr,1fr,auto]">
          <Select value={renameColumnFrom} onValueChange={onRenameColumnFromChange}>
            <SelectTrigger className={FORM_FIELD_CLASS}>
              <SelectValue placeholder="Current column" />
            </SelectTrigger>
            <SelectContent>
              {columns.map((column) => (
                <SelectItem
                  key={`rename-${column.cid}-${column.name}`}
                  value={column.name}
                >
                  {column.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={renameColumnTo}
            onChange={(e) => onRenameColumnToChange(e.target.value)}
            placeholder="New column name"
            className={cn(FORM_FIELD_CLASS, renameColumnToError && FIELD_ERROR_CLASS)}
          />
          <Button
            onClick={onRenameColumn}
            disabled={
              loadingColumns ||
              isBusy('rename-column') ||
              !renameColumnFrom.trim() ||
              !renameColumnTo.trim() ||
              Boolean(renameColumnToError)
            }
            className="h-9"
          >
            {isBusy('rename-column') ? (
              <Loader2 size={13} className="mr-1.5 animate-spin" />
            ) : null}
            Rename
          </Button>
        </div>
        {renameColumnToError && (
          <p className="mt-2 text-[11px] text-destructive">{renameColumnToError}</p>
        )}
      </section>

      <section className="rounded-md border border-border bg-surface/20 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Hash size={14} className="text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Create Index
          </h3>
        </div>
        <div className="grid gap-2 md:grid-cols-[1fr,auto] md:items-center">
          <Input
            value={newIndexName}
            onChange={(e) => onNewIndexNameChange(e.target.value)}
            placeholder="index_name"
            className={cn(FORM_FIELD_CLASS, newIndexNameError && FIELD_ERROR_CLASS)}
          />
          <Button
            onClick={onCreateIndex}
            disabled={
              loadingColumns ||
              isBusy('create-index') ||
              !newIndexName.trim() ||
              selectedCreateIndexColumnsCount === 0 ||
              Boolean(newIndexNameError)
            }
            className="h-9 md:min-w-[140px]"
          >
            {isBusy('create-index') ? (
              <Loader2 size={13} className="mr-1.5 animate-spin" />
            ) : null}
            Create Index
          </Button>
        </div>
        <div className="mt-2">
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={newIndexUnique}
              onCheckedChange={(value) => onNewIndexUniqueChange(!!value)}
            />
            Unique Index
          </label>
        </div>
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Index Columns
          </p>
          {columns.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No columns available.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {columns.map((column) => (
                <label
                  key={`index-col-${column.cid}-${column.name}`}
                  className={
                    'inline-flex items-center gap-2 rounded-md border ' +
                    'border-border/70 bg-background/30 px-2.5 py-2 text-xs text-muted-foreground'
                  }
                >
                  <Checkbox
                    checked={newIndexColumns.includes(column.name)}
                    onCheckedChange={() => onToggleIndexColumn(column.name)}
                  />
                  <span className="font-mono text-foreground">{column.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        {newIndexNameError && (
          <p className="mt-2 text-[11px] text-destructive">{newIndexNameError}</p>
        )}
        {createIndexColumnsError && (
          <p className="mt-2 text-[11px] text-destructive">{createIndexColumnsError}</p>
        )}
      </section>

      <section className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Trash2 size={14} className="text-destructive" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-destructive/90">
            Drop Index
          </h3>
        </div>
        <div className="grid gap-2 md:grid-cols-[1fr,auto,auto] md:items-center">
          <Select
            value={dropIndexName}
            onValueChange={(value) => {
              onDropIndexNameChange(value);
              onDropIndexConfirmChange(false);
            }}
          >
            <SelectTrigger className={FORM_FIELD_CLASS}>
              <SelectValue placeholder="Choose index to drop" />
            </SelectTrigger>
            <SelectContent>
              {manageableIndexes.map((index) => (
                <SelectItem key={`drop-index-${index.name}`} value={index.name}>
                  {index.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label
            className={
              'inline-flex items-center gap-2 rounded-md border ' +
              'border-border/70 bg-background/30 px-3 py-2 text-xs text-muted-foreground'
            }
          >
            <Checkbox
              checked={dropIndexConfirm}
              onCheckedChange={(value) => onDropIndexConfirmChange(!!value)}
              disabled={!dropIndexName}
            />
            Confirm
          </label>
          <Button
            variant="destructive"
            onClick={onDropIndex}
            disabled={
              loadingColumns ||
              isBusy('drop-index') ||
              !dropIndexName.trim() ||
              !dropIndexConfirm
            }
            className="h-9"
          >
            {isBusy('drop-index') ? (
              <Loader2 size={13} className="mr-1.5 animate-spin" />
            ) : null}
            Drop Index
          </Button>
        </div>
        {manageableIndexes.length === 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            No user-defined indexes available to drop.
          </p>
        )}
      </section>

      <section className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Trash2 size={14} className="text-destructive" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-destructive/90">
            Drop Column
          </h3>
        </div>
        <div className="grid gap-2 md:grid-cols-[1fr,auto,auto] md:items-center">
          <Select value={dropColumnName} onValueChange={onDropColumnNameChange}>
            <SelectTrigger className={FORM_FIELD_CLASS}>
              <SelectValue placeholder="Choose column to drop" />
            </SelectTrigger>
            <SelectContent>
              {columns.map((column) => (
                <SelectItem
                  key={`drop-${column.cid}-${column.name}`}
                  value={column.name}
                >
                  {column.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label
            className={
              'inline-flex items-center gap-2 rounded-md border ' +
              'border-border/70 bg-background/30 px-3 py-2 text-xs text-muted-foreground'
            }
          >
            <Checkbox
              checked={dropConfirm}
              onCheckedChange={(value) => onDropConfirmChange(!!value)}
            />
            Confirm
          </label>
          <Button
            variant="destructive"
            onClick={onDropColumn}
            disabled={
              loadingColumns ||
              isBusy('drop-column') ||
              !dropColumnName.trim() ||
              !dropConfirm
            }
            className="h-9"
          >
            {isBusy('drop-column') ? (
              <Loader2 size={13} className="mr-1.5 animate-spin" />
            ) : null}
            Drop
          </Button>
        </div>
      </section>
    </div>
  );
}

interface EditTableSchemaSidebarProps {
  loadingColumns: boolean;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
}

export function EditTableSchemaSidebar({
  loadingColumns,
  columns,
  indexes,
}: EditTableSchemaSidebarProps) {
  return (
    <aside className="rounded-md border border-border bg-surface/30 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Current Schema
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Live structure after each operation
          </p>
        </div>
        <span
          className={
            'rounded-md border border-border/60 bg-background/50 ' +
            'px-2 py-1 text-[10px] font-mono text-muted-foreground'
          }
        >
          {columns.length} cols / {indexes.length} idx
        </span>
      </div>

      <div className="max-h-[70vh] overflow-auto custom-scrollbar-hide">
        {loadingColumns ? (
          <div className="flex items-center gap-2 px-4 py-4 text-xs text-muted-foreground">
            <Loader2 size={13} className="animate-spin" />
            Loading table structure...
          </div>
        ) : columns.length === 0 ? (
          <div className="px-4 py-6 text-xs text-muted-foreground">
            No columns found for this table.
          </div>
        ) : (
          <div>
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-secondary/70 backdrop-blur-sm">
                <tr className="border-b border-border/60 text-muted-foreground">
                  <th className="px-4 py-2 text-left font-semibold uppercase tracking-wider">Name</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Type</th>
                  <th className="px-3 py-2 text-center font-semibold uppercase tracking-wider">NN</th>
                  <th className="px-3 py-2 text-center font-semibold uppercase tracking-wider">PK</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((column, index) => (
                  <tr
                    key={`${column.cid}-${column.name}`}
                    className={cn(
                      'border-b border-border/40',
                      index % 2 === 0 ? 'bg-transparent' : 'bg-secondary/20',
                    )}
                  >
                    <td className="px-4 py-2 font-medium text-foreground">{column.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatColumnTypeDisplay(column.col_type)}
                    </td>
                    <td className="px-3 py-2 text-center text-muted-foreground">
                      {column.notnull ? 'Y' : 'N'}
                    </td>
                    <td className="px-3 py-2 text-center text-muted-foreground">
                      {column.pk ? 'Y' : 'N'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-border/60 bg-background/20 px-4 py-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Indexes
              </div>
              {indexes.length === 0 ? (
                <div className="text-[11px] text-muted-foreground">No indexes found.</div>
              ) : (
                <div className="space-y-1.5">
                  {indexes.map((index) => (
                    <div
                      key={`schema-index-${index.name}`}
                      className="rounded-sm border border-border/60 bg-background/40 px-2.5 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-foreground">{index.name}</span>
                        {index.unique && (
                          <span className="rounded-sm border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-500">
                            Unique
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {index.columns.length > 0 ? index.columns.join(', ') : 'Expression/unknown columns'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
