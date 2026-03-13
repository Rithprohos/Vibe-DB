import {
  ChevronDown,
  ChevronRight,
  Link2,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type {
  CheckConstraint,
  ColumnDef,
  ForeignKeyConstraint,
} from '../../lib/createTableConstants';
import { FK_ACTION_OPTIONS } from '../../lib/createTableConstants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface ExpandedConstraintSections {
  foreignKeys: boolean;
  checkConstraints: boolean;
}

interface ConstraintsSectionProps {
  tableName: string;
  columns: ColumnDef[];
  foreignKeys: ForeignKeyConstraint[];
  checkConstraints: CheckConstraint[];
  referenceTableOptions: string[];
  referenceColumnsByTable: Record<string, string[]>;
  loadingReferenceColumnsByTable: Record<string, boolean>;
  expandedSections: ExpandedConstraintSections;
  onToggleSection: (section: keyof ExpandedConstraintSections) => void;
  onAddForeignKey: () => void;
  onUpdateForeignKey: (id: string, updates: Partial<ForeignKeyConstraint>) => void;
  onRemoveForeignKey: (id: string) => void;
  onAddCheckConstraint: () => void;
  onUpdateCheckConstraint: (id: string, updates: Partial<CheckConstraint>) => void;
  onRemoveCheckConstraint: (id: string) => void;
}

export function ConstraintsSection({
  tableName,
  columns,
  foreignKeys,
  checkConstraints,
  referenceTableOptions,
  referenceColumnsByTable,
  loadingReferenceColumnsByTable,
  expandedSections,
  onToggleSection,
  onAddForeignKey,
  onUpdateForeignKey,
  onRemoveForeignKey,
  onAddCheckConstraint,
  onUpdateCheckConstraint,
  onRemoveCheckConstraint,
}: ConstraintsSectionProps) {
  const UNSET_SELECT_VALUE = '__vibedb_none__';
  const FK_LABEL_CLASS =
    'text-[10px] uppercase tracking-wider text-muted-foreground mb-1 h-8 flex items-end';

  return (
    <div className="mt-8 space-y-4">
      <div className="rounded-md border border-border bg-surface/[0.3] overflow-hidden glass-panel panel-shadow">
        <button
          type="button"
          onClick={() => onToggleSection('foreignKeys')}
          className="w-full flex items-center justify-between px-4 py-3 bg-secondary/40 hover:bg-secondary/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Link2 size={16} className="text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
              Foreign Keys
            </span>
            <span className="bg-secondary px-1.5 py-0.5 rounded text-[10px] font-mono border border-border text-muted-foreground">
              {foreignKeys.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                onAddForeignKey();
              }}
              className="h-6 px-2 text-xs hover:bg-primary/20 hover:text-primary"
            >
              <Plus size={12} className="mr-1" />
              Add
            </Button>
            {expandedSections.foreignKeys ? (
              <ChevronDown size={16} className="text-muted-foreground" />
            ) : (
              <ChevronRight size={16} className="text-muted-foreground" />
            )}
          </div>
        </button>

        {expandedSections.foreignKeys && (
          <div className="p-4 space-y-3">
            {foreignKeys.length === 0 ? (
              <div className="text-xs text-muted-foreground/60 text-center py-4">
                No foreign keys defined. Click "Add" to create one.
              </div>
            ) : (
              foreignKeys.map((fk) => {
                const trimmedReferencedTable = fk.referencedTable.trim();
                const availableReferenceColumns = trimmedReferencedTable
                  ? (referenceColumnsByTable[trimmedReferencedTable] ?? [])
                  : [];
                const isLoadingReferencedColumns = trimmedReferencedTable
                  ? Boolean(loadingReferenceColumnsByTable[trimmedReferencedTable])
                  : false;

                return (
                  <div
                    key={fk.id}
                    className="grid grid-cols-12 gap-2 items-start p-3 rounded-sm bg-background/50 border border-border/50"
                  >
                    <div className="col-span-2">
                      <label className={FK_LABEL_CLASS}>
                        Column
                      </label>
                      <Select
                        value={fk.columnName}
                        onValueChange={(value) =>
                          onUpdateForeignKey(fk.id, { columnName: value })
                        }
                      >
                        <SelectTrigger className="h-8 bg-transparent border-border/50 text-xs">
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          {columns
                            .filter((column) => column.name.trim())
                            .map((column) => (
                              <SelectItem key={column.id} value={column.name.trim()}>
                                {column.name.trim()}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <label className={FK_LABEL_CLASS}>
                        References Table
                      </label>
                      <Select
                        value={fk.referencedTable || UNSET_SELECT_VALUE}
                        onValueChange={(value) =>
                          onUpdateForeignKey(fk.id, {
                            referencedTable: value === UNSET_SELECT_VALUE ? '' : value,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 bg-transparent border-border/50 text-xs">
                          <SelectValue
                            placeholder={
                              referenceTableOptions.length > 0
                                ? 'Select table'
                                : 'No tables found'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNSET_SELECT_VALUE}>Select table</SelectItem>
                          {referenceTableOptions.map((tableName) => (
                            <SelectItem key={tableName} value={tableName}>
                              {tableName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <label className={FK_LABEL_CLASS}>
                        References Column
                      </label>
                      <Select
                        value={fk.referencedColumn || UNSET_SELECT_VALUE}
                        onValueChange={(value) =>
                          onUpdateForeignKey(fk.id, {
                            referencedColumn: value === UNSET_SELECT_VALUE ? '' : value,
                          })
                        }
                        disabled={
                          !trimmedReferencedTable ||
                          isLoadingReferencedColumns ||
                          availableReferenceColumns.length === 0
                        }
                      >
                        <SelectTrigger className="h-8 bg-transparent border-border/50 text-xs">
                          <SelectValue
                            placeholder={
                              !trimmedReferencedTable
                                ? 'Select table first'
                                : isLoadingReferencedColumns
                                  ? 'Loading columns...'
                                  : 'Select column'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNSET_SELECT_VALUE}>Select column</SelectItem>
                          {availableReferenceColumns.map((columnName) => (
                            <SelectItem key={columnName} value={columnName}>
                              {columnName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <label className={FK_LABEL_CLASS}>
                        On Delete
                      </label>
                      <Select
                        value={fk.onDelete || 'none'}
                        onValueChange={(value) =>
                          onUpdateForeignKey(fk.id, {
                            onDelete:
                              value === 'none'
                                ? undefined
                                : (value as ForeignKeyConstraint['onDelete']),
                          })
                        }
                      >
                        <SelectTrigger className="h-8 bg-transparent border-border/50 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Action</SelectItem>
                          {FK_ACTION_OPTIONS.filter((option) => option.value).map((option) => (
                            <SelectItem key={option.value} value={option.value!}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <label className={FK_LABEL_CLASS}>
                        On Update
                      </label>
                      <Select
                        value={fk.onUpdate || 'none'}
                        onValueChange={(value) =>
                          onUpdateForeignKey(fk.id, {
                            onUpdate:
                              value === 'none'
                                ? undefined
                                : (value as ForeignKeyConstraint['onUpdate']),
                          })
                        }
                      >
                        <SelectTrigger className="h-8 bg-transparent border-border/50 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Action</SelectItem>
                          {FK_ACTION_OPTIONS.filter((option) => option.value).map((option) => (
                            <SelectItem key={option.value} value={option.value!}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1 flex justify-end pt-5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveForeignKey(fk.id)}
                        className="w-7 h-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <div className="rounded-md border border-border bg-surface/[0.3] overflow-hidden glass-panel panel-shadow">
        <button
          type="button"
          onClick={() => onToggleSection('checkConstraints')}
          className="w-full flex items-center justify-between px-4 py-3 bg-secondary/40 hover:bg-secondary/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-info" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
              Check Constraints
            </span>
            <span className="bg-secondary px-1.5 py-0.5 rounded text-[10px] font-mono border border-border text-muted-foreground">
              {checkConstraints.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                onAddCheckConstraint();
              }}
              className="h-6 px-2 text-xs hover:bg-info/20 hover:text-info"
            >
              <Plus size={12} className="mr-1" />
              Add
            </Button>
            {expandedSections.checkConstraints ? (
              <ChevronDown size={16} className="text-muted-foreground" />
            ) : (
              <ChevronRight size={16} className="text-muted-foreground" />
            )}
          </div>
        </button>

        {expandedSections.checkConstraints && (
          <div className="p-4 space-y-3">
            {checkConstraints.length === 0 ? (
              <div className="text-xs text-muted-foreground/60 text-center py-4">
                No check constraints defined. Click "Add" to create one.
              </div>
            ) : (
              checkConstraints.map((constraint, index) => (
                <div
                  key={constraint.id}
                  className="grid grid-cols-12 gap-2 items-start p-3 rounded-sm bg-background/50 border border-border/50"
                >
                  <div className="col-span-4">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
                      Constraint Name (optional)
                    </label>
                    <Input
                      type="text"
                      value={constraint.name}
                      onChange={(event) =>
                        onUpdateCheckConstraint(constraint.id, {
                          name: event.target.value,
                        })
                      }
                      placeholder={`chk_${tableName}_${index + 1}`}
                      className="h-8 bg-transparent border-border/50 text-xs"
                    />
                  </div>
                  <div className="col-span-7">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
                      Expression
                    </label>
                    <Input
                      type="text"
                      value={constraint.expression}
                      onChange={(event) =>
                        onUpdateCheckConstraint(constraint.id, {
                          expression: event.target.value,
                        })
                      }
                      placeholder="price > 0"
                      className="h-8 bg-transparent border-border/50 text-xs font-mono"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end pt-5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveCheckConstraint(constraint.id)}
                      className="w-7 h-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
