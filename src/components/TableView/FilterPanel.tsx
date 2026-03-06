import { Filter, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { OPERATORS, UNARY_OPERATORS, BETWEEN_OPERATORS, type FilterCondition } from './types';

interface FilterPanelProps {
  showFilterPanel: boolean;
  filters: FilterCondition[];
  gridCols: string[];
  handleAddFilter: (availableColumns: string[]) => void;
  handleUpdateFilter: (id: string, updates: Partial<FilterCondition>) => void;
  handleRemoveFilter: (id: string) => void;
  handleApplyFilters: () => void;
  handleClearAllFilters: () => void;
}

export function FilterPanel({
  showFilterPanel,
  filters,
  gridCols,
  handleAddFilter,
  handleUpdateFilter,
  handleRemoveFilter,
  handleApplyFilters,
  handleClearAllFilters,
}: FilterPanelProps) {
  return (
    <div
      className={cn(
        'overflow-hidden bg-muted/20 transition-all duration-200 ease-out',
        showFilterPanel
          ? 'max-h-[520px] opacity-100 border-b border-border'
          : 'max-h-0 opacity-0 border-b-0 pointer-events-none'
      )}
    >
      <div
        className={cn(
          'p-4 transition-transform duration-200 ease-out',
          showFilterPanel ? 'translate-y-0' : '-translate-y-2'
        )}
      >
        <div className="w-full space-y-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Filter size={14} className="mr-2 text-primary" />
              <h3 className="text-sm font-semibold tracking-tight text-foreground/80 uppercase tracking-widest text-xs">
                Filter Conditions
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              {filters.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAllFilters}
                  className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  Clear All
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddFilter(gridCols)}
                className="h-7 text-xs border-primary/20 hover:bg-primary/5 text-primary"
              >
                <Plus size={12} className="mr-1" /> Add Rule
              </Button>
            </div>
          </div>

          {filters.length === 0 ? (
            <div className="text-center py-8 bg-background/50 rounded-xl border border-dashed border-border flex flex-col items-center justify-center min-h-[132px]">
              <Filter size={24} className="mb-2 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground/60 italic">
                No active filters. Add a rule to query your data.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filters.map((filter, index) => (
                <div
                  key={filter.id}
                  className="flex items-center space-x-2 animate-in fade-in slide-in-from-left-2 duration-200"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex-1 grid grid-cols-1 gap-2 items-center bg-background p-1 pr-2 rounded-lg border border-border/50 shadow-sm xl:grid-cols-12">
                    <Select
                      value={filter.field}
                      onValueChange={(value) =>
                        handleUpdateFilter(filter.id, { field: value })
                      }
                    >
                      <SelectTrigger className="h-8 bg-transparent border-0 text-xs font-medium text-foreground focus:ring-0 xl:col-span-4">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {gridCols.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="relative h-full flex items-center border-border/50 xl:col-span-3 xl:border-l">
                      <Select
                        value={filter.operator}
                        onValueChange={(value) =>
                          handleUpdateFilter(filter.id, { operator: value })
                        }
                      >
                        <SelectTrigger className="w-full h-8 bg-transparent border-0 text-[10px] font-bold text-primary focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OPERATORS.map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="h-8 flex items-center border-border/50 bg-secondary/5 xl:col-span-5 xl:border-l">
                      {!UNARY_OPERATORS.includes(filter.operator) && (
                        <div className="flex-1 flex items-center px-2 space-x-2">
                          <input
                            type="text"
                            autoFocus={!filter.value}
                            className="flex-1 bg-transparent text-xs outline-none py-1 text-foreground placeholder:text-muted-foreground/20 font-mono"
                            placeholder="Value..."
                            value={filter.value}
                            onChange={(event) =>
                              handleUpdateFilter(filter.id, { value: event.target.value })
                            }
                          />
                          {BETWEEN_OPERATORS.includes(filter.operator) && (
                            <>
                              <span className="text-[10px] font-bold text-muted-foreground/40 px-1">
                                AND
                              </span>
                              <input
                                type="text"
                                className="flex-1 bg-transparent text-xs outline-none py-1 text-foreground placeholder:text-muted-foreground/20 font-mono"
                                placeholder="Value..."
                                value={filter.valueTo}
                                onChange={(event) =>
                                  handleUpdateFilter(filter.id, { valueTo: event.target.value })
                                }
                              />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full flex-shrink-0"
                    onClick={() => handleRemoveFilter(filter.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {filters.length > 0 && (
            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                onClick={handleApplyFilters}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 shadow-md shadow-primary/20"
              >
                Apply Filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
