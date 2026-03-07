import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { generateSql, getCustomAiApiKey, getDefaultAiProviderConfig, getTableStructure, type SchemaTable } from '../lib/db';
import { Sparkles, Loader2, ArrowUpCircle, AlertCircle, RotateCcw } from 'lucide-react';

const SUGGESTIONS = [
  "show all rows",
  "count total rows",
  "find 10 most recent records",
  "show column statistics",
];

interface GenerationState {
  type: 'idle' | 'loading' | 'success' | 'error';
  sql?: string;
  explanation?: string;
  error?: string;
}

export default function AiPanel() {
  // Store selectors - granular for performance
  const tabs = useAppStore(s => s.tabs);
  const activeSidebarConnectionId = useAppStore(s => s.activeSidebarConnectionId);
  const isAiPanelOpen = useAppStore(s => s.isAiPanelOpen);
  const activeTabId = useAppStore(s => s.activeTabId);
  const updateTab = useAppStore(s => s.updateTab);
  const addTab = useAppStore(s => s.addTab);
  const aiProviderMode = useAppStore(s => s.aiProviderMode);
  const aiCustomProfiles = useAppStore(s => s.aiCustomProfiles);
  const aiActiveCustomProfileId = useAppStore(s => s.aiActiveCustomProfileId);
  // const showAlert = useAppStore(s => s.showAlert); // Reserved for future error handling

  // Local state
  const [prompt, setPrompt] = useState("");
  const [generation, setGeneration] = useState<GenerationState>({ type: 'idle' });
  const [currentTableSchema, setCurrentTableSchema] = useState<SchemaTable | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Derived values - MUST be before effects that use them
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const isDataTabActive = activeTab?.type === 'data';
  const isVisible = isAiPanelOpen && isDataTabActive;
  const currentConnectionId = activeTab?.connectionId || activeSidebarConnectionId;
  const currentTableName = activeTab?.tableName || null;

  // Fetch schema for current table only
  useEffect(() => {
    let cancelled = false;

    async function fetchSchema() {
      if (!currentConnectionId || !currentTableName) {
        setCurrentTableSchema(null);
        return;
      }

      try {
        const columns = await getTableStructure(currentTableName, currentConnectionId);
        if (!cancelled) {
          setCurrentTableSchema({
            name: currentTableName,
            columns: columns.map(c => ({
              name: c.name,
              colType: c.col_type,
              isPk: c.pk === 1,
              isNullable: c.notnull === 0,
            })),
          });
        }
      } catch {
        if (!cancelled) {
          // Include table name even if structure fetch fails
          setCurrentTableSchema({ name: currentTableName, columns: [] });
        }
      }
    }

    fetchSchema();
    return () => { cancelled = true; };
  }, [currentConnectionId, currentTableName]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  // Reset generation when connection or table changes
  useEffect(() => {
    setGeneration({ type: 'idle' });
    setPrompt("");
  }, [currentConnectionId, currentTableName]);

  // Get AI provider configuration
  const getAiConfig = useCallback(async () => {
    if (aiProviderMode === 'default') {
      const defaultConfig = await getDefaultAiProviderConfig();
      // Map 'pollinations' to 'polli' for backend compatibility
      const providerKind = defaultConfig.provider === 'pollinations' ? 'polli' : defaultConfig.provider as 'polli' | 'openai';
      return {
        providerKind,
        baseUrl: defaultConfig.baseUrl,
        model: defaultConfig.model,
        apiKey: defaultConfig.hasEmbeddedApiKey ? undefined : null,
      };
    }

    const profile = aiCustomProfiles.find(p => p.id === aiActiveCustomProfileId);
    if (!profile) {
      throw new Error('No active AI profile selected');
    }

    const apiKey = profile.hasApiKey
      ? await getCustomAiApiKey(profile.id)
      : null;

    return {
      providerKind: profile.providerKind,
      baseUrl: profile.baseUrl,
      model: profile.model,
      apiKey,
    };
  }, [aiProviderMode, aiCustomProfiles, aiActiveCustomProfileId]);

  // Handle generation
  const handleGenerate = useCallback(async (text?: string) => {
    const q = text || prompt;
    if (!q.trim()) return;

    // Cancel any pending request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    setPrompt(q);
    setGeneration({ type: 'loading' });

    try {
      if (!currentTableSchema) {
        throw new Error('No table selected. Open a table to use AI assistance.');
      }

      const aiConfig = await getAiConfig();
      const response = await generateSql({
        prompt: q,
        schema: [currentTableSchema],
        providerKind: aiConfig.providerKind,
        baseUrl: aiConfig.baseUrl,
        model: aiConfig.model,
        apiKey: aiConfig.apiKey,
      });

      // Check if aborted
      if (abortRef.current?.signal.aborted) return;

      setGeneration({
        type: 'success',
        sql: response.sql,
        explanation: response.explanation,
      });
    } catch (error) {
      // Check if aborted
      if (abortRef.current?.signal.aborted) return;

      const errorMessage = error instanceof Error ? error.message : 'Failed to generate SQL';
      setGeneration({
        type: 'error',
        error: errorMessage,
      });
    }
  }, [prompt, currentTableSchema, getAiConfig]);

  // Handle insert into editor
  const handleInsert = useCallback(() => {
    if (!generation.sql) return;

    const fullSql = generation.explanation
      ? `-- ${generation.explanation}\n${generation.sql}`
      : generation.sql;

    if (activeTabId && activeTab?.type === 'query') {
      updateTab(activeTabId, { query: fullSql });
    } else {
      addTab({
        id: `query-ai-${Date.now()}`,
        connectionId: currentConnectionId || "",
        type: 'query',
        title: 'AI Query',
        query: fullSql,
      });
    }
  }, [generation.sql, generation.explanation, activeTabId, activeTab?.type, currentConnectionId, updateTab, addTab]);

  // Handle retry
  const handleRetry = useCallback(() => {
    handleGenerate();
  }, [handleGenerate]);

  // Don't render if not visible
  if (!isVisible) {
    return (
      <div
        className="bg-background border-l border-border flex flex-col shrink-0 h-full font-mono text-xs select-none overflow-hidden transition-[width,opacity] duration-250 ease-out"
        style={{ width: 0, opacity: 0 }}
      />
    );
  }

  return (
    <div
      className="bg-background border-l border-border flex flex-col shrink-0 h-full font-mono text-xs select-none overflow-hidden transition-[width,opacity] duration-250 ease-out"
      style={{ width: 280, opacity: 1 }}
    >
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-accent-secondary to-purple-500 flex items-center justify-center text-[10px] text-white">
          <Sparkles size={10} />
        </div>
        <div>
          <div className="font-semibold text-foreground text-xs font-sans">AI Assistant</div>
          <div className="text-[10px] text-muted-foreground font-sans">natural language → SQL</div>
        </div>
      </div>

      {/* Schema Context */}
      <div className="p-3 border-b border-border/50">
        <div className="text-[10px] text-muted-foreground mb-1.5 tracking-wider font-sans">CURRENT TABLE</div>
        <div className="bg-secondary rounded-md p-2 text-muted-foreground leading-relaxed max-h-[120px] overflow-auto border border-border">
          {currentTableSchema ? (
            <div>
              <div className="text-accent-secondary font-medium">{currentTableSchema.name}</div>
              {currentTableSchema.columns.length > 0 && (
                <div className="mt-1 text-[10px] text-muted-foreground/70">
                  {currentTableSchema.columns.length} columns
                  {currentTableSchema.columns.some(c => c.isPk) && (
                    <span className="ml-2 text-accent-secondary">({currentTableSchema.columns.filter(c => c.isPk).length} PK)</span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-[10px] italic">No table selected</div>
          )}
        </div>
      </div>

      {/* Suggestions */}
      <div className="p-3 border-b border-border/50">
        <div className="text-[10px] text-muted-foreground mb-2 tracking-wider font-sans">SUGGESTIONS</div>
        <div className="flex flex-col gap-1.5">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => handleGenerate(s)}
              disabled={generation.type === 'loading'}
              className="bg-secondary border border-border text-muted-foreground p-1.5 rounded-md text-left text-[11px] hover:bg-accent hover:text-foreground transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              &ldquo;{s}&rdquo;
            </button>
          ))}
        </div>
      </div>

      {/* Prompt Input */}
      <div className="p-3 flex-1 flex flex-col gap-2 relative overflow-auto">
        <div className="text-[10px] text-muted-foreground tracking-wider font-sans">ASK IN PLAIN ENGLISH</div>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleGenerate();
            }
          }}
          placeholder="e.g. show me the largest tables..."
          disabled={generation.type === 'loading'}
          className="bg-secondary border border-border text-foreground p-2 rounded-md text-[11px] resize-none h-[80px] outline-none focus:border-accent-secondary/50 focus:ring-1 focus:ring-accent-secondary/30 transition-all font-sans leading-relaxed placeholder:text-muted-foreground/50 disabled:opacity-50"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />

        <button
          onClick={() => handleGenerate()}
          disabled={generation.type === 'loading' || !prompt.trim()}
          className={`
            border-none p-2 rounded-md text-[11px] flex items-center justify-center gap-1.5 font-semibold tracking-wide transition-all
            ${generation.type === 'loading' || !prompt.trim()
              ? 'bg-border/30 text-muted-foreground/50 cursor-not-allowed'
              : 'bg-gradient-to-br from-accent-secondary to-purple-500 text-white cursor-pointer hover:opacity-90'}
          `}
        >
          {generation.type === 'loading' ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              generating...
            </>
          ) : (
            <>
              <Sparkles size={12} />
              Generate SQL
            </>
          )}
        </button>

        {/* Error State */}
        {generation.type === 'error' && (
          <div className="mt-2 bg-destructive/10 border border-destructive/30 rounded p-2 flex flex-col gap-2">
            <div className="text-[10px] text-destructive font-sans flex items-center gap-1">
              <AlertCircle size={10} />
              <span>Generation failed</span>
            </div>
            <p className="text-[10px] text-destructive/80 font-sans leading-relaxed">
              {generation.error}
            </p>
            <button
              onClick={handleRetry}
              className="w-full bg-destructive/20 border border-destructive/30 text-destructive py-1.5 rounded-md cursor-pointer hover:bg-destructive/30 transition-colors flex items-center justify-center gap-1.5 text-[11px]"
            >
              <RotateCcw size={12} />
              Retry
            </button>
          </div>
        )}

        {/* Success State */}
        {generation.type === 'success' && generation.sql && (
          <div className="mt-2 bg-secondary border border-accent-secondary/30 rounded p-2 text-accent-secondary flex flex-col gap-2">
            <div className="text-[10px] text-muted-foreground/50 font-sans flex justify-between items-center">
              <span>✦ generated</span>
            </div>
            <pre className="m-0 whitespace-pre-wrap text-accent-secondary text-[11px]">
              {generation.sql}
            </pre>
            <button
              onClick={handleInsert}
              className="mt-1 w-full bg-accent/50 border border-accent-secondary/30 text-accent-secondary py-1.5 rounded-md cursor-pointer hover:bg-accent-secondary/20 transition-colors flex items-center justify-center gap-1.5"
            >
               insert into editor
               <ArrowUpCircle size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
