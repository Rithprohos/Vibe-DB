import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const NULL_SENTINEL = '__enum_null__';

interface EnumValueSelectProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onBlur?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  allowNull?: boolean;
  className?: string;
}

export function EnumValueSelect({
  value,
  options,
  onChange,
  onBlur,
  onKeyDown,
  disabled,
  autoFocus,
  allowNull,
  className,
}: EnumValueSelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const selectValue = value === '' && allowNull ? NULL_SENTINEL : value;

  useEffect(() => {
    if (!autoFocus) return;
    triggerRef.current?.focus();
    setOpen(true);
  }, [autoFocus]);

  return (
    <Select
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          onBlur?.();
        }
      }}
      value={selectValue}
      onValueChange={(nextValue) => {
        onChange(nextValue === NULL_SENTINEL ? '' : nextValue);
      }}
      disabled={disabled}
    >
      <SelectTrigger
        ref={triggerRef}
        className={cn(
          'w-full rounded-none border-0 bg-transparent shadow-none focus:ring-1 focus:ring-inset focus:ring-primary',
          className,
        )}
        onKeyDown={onKeyDown}
      >
        <SelectValue placeholder={allowNull ? 'NULL' : 'Select value'} />
      </SelectTrigger>
      <SelectContent className="font-mono">
        {allowNull && (
          <SelectItem value={NULL_SENTINEL}>
            NULL
          </SelectItem>
        )}
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
