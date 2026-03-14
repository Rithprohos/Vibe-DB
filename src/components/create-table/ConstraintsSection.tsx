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
  SupportedEngine,
} from '../../lib/createTableConstants';
import {
  CHECK_CONSTRAINT_OPERATOR_OPTIONS,
  CHECK_CONSTRAINT_SCOPE_OPTIONS,
  FK_ACTION_OPTIONS,
  getCheckConstraintValuePlaceholder,
} from '../../lib/createTableConstants';
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

interface ReferenceTableOption {
  value: string;
  label: string;
}

interface ConstraintsSectionProps {
  tableName: string;
  engineType: SupportedEngine;
  columns: ColumnDef[];
  foreignKeys: ForeignKeyConstraint[];
  checkConstraints: CheckConstraint[];
  referenceTableOptions: ReferenceTableOption[];
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
  engineType,
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
  const checkConstraintColumns = Array.from(
    new Set(columns.map((column) => column.name.trim()).filter(Boolean)),
  );

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
                          {referenceTableOptions.map((tableOption) => (
                            <SelectItem key={tableOption.value} value={tableOption.value}>
                              {tableOption.label}
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
                  className="p-3 rounded-sm bg-background/50 border border-border/50 space-y-3"
                >
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                    <div className="md:col-span-6">
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

                    <div className="md:col-span-4">
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
                        Mode
                      </label>
                      <Select
                        value={constraint.mode}
                        onValueChange={(value) =>
                          onUpdateCheckConstraint(constraint.id, {
                            mode: value as CheckConstraint['mode'],
                          })
                        }
                      >
                        <SelectTrigger className="h-8 bg-transparent border-border/50 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="builder">Builder</SelectItem>
                          <SelectItem value="custom">Custom SQL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="md:col-span-2 md:pt-5 md:flex md:justify-end">
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

                  {constraint.mode === 'builder' ? (
                    <>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                        <div className="md:col-span-4">
                          <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
                            Scope
                          </label>
                          <Select
                            value={constraint.scope}
                            onValueChange={(value) =>
                              onUpdateCheckConstraint(constraint.id, {
                                scope: value as CheckConstraint['scope'],
                              })
                            }
                          >
                            <SelectTrigger className="h-8 bg-transparent border-border/50 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CHECK_CONSTRAINT_SCOPE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {constraint.scope === 'table' ? (
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                          <div className="md:col-span-4">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
                              Field 1
                            </label>
                            <Select
                              value={constraint.field || UNSET_SELECT_VALUE}
                              onValueChange={(value) =>
                                onUpdateCheckConstraint(constraint.id, {
                                  field: value === UNSET_SELECT_VALUE ? '' : value,
                                })
                              }
                            >
                              <SelectTrigger className="h-8 bg-transparent border-border/50 text-xs">
                                <SelectValue
                                  placeholder={
                                    checkConstraintColumns.length > 0
                                      ? 'Select field'
                                      : 'No columns yet'
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={UNSET_SELECT_VALUE}>Select field</SelectItem>
                                {checkConstraintColumns.map((columnName) => (
                                  <SelectItem key={columnName} value={columnName}>
                                    {columnName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="md:col-span-4">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
                              Expression
                            </label>
                            <Select
                              value={constraint.operator}
                              onValueChange={(value) =>
                                onUpdateCheckConstraint(constraint.id, {
                                  operator: value as CheckConstraint['operator'],
                                })
                              }
                            >
                              <SelectTrigger className="h-8 bg-transparent border-border/50 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CHECK_CONSTRAINT_OPERATOR_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="md:col-span-4">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
                              Field 2
                            </label>
                            <Select
                              value={constraint.compareField || UNSET_SELECT_VALUE}
                              onValueChange={(value) =>
                                onUpdateCheckConstraint(constraint.id, {
                                  compareField: value === UNSET_SELECT_VALUE ? '' : value,
                                })
                              }
                            >
                              <SelectTrigger className="h-8 bg-transparent border-border/50 text-xs">
                                <SelectValue
                                  placeholder={
                                    checkConstraintColumns.length > 0
                                      ? 'Select field'
                                      : 'No columns yet'
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={UNSET_SELECT_VALUE}>Select field</SelectItem>
                                {checkConstraintColumns.map((columnName) => (
                                  <SelectItem key={columnName} value={columnName}>
                                    {columnName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                          <div className="md:col-span-4">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
                              Field
                            </label>
                            <Select
                              value={constraint.field || UNSET_SELECT_VALUE}
                              onValueChange={(value) =>
                                onUpdateCheckConstraint(constraint.id, {
                                  field: value === UNSET_SELECT_VALUE ? '' : value,
                                })
                              }
                            >
                              <SelectTrigger className="h-8 bg-transparent border-border/50 text-xs">
                                <SelectValue
                                  placeholder={
                                    checkConstraintColumns.length > 0
                                      ? 'Select field'
                                      : 'No columns yet'
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={UNSET_SELECT_VALUE}>Select field</SelectItem>
                                {checkConstraintColumns.map((columnName) => (
                                  <SelectItem key={columnName} value={columnName}>
                                    {columnName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="md:col-span-4">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
                              Expression
                            </label>
                            <Select
                              value={constraint.operator}
                              onValueChange={(value) =>
                                onUpdateCheckConstraint(constraint.id, {
                                  operator: value as CheckConstraint['operator'],
                                })
                              }
                            >
                              <SelectTrigger className="h-8 bg-transparent border-border/50 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CHECK_CONSTRAINT_OPERATOR_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="md:col-span-4">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
                              Input
                            </label>
                            <Input
                              type="text"
                              value={constraint.value}
                              onChange={(event) =>
                                onUpdateCheckConstraint(constraint.id, {
                                  value: event.target.value,
                                })
                              }
                              placeholder={getCheckConstraintValuePlaceholder(constraint.operator)}
                              className="h-8 bg-transparent border-border/50 text-xs font-mono"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
                          Generated SQL
                        </label>
                        <Input
                          type="text"
                          value={constraint.expression}
                          readOnly
                          placeholder={
                            constraint.scope === 'table'
                              ? 'Select field1, expression, and field2'
                              : 'Select field and input to generate expression'
                          }
                          className="h-8 bg-background/30 border-border/50 text-xs font-mono text-muted-foreground"
                        />
                        {constraint.operator === 'regex' && engineType !== 'postgres' && (
                          <p className="mt-1 text-[10px] text-muted-foreground/80">
                            SQLite/Turso uses <span className="font-mono">REGEXP</span> for regex and
                            may require a registered regexp function.
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div>
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
                        placeholder="price > 0 AND quantity <= max_quantity"
                        className="h-8 bg-transparent border-border/50 text-xs font-mono"
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
