import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Sparkles } from 'lucide-react';

import { PromptComposer } from './ai-panel/PromptComposer';
import { GenerationResult } from './ai-panel/GenerationResult';
import { SchemaContextCard } from './ai-panel/SchemaContextCard';
import { SuggestionList } from './ai-panel/SuggestionList';
import type { GenerationState } from './ai-panel/types';
import { copyToClipboard } from '../lib/copy';
import {
  generateSql,
  getCustomAiApiKey,
  getDefaultAiProviderConfig,
  getTableStructure,
  pingAiProvider,
  type SchemaTable,
} from '../lib/db';
import { useAppStore } from '../store/useAppStore';

const SUGGESTIONS = [
  "show all rows",
  "count total rows",
  "find 10 most recent records",
  "show column statistics",
];

function shouldWarmUpProvider(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('not ready') ||
    message.includes('warming') ||
    message.includes('cold start') ||
    message.includes('temporarily unavailable') ||
    message.includes('503')
  );
}

async function warmUpAndGenerate(params: {
  prompt: string;
  schema: SchemaTable;
  providerKind: 'polli' | 'openai';
  baseUrl: string;
  model: string;
  apiKey?: string | null;
  useDefaultConfig: boolean;
}): Promise<Awaited<ReturnType<typeof generateSql>>> {
  try {
    return await generateSql({
      prompt: params.prompt,
      schema: [params.schema],
      providerKind: params.providerKind,
      baseUrl: params.baseUrl,
      model: params.model,
      apiKey: params.apiKey,
    });
  } catch (error) {
    if (!shouldWarmUpProvider(error)) {
      throw error;
    }

    await pingAiProvider({
      providerKind: params.providerKind,
      baseUrl: params.baseUrl,
      model: params.model,
      apiKey: params.apiKey,
      useDefaultConfig: params.useDefaultConfig,
    });

    return await generateSql({
      prompt: params.prompt,
      schema: [params.schema],
      providerKind: params.providerKind,
      baseUrl: params.baseUrl,
      model: params.model,
      apiKey: params.apiKey,
    });
  }
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
  const generatedSql = useMemo(() => {
    if (!generation.sql) {
      return "";
    }

    return generation.explanation
      ? `-- ${generation.explanation}\n${generation.sql}`
      : generation.sql;
  }, [generation.explanation, generation.sql]);

  // Fetch schema for current table only
  useEffect(() => {
    let cancelled = false;

    async function fetchSchema() {
      if (!currentConnectionId || !currentTableName) {
        setCurrentTableSchema(null);
        return;
      }

      try {
        const structure = await getTableStructure(currentTableName, currentConnectionId);
        if (!cancelled) {
          setCurrentTableSchema({
            name: currentTableName,
            columns: structure.columns.map(c => ({
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
      const response = await warmUpAndGenerate({
        prompt: q,
        schema: currentTableSchema,
        providerKind: aiConfig.providerKind,
        baseUrl: aiConfig.baseUrl,
        model: aiConfig.model,
        apiKey: aiConfig.apiKey,
        useDefaultConfig: aiProviderMode === 'default',
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
  }, [prompt, currentTableSchema, getAiConfig, aiProviderMode]);

  // Handle insert into editor
  const handleInsert = useCallback(() => {
    if (!generatedSql) return;

    if (activeTabId && activeTab?.type === 'query') {
      updateTab(activeTabId, { query: generatedSql });
    } else {
      addTab({
        id: `query-ai-${Date.now()}`,
        connectionId: currentConnectionId || "",
        type: 'query',
        title: 'AI Query',
        query: generatedSql,
      });
    }
  }, [generatedSql, activeTabId, activeTab?.type, currentConnectionId, updateTab, addTab]);

  const handleCopy = useCallback(() => {
    if (!generatedSql) return;

    void copyToClipboard(generatedSql, {
      successMessage: 'AI SQL copied',
      errorMessage: 'Failed to copy AI SQL',
    });
  }, [generatedSql]);

  // Handle retry
  const handleRetry = useCallback(() => {
    handleGenerate();
  }, [handleGenerate]);

  // Don't render if not visible
  if (!isVisible) {
    return (
      <div
        className="bg-background border-l border-border flex flex-col shrink-0 h-full font-mono text-sm select-none overflow-hidden transition-[width,opacity] duration-250 ease-out"
        style={{ width: 0, opacity: 0 }}
      />
    );
  }

  return (
    <div
      className="bg-background border-l border-border flex flex-col shrink-0 h-full font-mono text-sm select-none overflow-hidden transition-[width,opacity] duration-250 ease-out"
      style={{ width: 320, opacity: 1 }}
    >
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-accent-secondary to-purple-500 flex items-center justify-center text-[10px] text-white">
          <Sparkles size={10} />
        </div>
        <div>
          <div className="font-semibold text-foreground text-sm font-sans">AI Assistant</div>
          <div className="text-xs text-muted-foreground font-sans">natural language → SQL</div>
        </div>
      </div>

      {/* Schema Context */}
      <SchemaContextCard schema={currentTableSchema} />

      {/* Suggestions */}
      <SuggestionList
        suggestions={SUGGESTIONS}
        disabled={generation.type === 'loading'}
        onSelect={(value) => void handleGenerate(value)}
      />

      {/* Prompt Input */}
      <div className="p-3 flex-1 flex flex-col gap-2 relative overflow-auto">
        <PromptComposer
          prompt={prompt}
          disabled={generation.type === 'loading'}
          onPromptChange={setPrompt}
          onSubmit={() => void handleGenerate()}
        />
        <GenerationResult
          generation={generation}
          onRetry={handleRetry}
          onInsert={handleInsert}
          onCopy={handleCopy}
        />
      </div>
    </div>
  );
}
