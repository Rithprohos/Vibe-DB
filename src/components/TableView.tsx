import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getTableData, getTableRowCount, getTableStructure, executeQuery } from '../lib/db';
import { formatCellValue } from '../lib/formatters';
import type { QueryResult, ColumnInfo } from '../store/useAppStore';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Plus, Check, X as XIcon, ChevronLeft, ChevronRight, XCircle, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';

interface Props {
  tableName: string;
}

interface CellInputProps {
  initialValue: string;
  onValueChange: (val: string) => void;
  onSave: (val: string) => void;
  onCancel: () => void;
  disabled?: boolean;
}

function CellInput({ initialValue, onValueChange, onSave, onCancel, disabled }: CellInputProps) {
  const [localValue, setLocalValue] = useState(initialValue);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    onValueChange(val);
  };

  return (
    <div className="flex items-center w-full h-full p-0 relative bg-background border border-primary/50 shadow-sm overflow-hidden">
      <input
        autoFocus
        className="flex-1 h-full bg-transparent outline-none px-2 py-1.5 text-sm font-mono text-foreground"
        value={localValue}
        onChange={handleChange}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            onSave(localValue);
          } else if (e.key === 'Escape') {
            onCancel();
          }
        }}
        disabled={disabled}
      />
    </div>
  );
}


export default function TableView({ tableName }: Props) {
  const { activeConnection } = useAppStore();
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

  // Inline editing state: only track which cell is being edited
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colName: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  const fetchData = useCallback(async () => {
    if (!activeConnection?.connId) return;
    setLoading(true);
    setError('');
    try {
      const [result, count, struct] = await Promise.all([
        getTableData(
          tableName,
          activeConnection.connId,
          pageSize,
          page * pageSize,
          sortCol || undefined,
          sortDir
        ),
        getTableRowCount(tableName, activeConnection.connId),
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
  }, [activeConnection, tableName, page, pageSize, sortCol, sortDir]);

  useEffect(() => {
    fetchData();
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

    data.columns.forEach((colName) => {
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
        cell: (info) => {
          const rowIndex = info.row.index;
          const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colName === colName;
          const value = info.getValue();

          if (isEditing) {
            return (
              <CellInput
                initialValue={value === null ? '' : String(value)}
                onValueChange={setEditValue}
                onSave={(val) => handleSaveCell(rowIndex, colName, val)}
                onCancel={() => setEditingCell(null)}
                disabled={saving}
              />
            );
          }

          const { text, className } = formatCellValue(value);
          return (
            <div 
              className="px-2 py-1 cell-content truncate w-full h-full cursor-text group-hover:bg-accent/10 transition-colors select-none" 
              title={text}
              onDoubleClick={() => {
                if (newRowData) return;
                setEditValue(value === null ? '' : String(value));
                setEditingCell({ rowIndex, colName });
              }}
            >
              <span className={className}>{text}</span>
            </div>
          );
        },
        size: 150,
      });
    });

    return cols;
  }, [data, structure, sortCol, sortDir, page, pageSize, editingCell, saving, newRowData]);

  const tableData = useMemo(() => {
    if (!data) return [];
    return data.rows.map(row => {
      const obj: Record<string, any> = {};
      data.columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });
  }, [data]);

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
              <Button variant="outline" size="sm" onClick={() => fetchData()} className="h-8 bg-background/50 hover:bg-secondary border-border" title="Refresh">
                <RefreshCw size={14} className="mr-2 text-muted-foreground" />
                Refresh
              </Button>
              <Button size="sm" onClick={handleAddRow} className="h-8 shadow-glow" title="Add New Row">
                <Plus size={14} className="mr-2" />
                Add Record
              </Button>
            </>
          ) : (
            <>
              <Button 
                size="sm" 
                onClick={() => newRowData ? handleSaveNewRow() : handleSaveCell(editingCell!.rowIndex, editingCell!.colName, editValue)} 
                disabled={saving} 
                className="h-8 shadow-glow bg-primary hover:bg-primary/90 text-primary-foreground" 
                title="Save Changes (⌘+Enter)"
              >
                {saving ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Check size={14} className="mr-2" />}
                {saving ? 'Saving...' : (
                  <span className="flex items-center">
                    Save Changes
                    <span className="ml-2 flex items-center gap-1 px-1.5 py-0.5 rounded border border-primary-foreground/30 bg-primary-foreground/10 text-[9px] font-bold tracking-tighter">
                      <span className="text-[10px]">⌘</span>
                      <span className="opacity-50">+</span>
                      <span>ENTER</span>
                    </span>
                  </span>
                )}
              </Button>
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

      {error && (
        <div className="m-4 mb-0 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md shadow-sm font-medium animate-fade-in flex-shrink-0">
          {error}
        </div>
      )}

      {/* Grid wrapper */}
      <div className="flex-1 overflow-auto custom-scrollbar relative bg-background">
        {data && data.columns.length > 0 ? (
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
                <tr className="bg-primary/5 hover:bg-primary/10 transition-colors border-b border-border/50 shadow-[inset_0_2px_10px_rgba(0,229,153,0.05)]">
                  <td className="border-r border-border/50 p-2 text-center text-primary">
                    <Plus size={12} className="mx-auto" />
                  </td>
                  {data.columns.map((colName) => {
                    const columnInfo = structure.find(s => s.name === colName);
                    const col = table.getColumn(colName);
                    return (
                      <td 
                        key={colName}
                        style={{ width: col?.getSize() }}
                        className="border-r border-border/50 p-0 relative group"
                      >
                        <input
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
                          autoFocus={colName === data.columns[0]}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                        />
                      </td>
                    );
                  })}
                </tr>
              )}

              {table.getRowModel().rows.map((row, i) => (
                <tr key={row.id} className={cn(
                  "border-b border-border/20 transition-colors hover:bg-accent/40 group",
                  i % 2 === 0 ? "bg-transparent" : "bg-secondary/20"
                )}>
                  {row.getVisibleCells().map(cell => (
                    <td 
                      key={cell.id}
                      className={cn(
                        "border-r border-border/30 overflow-hidden text-ellipsis whitespace-nowrap",
                        cell.column.id === 'rowNum' && "bg-background/20 group-hover:bg-transparent transition-colors"
                      )}
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
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
