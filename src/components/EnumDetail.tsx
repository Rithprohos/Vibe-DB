import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Copy, List, Loader2, RefreshCw } from 'lucide-react';
import { getEnumDetail } from '../lib/db';
import { copyToClipboard } from '../lib/copy';
import { useAppStore } from '../store/useAppStore';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  tabId: string;
}

interface EnumDetailState {
  name: string;
  schema?: string | null;
  values: string[];
}

function quoteIdentifier(name: string): string {
  return `"${name.split('"').join('""')}"`;
}

function quoteQualifiedName(schema: string | null, name: string): string {
  if (!schema) {
    return quoteIdentifier(name);
  }

  return `${quoteIdentifier(schema)}.${quoteIdentifier(name)}`;
}

function quoteSqlLiteral(value: string): string {
  return `'${value.split("'").join("''")}'`;
}

export default function EnumDetail({ tabId }: Props) {
  const tabs = useAppStore((state) => state.tabs);
  const connections = useAppStore((state) => state.connections);

  const tab = useMemo(() => tabs.find((item) => item.id === tabId), [tabs, tabId]);
  const activeConnection = useMemo(
    () => connections.find((connection) => connection.id === tab?.connectionId),
    [connections, tab?.connectionId],
  );
  const connId = activeConnection?.connId;

  const [detail, setDetail] = useState<EnumDetailState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const enumName = tab?.enumName?.trim() ?? '';
  const enumSchema = tab?.enumSchema?.trim() || null;
  const qualifiedName = enumSchema ? `${enumSchema}.${enumName}` : enumName;

  const createTypeSql = useMemo(() => {
    if (!detail || detail.values.length === 0) {
      return '';
    }

    const qualifiedTypeName = quoteQualifiedName(detail.schema?.trim() || null, detail.name);
    const valuesSql = detail.values.map(quoteSqlLiteral).join(', ');
    return `CREATE TYPE ${qualifiedTypeName} AS ENUM (${valuesSql});`;
  }, [detail]);

  const loadDetail = useCallback(async () => {
    if (!connId || !enumName) {
      return;
    }
    if (activeConnection?.type !== 'postgres') {
      setDetail(null);
      setError('Enum detail is only available for PostgreSQL connections');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await getEnumDetail(enumName, enumSchema, connId);
      setDetail(result);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setDetail(null);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [activeConnection?.type, connId, enumName, enumSchema]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const copyName = useCallback(async () => {
    if (!qualifiedName) return;
    await copyToClipboard(qualifiedName, { successMessage: 'Enum name copied' });
  }, [qualifiedName]);

  const copyCreateSql = useCallback(async () => {
    if (!createTypeSql) return;
    await copyToClipboard(createTypeSql, { successMessage: 'CREATE TYPE SQL copied' });
  }, [createTypeSql]);

  if (!activeConnection) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-md border border-border bg-card p-5 space-y-3">
          <div className="flex items-start gap-2 text-muted-foreground">
            <AlertCircle size={16} className="mt-0.5 text-warning shrink-0" />
            <p className="text-xs">Connection not found for this enum tab.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0">
      <ScrollArea className="h-full">
        <div className="max-w-3xl mx-auto p-6 space-y-4">
          <div className="rounded-md border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-sm border border-border bg-background flex items-center justify-center text-primary shrink-0">
                  <List size={16} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-sm font-semibold tracking-wide uppercase text-foreground">
                    Enum Detail
                  </h1>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{qualifiedName}</p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadDetail()}
                className="h-8 gap-1.5"
                disabled={loading}
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                Refresh
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void copyName()}
                className="h-8 gap-1.5"
                disabled={!qualifiedName}
              >
                <Copy size={13} />
                Copy Name
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void copyCreateSql()}
                className="h-8 gap-1.5"
                disabled={!createTypeSql}
              >
                <Copy size={13} />
                Copy CREATE SQL
              </Button>
            </div>
          </div>

          {loading && (
            <div className="rounded-md border border-border bg-card p-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
              Loading enum values...
            </div>
          )}

          {!loading && error && (
            <div className="rounded-md border border-destructive/60 bg-destructive/10 p-3 flex items-start gap-2">
              <AlertCircle size={14} className="text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive leading-relaxed">{error}</p>
            </div>
          )}

          {!loading && !error && detail && (
            <div className="rounded-md border border-border bg-card overflow-hidden">
              <div className="px-4 py-2 bg-secondary/40 border-b border-border/50 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Values
                </span>
                <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground/70">
                  {detail.values.length}
                </span>
              </div>

              {detail.values.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground/70 italic">No enum values found.</div>
              ) : (
                <div className="p-2">
                  {detail.values.map((value, index) => (
                    <div
                      key={`${value}-${index}`}
                      className="flex items-center gap-3 rounded-sm px-2 py-1.5 text-sm hover:bg-accent/40 transition-colors"
                    >
                      <span className="w-6 text-[10px] font-mono text-muted-foreground/70">
                        {index + 1}
                      </span>
                      <span className="font-mono text-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
