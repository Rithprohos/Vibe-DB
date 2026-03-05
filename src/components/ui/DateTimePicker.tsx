import * as React from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameDay, isSameMonth, isToday, eachDayOfInterval } from 'date-fns';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { ScrollArea } from './scroll-area';

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: (value: string) => void;
  onCancel?: () => void;
  hideFooter?: boolean;
  className?: string;
}

const PRESETS = [
  { label: 'DEFAULT', value: 'DEFAULT' },
  { label: 'NULL', value: 'NULL' },
  { label: 'now', value: 'now' },
  { label: 'today', value: 'today' },
  { label: 'tomorrow', value: 'tomorrow' },
  { label: 'yesterday', value: 'yesterday' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => 23 - i); 
const MINUTES = Array.from({ length: 60 }, (_, i) => 59 - i);
const SECONDS = Array.from({ length: 60 }, (_, i) => 59 - i);

export function DateTimePicker({ value, onChange, onSave, onCancel, hideFooter = false, className }: DateTimePickerProps) {
  // Parse initial value or default to now
  const initialDate = React.useMemo(() => {
    if (!value || value === 'NULL' || value === 'DEFAULT' || ['now', 'today', 'tomorrow', 'yesterday'].includes(value)) {
      return new Date();
    }
    try {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d;
    } catch (e) {}
    return new Date();
  }, [value]);

  const [date, setDate] = React.useState<Date>(initialDate);
  const [viewDate, setViewDate] = React.useState<Date>(initialDate);

  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate));
    const end = endOfWeek(endOfMonth(viewDate));
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  const handleDateSelect = React.useCallback((d: Date) => {
    const newDate = new Date(d);
    newDate.setHours(date.getHours());
    newDate.setMinutes(date.getMinutes());
    newDate.setSeconds(date.getSeconds());
    setDate(newDate);
    const formatted = format(newDate, "yyyy-MM-dd HH:mm:ss");
    onChange(formatted);
    // If we're in 'Add New Row' mode (no footer), picking a date is often the final step.
    // However, we want to allow time selection, so we DON'T auto-close on date pick alone.
    // But we COULD if it was a double-click. For now, let's keep it open for time adjustment.
  }, [date, onChange]);

  const handleTimeSelect = React.useCallback((type: 'hours' | 'minutes' | 'seconds', val: number) => {
    const newDate = new Date(date);
    if (type === 'hours') newDate.setHours(val);
    if (type === 'minutes') newDate.setMinutes(val);
    if (type === 'seconds') newDate.setSeconds(val);
    setDate(newDate);
    onChange(format(newDate, "yyyy-MM-dd HH:mm:ss"));
  }, [date, onChange]);

  const handlePresetSelect = React.useCallback((p: string) => {
    let finalValue = p;
    if (p === 'NULL' || p === 'DEFAULT') {
      onChange(p);
      if (hideFooter) onSave?.(p);
      return;
    }

    let targetDate = new Date();
    if (p === 'tomorrow') {
      targetDate.setDate(targetDate.getDate() + 1);
      targetDate.setHours(0, 0, 0, 0);
    } else if (p === 'yesterday') {
      targetDate.setDate(targetDate.getDate() - 1);
      targetDate.setHours(0, 0, 0, 0);
    } else if (p === 'today') {
      targetDate.setHours(0, 0, 0, 0);
    } else if (p === 'now') {
      // Keep exact current time
    }
    
    setDate(targetDate);
    setViewDate(targetDate);
    finalValue = format(targetDate, "yyyy-MM-dd HH:mm:ss");
    onChange(finalValue);
    
    // In 'Add New Row' mode, picking a preset is a terminal action.
    if (hideFooter) {
      onSave?.(finalValue);
    }
  }, [onChange, hideFooter, onSave]);

  return (
    <div 
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCancel?.();
        }
      }}
      className={cn("flex flex-col bg-popover border border-border rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200", className)}
    >
      <div className="flex h-[360px]">
        {/* Sidebar - Presets */}
        <div className="w-[150px] border-r border-border bg-muted/30 flex flex-col pt-6 p-2 gap-4">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => handlePresetSelect(p.value)}
              className={cn(
                "px-3 text-left text-sm font-mono transition-colors",
                value === p.value 
                  ? "text-primary font-bold" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Main - Calendar */}
        <div className="flex-1 flex flex-col bg-popover p-4 min-w-[300px] border-r border-border">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 px-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 bg-secondary/50 hover:bg-secondary border border-border rounded-md" 
              onClick={() => setViewDate(subMonths(viewDate, 1))}
            >
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </Button>
            <div className="text-sm font-medium flex items-center gap-2 text-foreground">
              <span className="font-bold">{format(viewDate, 'MMMM')}</span>
              <span className="text-muted-foreground font-mono">{format(viewDate, 'yyyy')}</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 bg-secondary/50 hover:bg-secondary border border-border rounded-md" 
              onClick={() => setViewDate(addMonths(viewDate, 1))}
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-px mb-4">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div key={d} className="text-center text-[11px] font-medium text-muted-foreground/60 py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {days.map((d, i) => {
              const isSelected = isSameDay(d, date);
              const isCurrentMonth = isSameMonth(d, viewDate);
              return (
                <button
                  key={i}
                  onClick={() => handleDateSelect(d)}
                  className={cn(
                    "h-10 w-full rounded-md text-sm transition-all flex items-center justify-center relative",
                    !isCurrentMonth && "text-muted-foreground/30",
                    isCurrentMonth && "text-foreground hover:bg-accent",
                    isSelected && "bg-accent text-accent-foreground font-bold rounded-lg border border-primary/30",
                    !isSelected && isToday(d) && "after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-primary after:rounded-full"
                  )}
                >
                  {format(d, 'd')}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right - Time */}
        <div className="w-[180px] bg-popover flex overflow-hidden">
          <TimeUnitColumn
            items={HOURS}
            selected={date.getHours()}
            onSelect={(v) => handleTimeSelect('hours', v)}
          />
          <TimeUnitColumn
            items={MINUTES}
            selected={date.getMinutes()}
            onSelect={(v) => handleTimeSelect('minutes', v)}
          />
          <TimeUnitColumn
            items={SECONDS}
            selected={date.getSeconds()}
            onSelect={(v) => handleTimeSelect('seconds', v)}
          />
        </div>
      </div>

      {/* Footer - Actions */}
      {!hideFooter && (
        <div className="border-t border-border p-2 flex items-center justify-end gap-2 bg-muted/30">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onCancel} 
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          <Button 
            size="sm" 
            onClick={() => onSave?.(value)} 
            className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 gap-2 shadow-glow"
          >
            <Check size={14} />
            Save Changes
          </Button>
        </div>
      )}
    </div>
  );
}

const TimeUnitColumn = React.memo(({ items, selected, onSelect }: { items: number[], selected: number, onSelect: (v: number) => void }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      const selectedElement = scrollRef.current.querySelector(`[data-selected="true"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'center', behavior: 'auto' });
      }
    }
  }, [selected]);

  return (
    <div className="flex-1 flex flex-col border-r border-border last:border-r-0">
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="flex flex-col py-4">
          {items.map((v) => (
            <button
              key={v}
              data-selected={v === selected}
              onClick={() => onSelect(v)}
              className={cn(
                "h-10 px-2 text-sm font-mono transition-colors text-center",
                v === selected 
                  ? "text-foreground font-bold bg-accent" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              {v.toString().padStart(2, '0')}
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
});

TimeUnitColumn.displayName = 'TimeUnitColumn';
