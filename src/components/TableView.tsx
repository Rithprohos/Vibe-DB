import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getTableData, getTableRowCount, getTableStructure, executeQuery } from '../lib/db';
import { formatCellValue } from '../lib/formatters';
import type { QueryResult, ColumnInfo } from '../store/useAppStore';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Plus, Check, X as XIcon, ChevronLeft, ChevronRight, XCircle, Database, AlertCircle, Filter, Trash2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';

interface Props {
  tableName: string;
  tabId: string;
}

interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
  valueTo: string;
}

const OPERATORS = [
  { value: '=', label: '=' },
  { value: '!=', label: '!=' },
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: 'LIKE', label: 'LIKE' },
  { value: 'NOT LIKE', label: 'NOT LIKE' },
  { value: 'BETWEEN', label: 'BETWEEN' },
  { value: 'NOT BETWEEN', label: 'NOT BETWEEN' },
  { value: 'IS NULL', label: 'IS NULL' },
  { value: 'IS NOT NULL', label: 'IS NOT NULL' },
];

const UNARY_OPERATORS = ['IS NULL', 'IS NOT NULL'];
const BETWEEN_OPERATORS = ['BETWEEN', 'NOT BETWEEN'];

const formatDateForInput = (value: any): string => {
  if (value === null || value === undefined || value === '') return '';
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return str.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(str)) return str.slice(0, 10);
  return '';
};

interface CellInputProps {
  initialValue: string;
  onValueChange: (val: string) => void;
  onSave: (val: string) => void;
  onCancel: () => void;
  disabled?: boolean;
  inputType?: 'text' | 'date';
}

function CellInput({ initialValue, onValueChange, onSave, onCancel, disabled, inputType = 'text' }: CellInputProps) {
  const [localValue, setLocalValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

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
        <input
          ref={inputRef}
          type="date"
          className="flex-1 h-full bg-transparent outline-none px-2 py-0.5 text-xs font-mono text-foreground cursor-pointer"
          value={localValue}
          onChange={handleChange}
          onBlur={() => onCancel()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              onSave(localValue);
            } else if (e.key === 'Escape') {
              onCancel();
            }
          }}
          disabled={disabled}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 mr-1 shrink-0"
          onClick={onCancel}
          disabled={disabled}
        >
          <XIcon className="h-3 w-3" />
        </Button>
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
        onBlur={() => onCancel()}
        onKeyDown={(e) => {
          if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            inputRef.current?.select();
            return;
          }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            onSave(localValue);
          } else if (e.key === 'Escape') {
            onCancel();
          }
        }}
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </div>
  );
}


export default function TableView({ tableName, tabId }: Props) {
  const tab = useAppStore(useCallback(s => s.tabs.find(t => t.id === tabId), [tabId]));
  const activeConnection = useAppStore(useCallback(s => s.connections.find(c => c.id === tab?.connectionId), [tab?.connectionId]));
  const [data, setData] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(200);
  const [totalRows, setTotalRows] = useState(0);
  const [structure, setStructure] = useState<ColumnInfo[]>([]);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');
  const [columnSizing, setColumnSizing] = useState({});
  
  // In-place row state
  const [newRowData, setNewRowData] = useState<Record<string, string> | null>(null);
  const newRowDataRef = useRef(newRowData);
  newRowDataRef.current = newRowData;

  // Inline editing state: only track which cell is being edited
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colName: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  // Filter state
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<FilterCondition[]>([]);

  const gridCols = useMemo(() => {
    if (data && data.columns.length > 0) return data.columns;
    return structure.map(s => s.name);
  }, [data, structure]);

  // Build WHERE clause from applied filters
  const buildWhereClause = useCallback((filterList: FilterCondition[]): string | undefined => {
    const validFilters = filterList.filter(f => {
      if (!f.field || !f.operator) return false;
      if (BETWEEN_OPERATORS.includes(f.operator)) return !!f.value && !!f.valueTo;
      if (!UNARY_OPERATORS.includes(f.operator) && !f.value) return false;
      return true;
    });
    if (validFilters.length === 0) return undefined;

    const conditions = validFilters.map(f => {
      if (f.operator === 'IS NULL') return `"${f.field}" IS NULL`;
      if (f.operator === 'IS NOT NULL') return `"${f.field}" IS NOT NULL`;
      if (f.operator === 'LIKE' || f.operator === 'NOT LIKE') {
        return `"${f.field}" ${f.operator} '${f.value.replace(/'/g, "''")}'`;
      }
      if (BETWEEN_OPERATORS.includes(f.operator)) {
        const colInfo = structure.find(c => c.name === f.field);
        const colType = colInfo?.col_type.toLowerCase() || '';
        const isNum = colType.includes('int') || colType.includes('real') || colType.includes('double') || colType.includes('float');
        const fromVal = isNum && !isNaN(Number(f.value)) ? f.value : `'${f.value.replace(/'/g, "''")}'`;
        const toVal = isNum && !isNaN(Number(f.valueTo)) ? f.valueTo : `'${f.valueTo.replace(/'/g, "''")}'`;
        return `"${f.field}" ${f.operator} ${fromVal} AND ${toVal}`;
      }
      // Check if value is numeric
      const colInfo = structure.find(c => c.name === f.field);
      const colType = colInfo?.col_type.toLowerCase() || '';
      const isNumeric = colType.includes('int') || colType.includes('real') || colType.includes('double') || colType.includes('float');
      if (isNumeric && !isNaN(Number(f.value))) {
        return `"${f.field}" ${f.operator} ${f.value}`;
      }
      return `"${f.field}" ${f.operator} '${f.value.replace(/'/g, "''")}'`;
    });

    return conditions.join(' AND ');
  }, [structure]);

  const fetchData = useCallback(async () => {
    if (!activeConnection?.connId) return;
    setLoading(true);
    setError('');
    try {
      const whereClause = buildWhereClause(appliedFilters);
      const [result, count, struct] = await Promise.all([
        getTableData(
          tableName,
          activeConnection.connId,
          pageSize,
          page * pageSize,
          sortCol || undefined,
          sortDir,
          whereClause
        ),
        getTableRowCount(tableName, activeConnection.connId, whereClause),
        getTableStructure(tableName, activeConnection.connId),
      ]);
      setData(result);
      setTotalRows(count);
      setStructure(struct);
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setLoading(false);
    }
  }, [activeConnection, tableName, page, pageSize, sortCol, sortDir, appliedFilters, buildWhereClause]);

  useEffect(() => {
    let ignore = false;
    const doFetch = async () => {
      await fetchData();
    };
    if (!ignore) doFetch();
    return () => { ignore = true; };
  }, [fetchData]);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortCol(col);
      setSortDir('ASC');
    }
    setPage(0);
  };

  const handleAddRow = () => {
    setNewRowData({});
  };

  // --- Filter handlers ---
  const handleAddFilter = () => {
    const defaultField = gridCols[0] || '';
    setFilters(prev => [...prev, { id: crypto.randomUUID(), field: defaultField, operator: '=', value: '', valueTo: '' }]);
    if (!showFilterPanel) setShowFilterPanel(true);
  };

  const handleUpdateFilter = (id: string, updates: Partial<FilterCondition>) => {
    setFilters(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const handleRemoveFilter = (id: string) => {
    setFilters(prev => {
      const next = prev.filter(f => f.id !== id);
      if (next.length === 0) {
        setShowFilterPanel(false);
        // If there were applied filters, clear them too
        if (appliedFilters.length > 0) {
          setAppliedFilters([]);
          setPage(0);
        }
      }
      return next;
    });
  };

  const handleApplyFilters = () => {
    setAppliedFilters([...filters]);
    setPage(0);
  };

  const handleClearAllFilters = () => {
    setFilters([]);
    setAppliedFilters([]);
    setShowFilterPanel(false);
    setPage(0);
  };

  const handleDiscardNewRow = () => {
    setNewRowData(null);
    setError('');
  };

  const handleSaveNewRow = async () => {
    if (!activeConnection?.connId || !newRowData) return;
    setSaving(true);
    setError('');
    const startTime = performance.now();

    try {
      const entries = Object.entries(newRowData).filter(([_, v]) => v !== '');
      if (entries.length === 0) {
        throw new Error('Please enter at least one value');
      }

      const colNames = entries.map(([k]) => `"${k}"`).join(', ');
      const placeholders = entries.map(([k, v]) => {
        const col = structure.find(c => c.name === k);
        const type = col?.col_type.toLowerCase() || '';
        if (type.includes('int') || type.includes('real') || type.includes('double')) {
          return v; 
        }
        return `'${v.replace(/'/g, "''")}'`;
      }).join(', ');

      const sql = `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders});`;
      await executeQuery(sql, activeConnection.connId);
      
      const duration = performance.now() - startTime;
      useAppStore.getState().addLog({
        sql,
        status: 'success',
        duration,
        message: 'Row inserted successfully'
      });

      setNewRowData(null);
      await fetchData();
    } catch (e: any) {
      const duration = performance.now() - startTime;
      setError(e.toString());
      useAppStore.getState().addLog({
        sql: `INSERT INTO "${tableName}" ...`,
        status: 'error',
        duration,
        message: e.toString()
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCell = async (rowIndex: number, colName: string, valueToSave: string) => {
    if (!activeConnection?.connId || !data) return;

    const row = tableData[rowIndex];
    const oldValue = row[colName];

    // If value is the same, just close editing
    if (String(oldValue) === valueToSave) {
      setEditingCell(null);
      return;
    }

    setSaving(true);
    setError('');
    const startTime = performance.now();

    try {
      // Find primary keys for WHERE clause
      const pks = structure.filter(c => c.pk);
      if (pks.length === 0) {
        throw new Error("Table has no primary key. Editing is not supported for tables without primary keys.");
      }

      const whereClause = pks.map(pk => {
        const val = row[pk.name];
        if (val === null) return `"${pk.name}" IS NULL`;
        if (typeof val === 'number') return `"${pk.name}" = ${val}`;
        return `"${pk.name}" = '${String(val).replace(/'/g, "''")}'`;
      }).join(' AND ');

      const columnInfo = structure.find(c => c.name === colName);
      const isNumeric = columnInfo?.col_type.toLowerCase().includes('int') || 
                         columnInfo?.col_type.toLowerCase().includes('real') ||
                         columnInfo?.col_type.toLowerCase().includes('double') ||
                         columnInfo?.col_type.toLowerCase().includes('float');

      let formattedValue: string;
      if (valueToSave === '') {
        formattedValue = 'NULL';
      } else if (isNumeric) {
        if (isNaN(Number(valueToSave))) {
          throw new Error(`Invalid numeric value: ${valueToSave}`);
        }
        formattedValue = valueToSave;
      } else {
        formattedValue = `'${valueToSave.replace(/'/g, "''")}'`;
      }

      const sql = `UPDATE "${tableName}" SET "${colName}" = ${formattedValue} WHERE ${whereClause};`;
      await executeQuery(sql, activeConnection.connId);

      const duration = performance.now() - startTime;
      useAppStore.getState().addLog({
        sql,
        status: 'success',
        duration,
        message: `Cell in "${tableName}" updated`
      });

      setEditingCell(null);
      setEditValue('');
      await fetchData();
    } catch (e: any) {
      const duration = performance.now() - startTime;
      setError(e.toString());
      useAppStore.getState().addLog({
        sql: `UPDATE "${tableName}" ...`,
        status: 'error',
        duration,
        message: e.toString()
      });
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.ceil(totalRows / pageSize);



  // Build columns for TanStack Table
  const columns = useMemo<ColumnDef<any>[]>(() => {
    if (!data) return [];
    
    const cols: ColumnDef<any>[] = [
      {
        id: 'rowNum',
        header: () => (
          <div className="flex flex-col justify-end items-center px-2 py-1.5 w-full h-full text-muted-foreground font-semibold text-xs pb-2">
            #
          </div>
        ),
        cell: (info) => (
          <div className="flex items-center justify-center py-1.5 px-2 w-full h-full font-mono text-muted-foreground/50 text-[10px]">
            {page * pageSize + info.row.index + 1}
          </div>
        ),
        size: 50,
        enableResizing: false,
      }
    ];

    gridCols.forEach((colName) => {
      const columnInfo = structure.find(s => s.name === colName);
      const type = columnInfo?.col_type.toLowerCase() || 'text';
      
      cols.push({
        accessorKey: colName,
        header: () => (
          <div 
            className="flex flex-col select-none cursor-pointer group px-2 py-1.5 hover:bg-muted/50 rounded-md transition-colors w-full h-full" 
            onClick={() => handleSort(colName)}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs tracking-wide text-foreground">{colName}</span>
              {sortCol === colName && (
                <span className="text-primary text-[10px]">
                  {sortDir === 'ASC' ? '▲' : '▼'}
                </span>
              )}
            </div>
            <span className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
              {type}
            </span>
          </div>
        ),
        size: 150,
      });
    });

    return cols;
  }, [data, structure, gridCols, sortCol, sortDir]);

  const tableData = useMemo(() => {
    if (!data) return [];
    return data.rows.map(row => {
      const obj: Record<string, any> = {};
      gridCols.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });
  }, [data, gridCols]);

  const table = useReactTable({
    data: tableData,
    columns,
    state: { columnSizing },
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });

  const isResizingTable = table.getState().columnSizingInfo.isResizingColumn;

  useEffect(() => {
    if (isResizingTable) {
      document.body.classList.add('select-none', 'cursor-col-resize');
    } else {
      document.body.classList.remove('select-none', 'cursor-col-resize');
    }
    return () => {
      document.body.classList.remove('select-none', 'cursor-col-resize');
    };
  }, [isResizingTable]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground w-full">
        <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary opacity-80" />
        <span className="text-sm font-medium tracking-wide">Loading data...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background relative z-0 w-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-border bg-surface/[0.5] backdrop-blur flex-shrink-0 relative z-10">
        <div className="flex items-center space-x-2">
          {!newRowData && !editingCell ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => fetchData()} className="h-8 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/50" title="Refresh">
                <RefreshCw size={14} />
                Refresh
              </Button>
              <Button variant="ghost" size="sm" onClick={handleAddRow} className="h-8 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/50" title="Add New Row">
                <Plus size={14} />
                Add Record
              </Button>
              <div className="w-px h-5 bg-border mx-1" />
              <Button 
                variant={appliedFilters.length > 0 ? 'default' : 'ghost'}
                size="sm" 
                onClick={() => {
                  if (!showFilterPanel && filters.length === 0) {
                    handleAddFilter();
                  } else {
                    setShowFilterPanel(!showFilterPanel);
                  }
                }}
                className={cn(
                  "h-8 gap-1.5 relative",
                  appliedFilters.length > 0
                    ? "bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
                title="Filter rows"
              >
                <Filter size={14} />
                Filter
                {appliedFilters.length > 0 && (
                  <span className="ml-1 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1">
                    {appliedFilters.length}
                  </span>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button 
                size="sm" 
                onClick={() => newRowData ? handleSaveNewRow() : handleSaveCell(editingCell!.rowIndex, editingCell!.colName, editValue)} 
                disabled={saving} 
                className="h-8 shadow-glow bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" 
              >
                {saving ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Check size={14} className="mr-2" />}
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider bg-background/50 px-2 py-1 border border-border rounded shadow-sm">
                ⌘ + Enter
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => newRowData ? handleDiscardNewRow() : setEditingCell(null)} 
                disabled={saving} 
                className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" 
                title="Discard (Esc)"
              >
                <XIcon size={14} />
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1 border border-border rounded-md bg-background/50 p-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm" disabled={page === 0 || !!newRowData} onClick={() => setPage(Math.max(0, page - 1))}>
              <ChevronLeft size={16} />
            </Button>
            <div className="px-3 text-xs font-medium text-muted-foreground min-w-[140px] text-center whitespace-nowrap">
              Page {page + 1} of {Math.max(1, totalPages)} &middot; <span className="text-foreground">{totalRows}</span> rows
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm" disabled={page >= totalPages - 1 || !!newRowData} onClick={() => setPage(page + 1)}>
              <ChevronRight size={16} />
            </Button>
          </div>

          {sortCol && !newRowData && (
            <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground hover:bg-secondary" onClick={() => { setSortCol(null); setPage(0); }}>
              <XCircle size={14} className="mr-1.5" />
              Clear Sort
            </Button>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilterPanel && (
        <div className="border-b border-border bg-secondary/30 backdrop-blur-sm flex-shrink-0 animate-fade-in">
          <div className="px-4 py-3 space-y-2">
            {filters.map((filter, idx) => (
              <div key={filter.id} className="flex items-center gap-2 group">
                {/* AND label or WHERE label */}
                <span className="w-14 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right flex-shrink-0">
                  {idx === 0 ? 'Where' : 'And'}
                </span>

                {/* Field select */}
                <div className="relative">
                  <select
                    value={filter.field}
                    onChange={(e) => handleUpdateFilter(filter.id, { field: e.target.value })}
                    className="h-8 pl-2.5 pr-7 text-xs font-mono bg-background border border-border rounded-md text-foreground appearance-none cursor-pointer hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors min-w-[140px]"
                  >
                    {gridCols.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                </div>

                {/* Operator select */}
                <div className="relative">
                  <select
                    value={filter.operator}
                    onChange={(e) => {
                      const newOp = e.target.value;
                      const updates: Partial<FilterCondition> = { operator: newOp };
                      if (UNARY_OPERATORS.includes(newOp)) { updates.value = ''; updates.valueTo = ''; }
                      if (!BETWEEN_OPERATORS.includes(newOp)) { updates.valueTo = ''; }
                      handleUpdateFilter(filter.id, updates);
                    }}
                    className="h-8 pl-2.5 pr-7 text-xs font-mono bg-background border border-border rounded-md text-foreground appearance-none cursor-pointer hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors min-w-[100px]"
                  >
                    {OPERATORS.map(op => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                </div>

                {/* Value input(s) */}
                {!UNARY_OPERATORS.includes(filter.operator) && (
                  (() => {
                    const colInfo = structure.find(c => c.name === filter.field);
                    const isDateCol = colInfo ? (colInfo.col_type.toLowerCase().includes('date') || colInfo.col_type.toLowerCase().includes('time')) : false;
                    return BETWEEN_OPERATORS.includes(filter.operator) ? (
                      <div className="flex items-center gap-1.5">
                        {isDateCol ? (
                          <input
                            type="date"
                            value={filter.value}
                            onChange={(e) => handleUpdateFilter(filter.id, { value: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleApplyFilters(); }}
                            className="h-8 px-2.5 text-xs font-mono bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 hover:border-primary/50 transition-colors w-[120px]"
                          />
                        ) : (
                          <input
                            type="text"
                            value={filter.value}
                            onChange={(e) => handleUpdateFilter(filter.id, { value: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleApplyFilters(); }}
                            placeholder="From..."
                            className="h-8 px-2.5 text-xs font-mono bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 hover:border-primary/50 transition-colors w-[120px]"
                            autoFocus={idx === filters.length - 1}
                          />
                        )}
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">and</span>
{isDateCol ? (
                           <input
                             type="date"
                             value={filter.valueTo}
                             onChange={(e) => handleUpdateFilter(filter.id, { valueTo: e.target.value })}
                             onKeyDown={(e) => { if (e.key === 'Enter') handleApplyFilters(); }}
                             className="h-8 px-2.5 text-xs font-mono bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 hover:border-primary/50 transition-colors w-[120px]"
                           />
                         ) : (
                          <input
                            type="text"
                            value={filter.valueTo}
                            onChange={(e) => handleUpdateFilter(filter.id, { valueTo: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleApplyFilters(); }}
                            placeholder="To..."
                            className="h-8 px-2.5 text-xs font-mono bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 hover:border-primary/50 transition-colors w-[120px]"
                          />
                        )}
                      </div>
                    ) : (
isDateCol ? (
                         <input
                           type="date"
                           value={filter.value}
                           onChange={(e) => handleUpdateFilter(filter.id, { value: e.target.value })}
                           onKeyDown={(e) => { if (e.key === 'Enter') handleApplyFilters(); }}
                           className="h-8 px-2.5 text-xs font-mono bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 hover:border-primary/50 transition-colors min-w-[160px] flex-1 max-w-[260px]"
                         />
                       ) : (
                        <input
                          type="text"
                          value={filter.value}
                          onChange={(e) => handleUpdateFilter(filter.id, { value: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleApplyFilters();
                            }
                          }}
                          placeholder="Value..."
                          className="h-8 px-2.5 text-xs font-mono bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 hover:border-primary/50 transition-colors min-w-[160px] flex-1 max-w-[260px]"
                          autoFocus={idx === filters.length - 1}
                        />
                      )
                    );
                  })()
                )}

                {/* Remove filter */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveFilter(filter.id)}
                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  title="Remove filter"
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            ))}

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <span className="w-14 flex-shrink-0" />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAddFilter}
                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus size={12} />
                Add condition
              </Button>
              <div className="flex-1" />
              {appliedFilters.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAllFilters}
                  className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                >
                  <XCircle size={12} />
                  Clear all
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleApplyFilters}
                className="h-7 px-4 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mx-4 mt-4 mb-2 p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg shadow-sm font-medium animate-fade-in flex-shrink-0 flex items-start gap-3">
          <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
          <div className="flex-1 leading-relaxed">
            {error}
          </div>
        </div>
      )}

      {/* Grid wrapper */}
      <div className="flex-1 overflow-auto custom-scrollbar relative bg-background" style={{ isolation: 'isolate' }}>
        {data && gridCols.length > 0 ? (
          <table 
            className="w-full border-collapse table-fixed text-left min-w-max"
            style={{ width: table.getCenterTotalSize() }}
          >
            <thead className="sticky top-0 z-20 bg-secondary/95 backdrop-blur-md shadow-sm">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th 
                      key={header.id}
                      className={cn(
                        "relative border-b-2 border-r border-border/50 border-b-border font-normal p-0 align-bottom",
                        header.column.id === 'rowNum' && "bg-background/40"
                      )}
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={cn(
                            "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary z-30 transition-colors",
                            header.column.getIsResizing() ? 'bg-primary shadow-glow' : 'bg-transparent'
                          )}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-background">
              {/* Virtual New Row */}
              {newRowData && (
                <tr className="bg-primary/5 hover:bg-primary/10 transition-colors border-b border-border/50 glow-shadow">
                  <td className="border-r border-border/50 p-2 text-center text-primary">
                    <Plus size={12} className="mx-auto" />
                  </td>
                  {gridCols.map((colName) => {
                    const columnInfo = structure.find(s => s.name === colName);
                    const col = table.getColumn(colName);
                    const colType = columnInfo?.col_type.toLowerCase() || 'text';
                    const isDateCol = colType.includes('date') || colType.includes('time');
                    return (
                      <td 
                        key={colName}
                        style={{ width: col?.getSize() }}
                        className="border-r border-border/50 p-0 relative group"
                      >
{isDateCol ? (
                           <input
                             type="date"
                             className="w-full h-full min-h-[32px] bg-transparent outline-none px-2 py-1.5 text-sm font-mono focus:ring-1 focus:ring-inset focus:ring-primary text-foreground placeholder:text-muted-foreground/30 transition-all placeholder:italic"
                             value={newRowData[colName] || ''}
                             onChange={(e) => setNewRowData({ ...newRowData, [colName]: e.target.value })}
                             onKeyDown={(e) => {
                               if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                 handleSaveNewRow();
                               } else if (e.key === 'Escape') {
                                 handleDiscardNewRow();
                               }
                             }}
                             disabled={saving}
                           />
                         ) : (
                          <input
                            type="text"
                            className="w-full h-full min-h-[32px] bg-transparent outline-none px-2 py-1.5 text-sm font-mono focus:ring-1 focus:ring-inset focus:ring-primary text-foreground placeholder:text-muted-foreground/30 transition-all placeholder:italic"
                            placeholder={columnInfo?.dflt_value || 'NULL'}
                            value={newRowData[colName] || ''}
                            onChange={(e) => setNewRowData({ ...newRowData, [colName]: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                handleSaveNewRow();
                              } else if (e.key === 'Escape') {
                                handleDiscardNewRow();
                              }
                            }}
                            disabled={saving}
                            autoFocus={colName === gridCols[0]}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              )}

              {table.getRowModel().rows.map((row, i) => (
                <tr 
                  key={row.id} 
                  className={cn(
                    "border-b border-border/20 transition-colors hover:bg-accent/40 group",
                    i % 2 === 0 ? "bg-transparent" : "bg-secondary/20"
                  )}
                >
                  {row.getVisibleCells().map(cell => {
                    const colId = cell.column.id;
                    const cellValue = cell.getValue();
                    
                    if (colId === 'rowNum') {
                      return (
                        <td 
                          key={cell.id}
                          className="border-r border-border/30 bg-background/20 group-hover:bg-transparent transition-colors"
                          style={{ width: cell.column.getSize() }}
                        >
                          <div className="flex items-center justify-center py-1.5 px-2 w-full h-full font-mono text-muted-foreground/50 text-[10px]">
                            {page * pageSize + cell.row.index + 1}
                          </div>
                        </td>
                      );
                    }
                    
                    const isEditing = editingCell?.rowIndex === cell.row.index && editingCell?.colName === colId;
                    const columnInfo = structure.find(s => s.name === colId);
                    const colType = columnInfo?.col_type.toLowerCase() || 'text';
                    const isDateCol = colType.includes('date') || colType.includes('time');
                    
                    if (isEditing) {
                      const formattedValue = isDateCol ? formatDateForInput(cellValue) : (cellValue === null ? '' : String(cellValue));
                      return (
                        <td 
                          key={cell.id}
                          className="border-r border-border/30 p-0 relative outline outline-2 outline-primary -outline-offset-[-2px]"
                          style={{ width: cell.column.getSize() }}
                        >
                          <CellInput
                            initialValue={formattedValue}
                            inputType={isDateCol ? 'date' : 'text'}
                            onValueChange={setEditValue}
                            onSave={(val) => handleSaveCell(cell.row.index, colId, val)}
                            onCancel={() => setEditingCell(null)}
                            disabled={saving}
                          />
                        </td>
                      );
                    }
                    
                    const { text, className } = formatCellValue(cellValue);
                    return (
                      <td 
                        key={cell.id}
                        className="border-r border-border/30 overflow-hidden text-ellipsis whitespace-nowrap"
                        style={{ width: cell.column.getSize() }}
                        onDoubleClick={() => {
                          if (newRowDataRef.current) return;
                          const formattedValue = isDateCol ? formatDateForInput(cellValue) : (cellValue === null ? '' : String(cellValue));
                          setEditValue(formattedValue);
                          setEditingCell({ rowIndex: cell.row.index, colName: colId });
                        }}
                      >
                        <div className="px-2 py-1 cell-content truncate w-full h-full cursor-text group-hover:bg-accent/10 transition-colors select-none" title={text}>
                          <span className={className}>{text}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {table.getRowModel().rows.length === 0 && !newRowData && (
                <tr>
                  <td colSpan={columns.length} className="text-center p-16 text-muted-foreground bg-accent/5">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                        <Database size={24} className="opacity-40" />
                      </div>
                      <div className="text-sm font-medium">No records found</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground h-full border-t border-border/50">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Database size={24} className="opacity-40" />
            </div>
            <div className="text-sm font-medium">No records found</div>
          </div>
        )}
      </div>
    </div>
  );
}
