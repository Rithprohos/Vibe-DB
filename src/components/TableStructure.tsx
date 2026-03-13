import { useState, useEffect, useMemo } from 'react';
import { useAppStore, type TableStructureData } from '../store/useAppStore';
import { getTableStructure } from '../lib/db';
import { isSchemaFlagEnabled } from '../lib/schemaFlags';
import { formatColumnTypeDisplay } from '../lib/typeDisplay';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Key, Link2, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  tableName: string;
  tabId: string;
}

export default function TableStructure({ tableName, tabId }: Props) {
  const tabs = useAppStore(s => s.tabs);
  const connections = useAppStore(s => s.connections);
  const tab = useMemo(() => tabs.find(t => t.id === tabId), [tabs, tabId]);
  const activeConnection = useMemo(
    () => connections.find(c => c.id === tab?.connectionId),
    [connections, tab?.connectionId]
  );
  const connId = activeConnection?.connId;
  const [structure, setStructure] = useState<TableStructureData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!connId) return;
    let cancelled = false;
    setLoading(true);
    getTableStructure(tableName, connId)
      .then((data) => { if (!cancelled) setStructure(data); })
      .catch((e: any) => { if (!cancelled) setError(e.toString()); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [connId, tableName]);

  const columns = structure?.columns ?? [];
  const indexes = structure?.indexes ?? [];
  const foreignKeys = structure?.foreign_keys ?? [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground w-full">
        <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary opacity-80" />
        <span className="text-sm font-medium tracking-wide">Loading structure...</span>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-destructive bg-destructive/10 border border-destructive/20 rounded-sm m-4 text-sm font-mono shadow-sm">{error}</div>;
  }

  return (
    <div className="flex-1 overflow-auto bg-background p-6 relative w-full h-full custom-scrollbar-hide space-y-6">
      {/* Columns Section */}
      <div className="rounded-md border border-border bg-surface/[0.3] overflow-hidden shadow-xl shadow-black/15 glass-panel relative z-10 w-full max-w-6xl mx-auto">
        <div className="px-4 py-3 border-b border-border/50 bg-secondary/20">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Columns</h3>
        </div>
        <Table className="w-full text-left">
          <TableHeader className="bg-secondary/40 sticky top-0 backdrop-blur-md border-b border-border/50">
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="w-[60px] text-muted-foreground font-semibold uppercase tracking-wider text-[10px] py-4 pl-4">#</TableHead>
              <TableHead className="font-semibold uppercase tracking-wider text-[10px] text-foreground">Column Name</TableHead>
              <TableHead className="font-semibold uppercase tracking-wider text-[10px] text-foreground">Type</TableHead>
              <TableHead className="w-[100px] font-semibold uppercase tracking-wider text-[10px] text-foreground">Not Null</TableHead>
              <TableHead className="font-semibold uppercase tracking-wider text-[10px] text-foreground">Default</TableHead>
              <TableHead className="w-[120px] font-semibold uppercase tracking-wider text-[10px] text-foreground text-center pr-4">Key</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {columns.map((col, idx) => {
              const typeLower = col.col_type.toLowerCase();
              return (
                <TableRow key={col.cid} className={cn(
                  "border-border/20 transition-colors cursor-default hover:bg-secondary/40",
                  idx % 2 === 0 ? "bg-transparent" : "bg-secondary/10"
                )}>
                  <TableCell className="font-mono text-muted-foreground/70 text-xs pl-4">{col.cid}</TableCell>
                  <TableCell className="font-medium text-sm text-foreground tracking-wide">{col.name}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2 py-1 rounded-sm text-[10px] font-mono font-bold tracking-widest border",
                      typeLower.includes('int') ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                      typeLower.includes('text') || typeLower.includes('char') ? "bg-accent-secondary/10 text-accent-secondary border-accent-secondary/20" :
                      typeLower.includes('real') || typeLower.includes('float') || typeLower.includes('double') ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                      typeLower.includes('blob') ? "bg-purple-500/10 text-purple-500 border-purple-500/20" :
                      "bg-muted text-muted-foreground border-border"
                    )}>
                      {formatColumnTypeDisplay(col.col_type)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {isSchemaFlagEnabled(col.notnull) && (
                      <span className="px-2 py-0.5 rounded-sm bg-muted/30 text-[9px] font-bold text-muted-foreground border border-border tracking-wider uppercase">
                        Required
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground bg-transparent">
                    {col.dflt_value ?? <span className="text-muted-foreground/30 italic">NULL</span>}
                  </TableCell>
                  <TableCell className="text-center pr-4">
                    {isSchemaFlagEnabled(col.pk) && (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm bg-primary/10 text-primary border border-primary/20 mx-auto" title="Primary Key">
                        <Key size={12} />
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Indexes Section */}
      {indexes.length > 0 && (
        <div className="rounded-md border border-border bg-surface/[0.3] overflow-hidden shadow-xl shadow-black/15 glass-panel relative z-10 w-full max-w-6xl mx-auto">
          <div className="px-4 py-3 border-b border-border/50 bg-secondary/20">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Hash size={12} className="text-primary" />
              Indexes ({indexes.length})
            </h3>
          </div>
          <Table className="w-full text-left">
            <TableHeader className="bg-secondary/40 sticky top-0 backdrop-blur-md border-b border-border/50">
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="font-semibold uppercase tracking-wider text-[10px] text-foreground pl-4">Name</TableHead>
                <TableHead className="w-[100px] font-semibold uppercase tracking-wider text-[10px] text-foreground">Unique</TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-[10px] text-foreground">Columns</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {indexes.map((idx, i) => (
                <TableRow key={idx.name} className={cn(
                  "border-border/20 transition-colors cursor-default hover:bg-secondary/40",
                  i % 2 === 0 ? "bg-transparent" : "bg-secondary/10"
                )}>
                  <TableCell className="font-medium text-sm text-foreground pl-4">{idx.name}</TableCell>
                  <TableCell>
                    {idx.unique && (
                      <span className="px-2 py-0.5 rounded-sm bg-amber-500/10 text-amber-500 text-[9px] font-bold border border-amber-500/20 tracking-wider uppercase">
                        Unique
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {idx.columns.join(', ')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Foreign Keys Section */}
      {foreignKeys.length > 0 && (
        <div className="rounded-md border border-border bg-surface/[0.3] overflow-hidden shadow-xl shadow-black/15 glass-panel relative z-10 w-full max-w-6xl mx-auto">
          <div className="px-4 py-3 border-b border-border/50 bg-secondary/20">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Link2 size={12} className="text-primary" />
              Foreign Keys ({foreignKeys.length})
            </h3>
          </div>
          <Table className="w-full text-left">
            <TableHeader className="bg-secondary/40 sticky top-0 backdrop-blur-md border-b border-border/50">
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="font-semibold uppercase tracking-wider text-[10px] text-foreground pl-4">Column</TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-[10px] text-foreground">References</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {foreignKeys.map((fk, i) => (
                <TableRow key={`${fk.from_col}-${i}`} className={cn(
                  "border-border/20 transition-colors cursor-default hover:bg-secondary/40",
                  i % 2 === 0 ? "bg-transparent" : "bg-secondary/10"
                )}>
                  <TableCell className="font-medium text-sm text-foreground pl-4">{fk.from_col}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    <span className="text-accent-secondary">{fk.to_table}</span>
                    <span className="text-muted-foreground/50">.</span>
                    <span className="text-foreground">{fk.to_col}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
