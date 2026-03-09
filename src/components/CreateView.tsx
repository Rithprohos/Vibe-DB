import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useAppStore, type QueryResult } from "../store/useAppStore";
import { buildCreateViewSQL, executeQuery, listTables } from "../lib/db";
import { validateViewName } from "../lib/tableName";
import { copyToClipboard } from "../lib/copy";
import { formatCellValue } from "../lib/formatters";
import { highlightSQL } from "../lib/highlightSQL";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertCircle,
  Copy,
  Eye,
  Loader2,
  PlusSquare,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  tabId: string;
}

const PREVIEW_LIMIT = 50;
const DEFAULT_CREATE_VIEW_DRAFT = {
  viewName: "new_view",
  sourceSql: "SELECT * FROM table_name",
  ifNotExists: true,
  temporary: false,
} as const;

function validateSelectSource(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Source query is required";
  }

  const withoutTrailingSemicolon = trimmed.replace(/;\s*$/, "").trim();
  if (!withoutTrailingSemicolon) {
    return "Source query is required";
  }
  if (withoutTrailingSemicolon.includes(";")) {
    return "Source query must contain a single SELECT statement";
  }

  const stripped = withoutTrailingSemicolon
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .trimStart()
    .toUpperCase();
  if (!stripped.startsWith("SELECT") && !stripped.startsWith("WITH")) {
    return "Source query must start with SELECT or WITH";
  }

  return null;
}

function normalizeSelectForPreview(value: string): string {
  return value.trim().replace(/;\s*$/, "").trim();
}

export default function CreateView({ tabId }: Props) {
  const tabs = useAppStore((s) => s.tabs);
  const connections = useAppStore((s) => s.connections);
  const setTables = useAppStore((s) => s.setTables);
  const updateTab = useAppStore((s) => s.updateTab);
  const openTableTab = useAppStore((s) => s.openTableTab);
  const closeTab = useAppStore((s) => s.closeTab);
  const showToast = useAppStore((s) => s.showToast);

  const tab = useMemo(() => tabs.find((t) => t.id === tabId), [tabs, tabId]);
  const activeConnection = useMemo(
    () => connections.find((c) => c.id === tab?.connectionId),
    [connections, tab?.connectionId],
  );
  const connId = activeConnection?.connId;
  const createViewDraft = tab?.createViewDraft ?? DEFAULT_CREATE_VIEW_DRAFT;
  const viewName = createViewDraft.viewName;
  const sourceSql = createViewDraft.sourceSql;
  const ifNotExists = createViewDraft.ifNotExists;
  const temporary = createViewDraft.temporary;

  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [previewResult, setPreviewResult] = useState<QueryResult | null>(null);
  const [generatedSql, setGeneratedSql] = useState("");
  const sqlPreviewRequestIdRef = useRef(0);

  const updateCreateViewDraft = useCallback(
    (
      updates: Partial<{
        viewName: string;
        sourceSql: string;
        ifNotExists: boolean;
        temporary: boolean;
      }>,
    ) => {
      updateTab(tabId, {
        createViewDraft: {
          ...createViewDraft,
          ...updates,
        },
      });
    },
    [createViewDraft, tabId, updateTab],
  );

  const liveViewNameError = useMemo(() => {
    if (!viewName.trim()) return null;
    return validateViewName(viewName);
  }, [viewName]);

  const liveSourceError = useMemo(() => {
    if (!sourceSql.trim()) return null;
    return validateSelectSource(sourceSql);
  }, [sourceSql]);

  const canCreate = useMemo(
    () =>
      !saving &&
      !previewing &&
      !liveViewNameError &&
      !liveSourceError &&
      viewName.trim().length > 0 &&
      sourceSql.trim().length > 0,
    [saving, previewing, liveViewNameError, liveSourceError, viewName, sourceSql],
  );

  useEffect(() => {
    setPreviewResult(null);
    setPreviewError("");
  }, [sourceSql, viewName, ifNotExists, temporary]);

  useEffect(() => {
    const hasViewName = viewName.trim().length > 0;
    const hasQuery = sourceSql.trim().length > 0;
    if (!hasViewName || !hasQuery) {
      setGeneratedSql("");
      return;
    }

    const requestId = ++sqlPreviewRequestIdRef.current;
    void (async () => {
      try {
        if (validateViewName(viewName) || validateSelectSource(sourceSql)) {
          if (requestId !== sqlPreviewRequestIdRef.current) return;
          setGeneratedSql("");
          return;
        }

        const nextSql = await buildCreateViewSQL(
          viewName,
          sourceSql,
          ifNotExists,
          temporary,
        );
        if (requestId !== sqlPreviewRequestIdRef.current) return;
        setGeneratedSql(nextSql);
      } catch {
        if (requestId !== sqlPreviewRequestIdRef.current) return;
        setGeneratedSql("");
      }
    })();
  }, [viewName, sourceSql, ifNotExists, temporary]);

  const handleCancel = useCallback(() => {
    closeTab(tabId);
  }, [closeTab, tabId]);

  const handleRunPreview = useCallback(async () => {
    if (!connId) {
      setPreviewError("No active database connection");
      return;
    }

    const viewNameError = validateViewName(viewName);
    if (viewNameError) {
      setPreviewError(viewNameError);
      return;
    }
    const sourceError = validateSelectSource(sourceSql);
    if (sourceError) {
      setPreviewError(sourceError);
      return;
    }

    setPreviewing(true);
    setPreviewError("");
    setError("");

    try {
      await buildCreateViewSQL(viewName, sourceSql, ifNotExists, temporary);
      const normalized = normalizeSelectForPreview(sourceSql);
      const previewSql = `SELECT * FROM (\n${normalized}\n) AS "__vibedb_preview" LIMIT ${PREVIEW_LIMIT};`;
      const result = await executeQuery(previewSql, connId);
      setPreviewResult(result);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setPreviewError(message);
      setPreviewResult(null);
    } finally {
      setPreviewing(false);
    }
  }, [connId, ifNotExists, sourceSql, temporary, viewName]);

  const handleCreateView = useCallback(async () => {
    if (!connId) {
      setError("No active database connection");
      return;
    }

    const viewNameError = validateViewName(viewName);
    if (viewNameError) {
      setError(viewNameError);
      return;
    }
    const sourceError = validateSelectSource(sourceSql);
    if (sourceError) {
      setError(sourceError);
      return;
    }

    setSaving(true);
    setError("");
    setPreviewError("");

    try {
      const sqlToRun = await buildCreateViewSQL(
        viewName,
        sourceSql,
        ifNotExists,
        temporary,
      );
      await executeQuery(sqlToRun, connId);

      const tables = await listTables(connId);
      if (activeConnection) {
        setTables(activeConnection.id, tables);
      }

      const trimmedViewName = viewName.trim();
      updateTab(tabId, { title: `✓ ${trimmedViewName}` });
      closeTab(tabId);
      if (activeConnection) {
        openTableTab(activeConnection.id, trimmedViewName, "data");
      }
      showToast({
        type: "success",
        message: `View "${trimmedViewName}" created`,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [
    activeConnection,
    closeTab,
    connId,
    ifNotExists,
    openTableTab,
    setTables,
    showToast,
    sourceSql,
    tabId,
    temporary,
    updateTab,
    viewName,
  ]);

  const handleCopySql = useCallback(async () => {
    if (!generatedSql) return;
    await copyToClipboard(generatedSql, {
      successMessage: "Create view SQL copied",
      errorMessage: "Failed to copy SQL",
    });
  }, [generatedSql]);

  const previewCount = previewResult?.rows.length ?? 0;

  return (
    <div className="flex-1 overflow-hidden bg-background relative w-full h-full flex flex-col">
      <div className="border-b border-border bg-background/80 backdrop-blur-sm px-6 py-4 flex-shrink-0">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-md bg-info/10 border border-info/30 flex items-center justify-center">
              <Eye size={20} className="text-info" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground tracking-tight">
                Create New View
              </h2>
              <p className="text-xs text-muted-foreground">
                Define view metadata and source query
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_auto] gap-4 items-start">
            <div className="min-w-0">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                View Name
              </label>
              <Input
                type="text"
                placeholder="e.g. active_users, recent_orders"
                value={viewName}
                onChange={(e) => {
                  updateCreateViewDraft({ viewName: e.target.value });
                  setError("");
                }}
                className={cn(
                  "bg-background border-border placeholder:text-muted-foreground/40 text-sm font-medium focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary h-9",
                  liveViewNameError &&
                    "border-destructive/70 focus-visible:ring-destructive focus-visible:border-destructive",
                )}
                autoFocus
              />
              {liveViewNameError && (
                <p className="mt-1 text-[11px] text-destructive">{liveViewNameError}</p>
              )}
            </div>
            <div className="flex items-center gap-2 pt-7">
              <Checkbox
                id="if-not-exists-view"
                checked={ifNotExists}
                onCheckedChange={(v) =>
                  updateCreateViewDraft({ ifNotExists: !!v })
                }
              />
              <label
                htmlFor="if-not-exists-view"
                className="text-xs text-muted-foreground cursor-pointer select-none"
              >
                IF NOT EXISTS
              </label>
            </div>
            <div className="flex items-center gap-2 pt-7">
              <Checkbox
                id="temporary-view"
                checked={temporary}
                onCheckedChange={(v) =>
                  updateCreateViewDraft({ temporary: !!v })
                }
              />
              <label
                htmlFor="temporary-view"
                className="text-xs text-muted-foreground cursor-pointer select-none"
              >
                TEMP
              </label>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 flex items-center gap-2 px-4 py-2.5 rounded-sm bg-destructive/10 border border-destructive/20 text-destructive text-sm font-mono max-w-6xl">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      <ScrollArea className="flex-1 px-6 py-4">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="rounded-md border border-border bg-surface/[0.3] overflow-hidden shadow-xl shadow-black/15">
            <div className="px-4 py-2 bg-secondary/40 border-b border-border/50 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Source Query (SELECT / WITH)
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunPreview}
                disabled={previewing || saving}
                className="h-7 px-2 text-[11px] border-border/50 bg-background/50 hover:bg-accent/50 gap-1.5"
              >
                {previewing ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Previewing
                  </>
                ) : (
                  <>
                    <PlusSquare size={12} />
                    Run Preview
                  </>
                )}
              </Button>
            </div>
            <div className="p-4">
              <textarea
                value={sourceSql}
                onChange={(e) => {
                  updateCreateViewDraft({ sourceSql: e.target.value });
                  setError("");
                }}
                className={cn(
                  "w-full min-h-[160px] resize-y border border-border bg-background px-3 py-2 text-[13px] font-mono text-foreground outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 rounded-sm",
                  liveSourceError &&
                    "border-destructive/70 focus:ring-destructive/50 focus:border-destructive/70",
                )}
                spellCheck={false}
                placeholder={"SELECT id, name\nFROM users\nWHERE is_active = 1"}
              />
              {liveSourceError && (
                <p className="mt-2 text-[11px] text-destructive">{liveSourceError}</p>
              )}
            </div>
          </div>

          <div className="rounded-md border border-border bg-surface/[0.3] overflow-hidden">
            <div className="px-4 py-2 bg-secondary/40 border-b border-border/50 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Generated SQL
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopySql}
                disabled={!generatedSql}
                className="h-7 px-2 text-[11px] border-border/50 bg-background/50 hover:bg-accent/50 gap-1.5"
              >
                <Copy size={12} />
                Copy SQL
              </Button>
            </div>
            {generatedSql ? (
              <pre className="p-4 text-[13px] font-mono leading-relaxed overflow-x-auto custom-scrollbar-hide whitespace-pre select-text">
                <code>{highlightSQL(generatedSql)}</code>
              </pre>
            ) : (
              <div className="p-4 text-xs text-muted-foreground/60 italic">
                Enter a valid view name and source query to see generated SQL.
              </div>
            )}
          </div>

          <div className="rounded-md border border-border bg-surface/[0.3] overflow-hidden">
            <div className="px-4 py-2 bg-secondary/40 border-b border-border/50 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Result Preview
              </span>
              <span className="text-[10px] text-muted-foreground">
                Limited to {PREVIEW_LIMIT} rows
              </span>
            </div>
            <div className="p-4">
              {previewError && (
                <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-sm bg-destructive/10 border border-destructive/20 text-destructive text-xs font-mono">
                  <AlertCircle size={14} className="flex-shrink-0" />
                  <span className="truncate">{previewError}</span>
                </div>
              )}
              {!previewResult ? (
                <div className="text-xs text-muted-foreground/70 italic">
                  Click "Run Preview" to inspect result columns and sample rows.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    {previewCount} row{previewCount !== 1 ? "s" : ""} previewed
                  </div>
                  <div className="overflow-auto border border-border/50 rounded-sm">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-secondary/35 border-b border-border/50">
                        <tr>
                          {previewResult.columns.map((column) => (
                            <th
                              key={column}
                              className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground whitespace-nowrap"
                            >
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewResult.rows.length === 0 ? (
                          <tr>
                            <td
                              className="px-3 py-3 text-xs text-muted-foreground italic"
                              colSpan={Math.max(previewResult.columns.length, 1)}
                            >
                              No rows returned by preview query.
                            </td>
                          </tr>
                        ) : (
                          previewResult.rows.map((row, rowIndex) => (
                            <tr
                              key={rowIndex}
                              className={cn(
                                "border-b border-border/30 last:border-b-0",
                                rowIndex % 2 === 0 ? "bg-transparent" : "bg-secondary/10",
                              )}
                            >
                              {row.map((value, colIndex) => {
                                const { text, className } = formatCellValue(value);
                                return (
                                  <td
                                    key={`${rowIndex}-${colIndex}`}
                                    className={cn(
                                      "px-3 py-2 text-[13px] max-w-[280px] truncate",
                                      className,
                                    )}
                                    title={text}
                                  >
                                    {text}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="border-t border-border bg-background/80 backdrop-blur-sm px-6 py-3 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            View:{" "}
            <span className="text-foreground font-medium">
              {viewName.trim() || "Unnamed"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="border-border/50 bg-background/50 hover:bg-accent/50 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateView}
              disabled={!canCreate}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 shadow-glow"
            >
              {saving ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save size={13} />
                  Create View
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
