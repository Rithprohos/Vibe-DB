import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, List, Loader2, Plus, Trash2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { buildCreateEnumSQL, executeQuery, listEnums } from '../lib/db';
import { validateEnumName } from '../lib/tableName';
import { highlightSQL } from '../lib/highlightSQL';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Props {
  tabId: string;
}

interface CreateEnumDraft {
  enumName: string;
  values: string[];
}

const DEFAULT_ENUM_DRAFT: CreateEnumDraft = {
  enumName: 'new_enum',
  values: [''],
};

const createEnumDraftCache = new Map<string, CreateEnumDraft>();

export default function CreateEnum({ tabId }: Props) {
  const tabs = useAppStore((state) => state.tabs);
  const connections = useAppStore((state) => state.connections);
  const closeTab = useAppStore((state) => state.closeTab);
  const setEnums = useAppStore((state) => state.setEnums);
  const showToast = useAppStore((state) => state.showToast);
  const tab = useMemo(() => tabs.find((item) => item.id === tabId), [tabs, tabId]);
  const activeConnection = useMemo(
    () => connections.find((connection) => connection.id === tab?.connectionId),
    [connections, tab?.connectionId],
  );

  const [draft, setDraft] = useState<CreateEnumDraft>(() => {
    return createEnumDraftCache.get(tabId) ?? DEFAULT_ENUM_DRAFT;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [generatedSql, setGeneratedSql] = useState('');
  const sqlPreviewRequestIdRef = useRef(0);
  const enumName = draft.enumName;
  const values = draft.values;
  const isPostgresConnection = activeConnection?.type === 'postgres';

  useEffect(() => {
    createEnumDraftCache.set(tabId, draft);
  }, [draft, tabId]);

  const normalizedValues = useMemo(
    () => values.map((value) => value.trim()),
    [values],
  );

  const duplicateValueSet = useMemo(() => {
    const counts = new Map<string, number>();
    normalizedValues.forEach((value) => {
      if (!value) return;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([value]) => value),
    );
  }, [normalizedValues]);

  const liveEnumNameError = useMemo(() => {
    if (!enumName.trim()) return null;
    return validateEnumName(enumName);
  }, [enumName]);

  const rowErrors = useMemo(
    () =>
      normalizedValues.map((value) => {
        if (!value) return 'Value is required';
        if (duplicateValueSet.has(value)) return 'Duplicate enum value';
        return null;
      }),
    [duplicateValueSet, normalizedValues],
  );

  const canCreate = useMemo(
    () =>
      !!activeConnection?.connId &&
      isPostgresConnection &&
      !saving &&
      !liveEnumNameError &&
      values.length > 0 &&
      rowErrors.every((rowError) => rowError === null),
    [
      activeConnection?.connId,
      isPostgresConnection,
      liveEnumNameError,
      rowErrors,
      saving,
      values.length,
    ],
  );

  useEffect(() => {
    const hasEnumName = enumName.trim().length > 0;
    const hasValues = normalizedValues.length > 0;
    const hasValueErrors = rowErrors.some((rowError) => rowError !== null);

    if (!hasEnumName || !hasValues || !!liveEnumNameError || hasValueErrors) {
      setGeneratedSql('');
      return;
    }

    if (!isPostgresConnection) {
      setGeneratedSql('');
      return;
    }

    const requestId = ++sqlPreviewRequestIdRef.current;
    void (async () => {
      try {
        const sql = await buildCreateEnumSQL(enumName, normalizedValues, 'postgres');
        if (requestId !== sqlPreviewRequestIdRef.current) return;
        setGeneratedSql(sql);
      } catch {
        if (requestId !== sqlPreviewRequestIdRef.current) return;
        setGeneratedSql('');
      }
    })();
  }, [enumName, isPostgresConnection, liveEnumNameError, normalizedValues, rowErrors]);

  const updateDraft = useCallback((updates: Partial<CreateEnumDraft>) => {
    setDraft((currentDraft) => ({ ...currentDraft, ...updates }));
    setError('');
  }, []);

  const updateValue = useCallback((index: number, nextValue: string) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      values: currentDraft.values.map((value, valueIndex) =>
        valueIndex === index ? nextValue : value,
      ),
    }));
    setError('');
  }, []);

  const addValue = useCallback(() => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      values: [...currentDraft.values, ''],
    }));
    setError('');
  }, []);

  const removeValue = useCallback((index: number) => {
    setDraft((currentDraft) => {
      if (currentDraft.values.length <= 1) {
        return {
          ...currentDraft,
          values: [''],
        };
      }

      return {
        ...currentDraft,
        values: currentDraft.values.filter((_, valueIndex) => valueIndex !== index),
      };
    });
    setError('');
  }, []);

  const handleCancel = useCallback(() => {
    createEnumDraftCache.delete(tabId);
    closeTab(tabId);
  }, [closeTab, tabId]);

  const handleCreate = useCallback(async () => {
    if (!activeConnection?.connId) {
      setError('No active database connection');
      return;
    }
    if (!isPostgresConnection) {
      setError('Create Enum is only available for PostgreSQL connections');
      return;
    }

    const enumNameError = validateEnumName(enumName);
    if (enumNameError) {
      setError(enumNameError);
      return;
    }

    if (normalizedValues.length === 0) {
      setError('At least one enum value is required');
      return;
    }

    const firstRowError = rowErrors.find((rowError) => rowError !== null);
    if (firstRowError) {
      setError(firstRowError);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const sqlToRun = await buildCreateEnumSQL(enumName, normalizedValues, 'postgres');
      await executeQuery(sqlToRun, activeConnection.connId, 'guided');
      try {
        const enums = await listEnums(activeConnection.connId);
        setEnums(activeConnection.id, enums);
      } catch (refreshError) {
        console.error('Failed to refresh enums after create:', refreshError);
      }
      createEnumDraftCache.delete(tabId);
      closeTab(tabId);
      showToast({ type: 'success', message: `Enum "${enumName.trim()}" created` });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [
    activeConnection?.connId,
    closeTab,
    enumName,
    isPostgresConnection,
    normalizedValues,
    rowErrors,
    setEnums,
    showToast,
    tabId,
  ]);

  if (!activeConnection) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-md border border-border bg-card p-5 space-y-4">
          <div className="flex items-start gap-3 text-muted-foreground">
            <AlertCircle size={18} className="mt-0.5 text-warning" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">No Connection</h2>
              <p className="mt-1 text-xs leading-relaxed">
                Open this tab from an active PostgreSQL connection to create enums.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Close Tab
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="h-full min-h-0">
        <ScrollArea className="h-full">
          <div className="max-w-3xl mx-auto p-6 space-y-5">
            <div className="rounded-md border border-border bg-card p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-sm border border-border bg-background flex items-center justify-center text-primary">
                  <List size={16} />
                </div>
                <div>
                  <h1 className="text-sm font-semibold tracking-wide uppercase text-foreground">
                    Create Enum
                  </h1>
                  <p className="text-xs text-muted-foreground mt-1">
                    Define a PostgreSQL enum type with ordered values.
                  </p>
                </div>
              </div>

              {!isPostgresConnection && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                  Create Enum is only supported for PostgreSQL connections.
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Enum Name
                </label>
                <Input
                  value={enumName}
                  onChange={(event) => updateDraft({ enumName: event.target.value })}
                  placeholder="order_status"
                  className={cn(
                    'h-9 bg-background border-border text-sm',
                    liveEnumNameError &&
                      'border-destructive/70 focus-visible:ring-destructive focus-visible:border-destructive',
                  )}
                />
                {liveEnumNameError && (
                  <p className="text-[11px] text-destructive">{liveEnumNameError}</p>
                )}
              </div>
            </div>

            <div className="rounded-md border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Enum Values
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Values are saved in this order.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addValue}
                  className="h-8 text-xs gap-1.5"
                >
                  <Plus size={13} />
                  Add Value
                </Button>
              </div>

              <div className="space-y-2">
                {values.map((value, index) => (
                  <div key={`${index}-${values.length}`} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-9 text-[10px] font-mono text-muted-foreground/80">
                        {index + 1}
                      </div>
                      <Input
                        value={value}
                        onChange={(event) => updateValue(index, event.target.value)}
                        placeholder={`value_${index + 1}`}
                        className={cn(
                          'h-9 bg-background border-border text-sm',
                          rowErrors[index] &&
                            'border-destructive/70 focus-visible:ring-destructive focus-visible:border-destructive',
                        )}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeValue(index)}
                        className="h-9 w-9 p-0 hover:bg-destructive/10 hover:text-destructive"
                        title="Remove value"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                    {rowErrors[index] && (
                      <p className="pl-11 text-[11px] text-destructive">{rowErrors[index]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-border bg-card overflow-hidden">
              <div className="px-4 py-2 bg-secondary/40 border-b border-border/50">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Generated SQL
                </span>
              </div>
              {generatedSql ? (
                <pre className="p-4 text-[13px] font-mono leading-relaxed overflow-x-auto whitespace-pre select-text">
                  <code>{highlightSQL(generatedSql)}</code>
                </pre>
              ) : (
                <div className="p-4 text-xs text-muted-foreground/70 italic">
                  Enter a valid enum name and values to preview SQL.
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-md border border-destructive/60 bg-destructive/10 p-3 flex items-start gap-2">
                <AlertCircle size={14} className="text-destructive mt-0.5 shrink-0" />
                <p className="text-xs text-destructive leading-relaxed">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pb-3">
              <Button variant="outline" onClick={handleCancel} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => void handleCreate()} disabled={!canCreate}>
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-1.5" />
                    Creating...
                  </>
                ) : (
                  'Create Enum'
                )}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
