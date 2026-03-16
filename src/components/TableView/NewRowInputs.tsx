import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { DateTimePicker } from '../ui/DateTimePicker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export const NewRowTextInput = ({ 
  value, 
  onChange, 
  onKeyDown, 
  placeholder, 
  disabled, 
  autoFocus 
}: { 
  value: string, 
  onChange: (val: string) => void, 
  onKeyDown?: (e: React.KeyboardEvent) => void,
  placeholder: string,
  disabled?: boolean,
  autoFocus?: boolean
}) => {
  const isKeyword = value === 'DEFAULT' || value === 'NULL';
  
  return (
    <input
      type="text"
      className={cn(
        "w-full h-full min-h-[32px] bg-transparent outline-none px-2 py-1.5 text-sm font-mono focus:ring-1 focus:ring-inset focus:ring-primary placeholder:text-muted-foreground/30 transition-all placeholder:italic",
        isKeyword ? "text-primary/70 italic font-bold" : "text-foreground"
      )}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      disabled={disabled}
      autoFocus={autoFocus}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
    />
  );
};

export const NewRowDateInput = ({ value, onChange, placeholder }: { value: string, onChange: (val: string) => void, placeholder: string }) => {
  const [open, setOpen] = useState(false);
  const isKeyword = value === 'DEFAULT' || value === 'NULL';
  
  useEffect(() => {
    if (open && !value) {
      onChange(format(new Date(), "yyyy-MM-dd HH:mm:ss"));
    }
  }, [open, value, onChange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn(
          "w-full h-full min-h-[32px] bg-transparent outline-none px-2 py-1.5 text-sm font-mono cursor-pointer flex items-center",
          isKeyword ? "text-primary/70 italic font-bold" : (value ? "text-foreground" : "text-muted-foreground")
        )}>
          {value || <span className="text-muted-foreground/30 italic">{placeholder}</span>}
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="p-0 w-auto border-none bg-transparent shadow-none" 
        align="start" 
        sideOffset={-2}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
             e.stopPropagation();
             e.preventDefault();
             setOpen(false);
          } else if (e.key === 'Escape') {
             e.stopPropagation();
             e.preventDefault();
             setOpen(false);
          }
        }}
      >
        <DateTimePicker 
          value={value} 
          hideFooter={true}
          onChange={onChange} 
          onSave={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
};

const DEFAULT_SENTINEL = '__new_row_default__';
const NULL_SENTINEL = '__new_row_null__';

export const NewRowEnumInput = ({
  value,
  onChange,
  onKeyDown,
  options,
  placeholder,
  disabled,
  autoFocus,
  allowNull,
  allowDefault,
}: {
  value: string,
  onChange: (val: string) => void,
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void,
  options: string[],
  placeholder: string,
  disabled?: boolean,
  autoFocus?: boolean,
  allowNull?: boolean,
  allowDefault?: boolean,
}) => {
  const [open, setOpen] = useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (autoFocus) {
      triggerRef.current?.focus();
    }
  }, [autoFocus]);

  const isKeyword = value === 'DEFAULT' || value === 'NULL';
  const selectValue =
    value === 'DEFAULT' && allowDefault
      ? DEFAULT_SENTINEL
      : value === 'NULL' && allowNull
        ? NULL_SENTINEL
        : value || undefined;

  return (
    <Select
      open={open}
      onOpenChange={setOpen}
      value={selectValue}
      onValueChange={(nextValue) => {
        if (nextValue === DEFAULT_SENTINEL) {
          onChange('DEFAULT');
          return;
        }
        if (nextValue === NULL_SENTINEL) {
          onChange('NULL');
          return;
        }
        onChange(nextValue);
      }}
      disabled={disabled}
    >
      <SelectTrigger
        ref={triggerRef}
        className={cn(
          'h-full min-h-[32px] rounded-none border-0 bg-transparent px-2 py-1.5 text-sm font-mono shadow-none focus:ring-1 focus:ring-inset focus:ring-primary',
          isKeyword ? 'text-primary/70 italic font-bold' : 'text-foreground',
        )}
        onKeyDown={onKeyDown}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="font-mono">
        {allowDefault && (
          <SelectItem value={DEFAULT_SENTINEL}>DEFAULT</SelectItem>
        )}
        {allowNull && (
          <SelectItem value={NULL_SENTINEL}>NULL</SelectItem>
        )}
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
