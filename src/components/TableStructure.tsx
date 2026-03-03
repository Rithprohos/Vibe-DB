import { useState, useEffect } from 'react';
import { useAppStore, type ColumnInfo } from '../store/useAppStore';
import { getTableStructure } from '../lib/db';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  tableName: string;
}

export default function TableStructure({ tableName }: Props) {
  const { activeConnection } = useAppStore();
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activeConnection?.connId) return;
    setLoading(true);
    getTableStructure(tableName, activeConnection.connId)
      .then(setColumns)
      .catch((e: any) => setError(e.toString()))
      .finally(() => setLoading(false));
  }, [activeConnection, tableName]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground w-full">
        <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary opacity-80" />
        <span className="text-sm font-medium tracking-wide">Loading structure...</span>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-destructive bg-destructive/10 border border-destructive/20 rounded-md m-4 text-sm font-mono shadow-sm">{error}</div>;
  }

  return (
    <div className="flex-1 overflow-auto bg-background p-6 relative w-full h-full custom-scrollbar-hide">
      <div className="rounded-xl border border-border bg-surface/[0.3] overflow-hidden shadow-2xl glass-panel relative z-10 w-full mb-8 max-w-6xl mx-auto">
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
                      "px-2 py-1 rounded text-[10px] font-mono font-bold tracking-widest border",
                      typeLower.includes('int') ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                      typeLower.includes('text') || typeLower.includes('char') ? "bg-accent-secondary/10 text-accent-secondary border-accent-secondary/20" :
                      typeLower.includes('real') || typeLower.includes('float') || typeLower.includes('double') ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                      typeLower.includes('blob') ? "bg-purple-500/10 text-purple-500 border-purple-500/20" :
                      "bg-muted text-muted-foreground border-border"
                    )}>
                      {col.col_type || '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {col.notnull === 1 && (
                      <span className="px-2 py-0.5 rounded bg-muted/30 text-[9px] font-bold text-muted-foreground border border-border tracking-wider uppercase">
                        Required
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground bg-transparent">
                    {col.dflt_value ?? <span className="text-muted-foreground/30 italic">NULL</span>}
                  </TableCell>
                  <TableCell className="text-center pr-4">
                    {col.pk === 1 && (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-glow mx-auto">
                        <span className="text-[10px] font-bold">PK</span>
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
