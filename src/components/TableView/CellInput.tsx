import React, { useState, useEffect, useRef, memo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { DateTimePicker } from '../ui/DateTimePicker';
import type { CellInputProps } from './types';

export const CellInput = memo(({ initialValue, onValueChange, onSave, onCancel, disabled, inputType = 'text' }: CellInputProps) => {
  const [localValue, setLocalValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (inputType === 'date' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputType]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    onValueChange(val);
  };

  if (inputType === 'date') {
    return (
      <div className="flex items-center w-full h-full p-0 relative">
        <Popover open={true} onOpenChange={(open) => !open && onCancel()}>
          <PopoverTrigger asChild>
            <div className="flex-1 h-full bg-transparent outline-none px-2 py-0.5 text-xs font-mono text-foreground cursor-pointer flex items-center">
              {localValue || <span className="text-muted-foreground/50 italic">NULL</span>}
            </div>
          </PopoverTrigger>
          <PopoverContent 
            className="p-0 w-auto border-none bg-transparent shadow-none" 
            align="start" 
            sideOffset={-2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                onSave(localValue);
              } else if (e.key === 'Escape') {
                onCancel();
              }
            }}
          >
            <DateTimePicker 
              value={localValue} 
              onChange={(val) => {
                setLocalValue(val);
                onValueChange(val);
              }} 
              onSave={(val) => onSave(val)}
              onCancel={onCancel}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className="flex items-center w-full h-full p-0 relative">
      <input
        ref={inputRef}
        autoFocus
        type={inputType}
        className="flex-1 h-full bg-transparent outline-none px-2 py-0.5 text-xs font-mono text-foreground"
        value={localValue}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
            inputRef.current?.select();
            return;
          }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            onSave(localValue);
          } else if (e.key === 'Escape') {
            onCancel();
          }
        }}
        onBlur={() => {
          onSave(localValue);
        }}
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </div>
  );
});

CellInput.displayName = 'CellInput';
