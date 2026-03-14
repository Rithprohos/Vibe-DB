import { memo, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import {
  canUseAutoIncrement,
  DEFAULT_OPTIONS,
  getDataTypesForEngine,
  type ColumnDef,
  type SupportedEngine,
} from '../../lib/createTableConstants';
import { TypeParameterFields } from '../TypeParameterFields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';
import { GripVertical, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColumnRowProps {
  col: ColumnDef;
  index: number;
  engineType: SupportedEngine;
  engineDataTypes: ReturnType<typeof getDataTypesForEngine>;
  engineTypeLabel: string;
  hasError: string | undefined;
  canRemove: boolean;
  onUpdate: (id: string, updates: Partial<ColumnDef>) => void;
  onRemove: (id: string) => void;
  onMovePk: (targetId: string) => void;
}

export const ColumnRow = memo(function ColumnRow({
  col,
  index,
  engineType,
  engineDataTypes,
  engineTypeLabel,
  hasError,
  canRemove,
  onUpdate,
  onRemove,
  onMovePk,
}: ColumnRowProps) {
  const canToggleAutoIncrement = col.primaryKey && canUseAutoIncrement(engineType, col.type);

  const handleNameChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onUpdate(col.id, { name: e.target.value });
    },
    [col.id, onUpdate],
  );

  const handleTypeChange = useCallback(
    (val: string) => {
      onUpdate(col.id, { type: val, typeParams: undefined });
    },
    [col.id, onUpdate],
  );

  const handlePkChange = useCallback(
    (v: boolean | 'indeterminate') => {
      if (v && !col.primaryKey) {
        onMovePk(col.id);
      } else {
        onUpdate(col.id, { primaryKey: !!v });
      }
    },
    [col.id, col.primaryKey, onUpdate, onMovePk],
  );

  const handleAutoIncrementChange = useCallback(
    (v: boolean | 'indeterminate') => {
      onUpdate(col.id, { autoIncrement: !!v });
    },
    [col.id, onUpdate],
  );

  const handleNotNullChange = useCallback(
    (v: boolean | 'indeterminate') => {
      onUpdate(col.id, { notNull: !!v });
    },
    [col.id, onUpdate],
  );

  const handleUniqueChange = useCallback(
    (v: boolean | 'indeterminate') => {
      onUpdate(col.id, { unique: !!v });
    },
    [col.id, onUpdate],
  );

  const handleDefaultOptionChange = useCallback(
    (val: string) => {
      onUpdate(col.id, {
        defaultOption: val || 'none',
        defaultValue: '',
      });
    },
    [col.id, onUpdate],
  );

  const handleDefaultValueChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onUpdate(col.id, { defaultValue: e.target.value });
    },
    [col.id, onUpdate],
  );

  const handleRemove = useCallback(() => {
    onRemove(col.id);
  }, [col.id, onRemove]);

  return (
    <TableRow
      className={cn(
        'border-border/20 transition-colors group',
        index % 2 === 0 ? 'bg-transparent' : 'bg-secondary/10',
      )}
    >
      <TableCell className="pl-3 py-2">
        <div className="flex items-center justify-center text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors">
          <GripVertical size={14} />
        </div>
      </TableCell>

      <TableCell className="py-2">
        <Input
          type="text"
          value={col.name}
          onChange={handleNameChange}
          placeholder="column_name"
          className={cn(
            'bg-transparent border-border/50 placeholder:text-muted-foreground/30 text-sm font-medium h-8 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary',
            hasError &&
              'border-destructive/70 focus-visible:ring-destructive focus-visible:border-destructive',
          )}
        />
        {hasError && (
          <div className="mt-1 text-[10px] text-destructive leading-tight">
            {hasError}
          </div>
        )}
      </TableCell>

      <TableCell className="py-2">
        <Select value={col.type} onValueChange={handleTypeChange}>
          <SelectTrigger className="h-8 bg-transparent border-border/50 text-sm focus:ring-1 focus:ring-primary">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {engineTypeLabel}
              </SelectLabel>
              {engineDataTypes.map((typeOption) => (
                <SelectItem key={typeOption.value} value={typeOption.value}>
                  <span className={cn('font-mono text-xs font-bold', typeOption.color)}>
                    {typeOption.label}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <TypeParameterFields
          typeValue={col.type}
          params={col.typeParams}
          onChange={(typeParams) => onUpdate(col.id, { typeParams })}
          size="compact"
        />
      </TableCell>

      <TableCell className="text-center py-2">
        <div className="flex items-center justify-center">
          <Checkbox
            checked={col.primaryKey}
            onCheckedChange={handlePkChange}
            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
        </div>
      </TableCell>

      <TableCell className="text-center py-2">
        <div className="flex items-center justify-center">
          <Checkbox
            checked={col.autoIncrement}
            onCheckedChange={handleAutoIncrementChange}
            disabled={!canToggleAutoIncrement}
            className={cn(
              'data-[state=checked]:bg-warning data-[state=checked]:border-warning',
              !canToggleAutoIncrement && 'opacity-30',
            )}
          />
        </div>
      </TableCell>

      <TableCell className="text-center py-2">
        <div className="flex items-center justify-center">
          <Checkbox
            checked={col.notNull}
            onCheckedChange={handleNotNullChange}
            className="data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
          />
        </div>
      </TableCell>

      <TableCell className="text-center py-2">
        <div className="flex items-center justify-center">
          <Checkbox
            checked={col.unique}
            onCheckedChange={handleUniqueChange}
            className="data-[state=checked]:bg-info data-[state=checked]:border-info"
          />
        </div>
      </TableCell>

      <TableCell className="py-2">
        <div className="flex gap-1.5">
          <Select value={col.defaultOption} onValueChange={handleDefaultOptionChange}>
            <SelectTrigger className="h-8 bg-transparent border-border/50 text-xs focus:ring-1 focus:ring-primary flex-1">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              {DEFAULT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span className="text-xs">{option.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {col.defaultOption === 'custom' && (
            <Input
              type="text"
              value={col.defaultValue}
              onChange={handleDefaultValueChange}
              placeholder="value"
              className="bg-transparent border-border/50 placeholder:text-muted-foreground/30 text-xs h-8 w-24 focus-visible:ring-1 focus-visible:ring-primary"
            />
          )}
        </div>
      </TableCell>

      <TableCell className="py-2 pr-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRemove}
          disabled={!canRemove}
          className={cn(
            'w-7 h-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity',
            'hover:bg-destructive/10 hover:text-destructive',
            !canRemove && '!opacity-0',
          )}
        >
          <Trash2 size={13} />
        </Button>
      </TableCell>
    </TableRow>
  );
});
