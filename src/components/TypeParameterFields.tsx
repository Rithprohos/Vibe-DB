import { useCallback, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import {
  getTypeParamConfig,
  normalizeTypeParams,
  supportsExtendedPostgresNumericScale,
  validateTypeParams,
  type SupportedEngine,
  type TypeParams,
} from '../lib/createTableConstants';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Props {
  typeValue: string;
  params?: TypeParams;
  onChange: (params: TypeParams | undefined) => void;
  engineType?: SupportedEngine;
  size?: 'compact' | 'default';
}

function parseIntegerInput(event: ChangeEvent<HTMLInputElement>): number | undefined {
  const value = event.target.value.trim();
  if (value === '') {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function TypeParameterFields({
  typeValue,
  params,
  onChange,
  engineType = 'sqlite',
  size = 'default',
}: Props) {
  const config = useMemo(() => getTypeParamConfig(typeValue), [typeValue]);
  const normalizedParams = useMemo(
    () => normalizeTypeParams(typeValue, params),
    [typeValue, params],
  );
  const error = useMemo(
    () => validateTypeParams(typeValue, normalizedParams, engineType),
    [engineType, typeValue, normalizedParams],
  );
  const allowsNegativeScale = useMemo(
    () => supportsExtendedPostgresNumericScale(typeValue, engineType),
    [engineType, typeValue],
  );

  const updateParams = useCallback(
    (updates: Partial<TypeParams>) => {
      onChange(normalizeTypeParams(typeValue, { ...normalizedParams, ...updates }));
    },
    [normalizedParams, onChange, typeValue],
  );

  const handleLengthChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateParams({ length: parseIntegerInput(event) });
    },
    [updateParams],
  );

  const handlePrecisionChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateParams({ precision: parseIntegerInput(event) });
    },
    [updateParams],
  );

  const handleScaleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateParams({ scale: parseIntegerInput(event) });
    },
    [updateParams],
  );

  if (!config?.supportsParams || !config.paramType) {
    return null;
  }

  const commonClassName =
    size === 'compact'
      ? 'h-6 bg-transparent border-border/50 px-1.5 text-center text-xs'
      : 'h-8 bg-transparent border-border/60 px-2 text-center text-xs';
  const numberInputClassName =
    '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

  const errorClassName = error ? 'border-destructive/50' : '';

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex items-center gap-2">
        {config.paramType === 'length' ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">(</span>
            <Input
              type="number"
              min={1}
              max={10485760}
              placeholder="255"
              value={normalizedParams?.length ?? ''}
              onChange={handleLengthChange}
              className={cn(
                commonClassName,
                numberInputClassName,
                size === 'compact' ? 'w-16' : 'w-20',
                errorClassName,
              )}
              aria-label={`${typeValue} length`}
            />
            <span className="text-[10px] text-muted-foreground">)</span>
          </div>
        ) : null}
        {config.paramType === 'precision-scale' ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">(</span>
            <Input
              type="number"
              min={1}
              max={1000}
              placeholder="p"
              title="Precision"
              value={normalizedParams?.precision ?? ''}
              onChange={handlePrecisionChange}
              className={cn(
                commonClassName,
                numberInputClassName,
                size === 'compact' ? 'w-12' : 'w-16',
                errorClassName,
              )}
              aria-label={`${typeValue} precision`}
            />
            <span className="text-[10px] text-muted-foreground">,</span>
            <Input
              type="number"
              min={allowsNegativeScale ? -1000 : 0}
              max={1000}
              placeholder="s"
              title="Scale"
              value={normalizedParams?.scale ?? ''}
              onChange={handleScaleChange}
              className={cn(
                commonClassName,
                numberInputClassName,
                size === 'compact' ? 'w-12' : 'w-16',
                errorClassName,
              )}
              aria-label={`${typeValue} scale`}
            />
            <span className="text-[10px] text-muted-foreground">)</span>
          </div>
        ) : null}
        {config.paramType === 'precision' ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">(</span>
            <Input
              type="number"
              min={0}
              max={6}
              placeholder="0-6"
              title="Precision (0-6)"
              value={normalizedParams?.precision ?? ''}
              onChange={handlePrecisionChange}
              className={cn(
                commonClassName,
                numberInputClassName,
                size === 'compact' ? 'w-14' : 'w-20',
                errorClassName,
              )}
              aria-label={`${typeValue} precision`}
            />
            <span className="text-[10px] text-muted-foreground">)</span>
          </div>
        ) : null}
      </div>
      {error ? (
        <p className={cn('leading-tight text-destructive', size === 'compact' ? 'text-[9px]' : 'text-[11px]')}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
