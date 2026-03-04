import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Sparkles, Loader2, ArrowUpCircle } from 'lucide-react';

const SUGGESTIONS = [
  "show all tables",
  "count rows in users",
  "find largest records",
];

export default function AiPanel() {
  const tablesByConnection = useAppStore(s => s.tablesByConnection);
  const tabs = useAppStore(s => s.tabs);
  const activeSidebarConnectionId = useAppStore(s => s.activeSidebarConnectionId);
  const isAiPanelOpen = useAppStore(s => s.isAiPanelOpen);
  const activeTabId = useAppStore(s => s.activeTabId);
  const updateTab = useAppStore(s => s.updateTab);
  const addTab = useAppStore(s => s.addTab);
  const [prompt, setPrompt] = useState("");
  const [generatedSQL, setGeneratedSQL] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const activeTab = tabs.find(t => t.id === activeTabId);
  const isDataTabActive = activeTab?.type === 'data';

  const isVisible = isAiPanelOpen && isDataTabActive;

  const handleGenerate = (text?: string) => {
    const q = text || prompt;
    if (!q) return;
    
    setIsGenerating(true);
    setPrompt(q);
    
    // Clear any existing timer
    if (timerRef.current) clearTimeout(timerRef.current);
    
    // Simulate generation
    timerRef.current = setTimeout(() => {
      let mockSql = `-- AI generated from: ${q}\n`;
      if (q.includes("user")) mockSql += `SELECT * FROM users LIMIT 10;`;
      else if (q.includes("count")) mockSql += `SELECT count(*) FROM sqlite_master;`;
      else mockSql += `SELECT * FROM sqlite_master;`;
      
      setGeneratedSQL(mockSql);
      setIsGenerating(false);
    }, 900);
  };

  const handleInsert = () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTabId && activeTab?.type === 'query') {
      updateTab(activeTabId, { query: generatedSQL });
    } else {
      addTab({
        id: `query-ai-${Date.now()}`,
        connectionId: activeTab?.connectionId || activeSidebarConnectionId || "",
        type: 'query',
        title: 'AI Query',
        query: generatedSQL
      });
    }
  };

  return (
    <div
      className="bg-background border-l border-border flex flex-col shrink-0 h-full font-mono text-xs select-none overflow-hidden transition-[width,opacity] duration-250 ease-out"
      style={{ width: isVisible ? 280 : 0, opacity: isVisible ? 1 : 0 }}
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
        <div className="text-[10px] text-muted-foreground mb-1.5 tracking-wider font-sans">SCHEMA CONTEXT</div>
        <div className="bg-secondary rounded p-2 text-muted-foreground leading-relaxed max-h-[120px] overflow-auto border border-border">
          {(() => {
            const currentConnectionId = activeTab?.connectionId || activeSidebarConnectionId;
            const currentTables = currentConnectionId ? (tablesByConnection[currentConnectionId] || []) : [];
            
            if (currentTables.length === 0) {
              return <div className="text-[10px] italic">No tables found</div>;
            }
            
            return currentTables.map((t: { name: string }) => (
              <div key={t.name}>
                <span className="text-accent-secondary">{t.name}</span>
              </div>
            ));
          })()}
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
              className="bg-secondary border border-border text-muted-foreground p-1.5 rounded text-left text-[11px] hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
            >
              "{s}"
            </button>
          ))}
        </div>
      </div>

      {/* Prompt Input */}
      <div className="p-3 flex-1 flex flex-col gap-2 relative">
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
          className="bg-secondary border border-border text-foreground p-2 rounded text-[11px] resize-none h-[80px] outline-none focus:border-accent-secondary/50 focus:ring-1 focus:ring-accent-secondary/30 transition-all font-sans leading-relaxed placeholder:text-muted-foreground/50"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        
        <button
          onClick={() => handleGenerate()}
          disabled={isGenerating || !prompt}
          className={`
            border-none p-2 rounded text-[11px] flex items-center justify-center gap-1.5 font-semibold tracking-wide transition-all
            ${isGenerating || !prompt 
              ? 'bg-border/30 text-muted-foreground/50 cursor-not-allowed' 
              : 'bg-gradient-to-br from-accent-secondary to-purple-500 text-white cursor-pointer hover:opacity-90'}
          `}
        >
          {isGenerating ? (
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

        {generatedSQL && !isGenerating && (
          <div className="mt-2 bg-secondary border border-accent-secondary/30 rounded p-2 text-accent-secondary flex flex-col gap-2">
            <div className="text-[10px] text-muted-foreground/50 font-sans flex justify-between items-center">
              <span>✦ generated</span>
            </div>
            <pre className="m-0 whitespace-pre-wrap text-accent-secondary text-[11px]">
              {generatedSQL}
            </pre>
            <button
              onClick={handleInsert}
              className="mt-1 w-full bg-accent/50 border border-accent-secondary/30 text-accent-secondary py-1.5 rounded-[4px] cursor-pointer hover:bg-accent-secondary/20 transition-colors flex items-center justify-center gap-1.5"
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
