import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAppStore, type Theme } from '../store/useAppStore';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { executeTransaction, getTableStructure } from '@/lib/db';
import { buildSampleDataTransaction, getInsertableColumns } from '@/lib/sampleData';
import { 
  Settings, 
  Palette, 
  Keyboard, 
  Info,
  Database,
  Sliders,
  Sun,
  Moon,
  Sparkles,
  FlaskConical,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import packageJson from '../../package.json';

type SettingsTab = 'general' | 'appearance' | 'keybindings' | 'developer' | 'about';

interface SettingsNavItem {
  id: SettingsTab;
  label: string;
  icon: React.ReactNode;
}

const navItems: SettingsNavItem[] = [
  { id: 'general', label: 'General', icon: <Sliders size={16} /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
  { id: 'keybindings', label: 'Keybindings', icon: <Keyboard size={16} /> },
  { id: 'developer', label: 'Developer', icon: <FlaskConical size={16} /> },
  { id: 'about', label: 'About', icon: <Info size={16} /> },
];

interface ThemeOption {
  id: Theme;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  iconClass?: string;
}

const themeOptions: ThemeOption[] = [
  { 
    id: 'dark', 
    name: 'VibeDB Dark', 
    description: 'Default dark theme for database work', 
    icon: <Moon size={16} />,
    color: '#0a0a0f'
  },
  { 
    id: 'dark-modern', 
    name: 'Dark Modern', 
    description: 'Sleek dark theme with cyan accents', 
    icon: <Moon size={16} />,
    color: '#0d1117'
  },
  { 
    id: 'light', 
    name: 'Light', 
    description: 'Clean light theme for daytime use', 
    icon: <Sun size={16} />,
    color: '#ffffff',
    iconClass: 'text-gray-800'
  },
  { 
    id: 'purple', 
    name: 'Purple Solarized', 
    description: 'Vibrant purple theme with solarized feel', 
    icon: <Sparkles size={16} />,
    color: '#1a1625'
  },
];

function GeneralSettings() {
  const connections = useAppStore(s => s.connections);
  const developerToolsEnabled = useAppStore(s => s.developerToolsEnabled);
  const setDeveloperToolsEnabled = useAppStore(s => s.setDeveloperToolsEnabled);
  const activeCount = useMemo(() => connections.filter(c => c.connId).length, [connections]);
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Connection Settings</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
            <div>
              <div className="text-sm font-medium">Max Active Connections</div>
              <div className="text-xs text-muted-foreground mt-0.5">Limit concurrent database connections</div>
            </div>
            <div className="text-sm font-mono text-primary">5</div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
            <div>
              <div className="text-sm font-medium">Saved Connections</div>
              <div className="text-xs text-muted-foreground mt-0.5">Total connections in history</div>
            </div>
            <div className="text-sm font-mono text-primary">{connections.length}</div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
            <div>
              <div className="text-sm font-medium">Currently Active</div>
              <div className="text-xs text-muted-foreground mt-0.5">Active connections now</div>
            </div>
            <div className="text-sm font-mono text-primary">{activeCount}</div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Query Settings</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
            <div>
              <div className="text-sm font-medium">Max Result Rows</div>
              <div className="text-xs text-muted-foreground mt-0.5">Rows returned per query (auto-truncate)</div>
            </div>
            <div className="text-sm font-mono text-primary">1000</div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Advanced Utilities</h3>
        <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-secondary/50 border border-border">
          <div>
            <div className="text-sm font-medium">Enable Developer Tools</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Shows production-safe utilities like sample data generation behind an explicit opt-in.
            </div>
          </div>
          <Checkbox
            checked={developerToolsEnabled}
            onCheckedChange={(checked) => setDeveloperToolsEnabled(checked === true)}
            aria-label="Enable developer tools"
          />
        </div>
      </div>
    </div>
  );
}

const rowCountOptions = ['100', '1000', '10000'] as const;

function DeveloperSettings() {
  const developerToolsEnabled = useAppStore(s => s.developerToolsEnabled);
  const activeSidebarConnectionId = useAppStore(s => s.activeSidebarConnectionId);
  const connections = useAppStore(s => s.connections);
  const tablesByConnection = useAppStore(s => s.tablesByConnection);
  const showAlert = useAppStore(s => s.showAlert);

  const activeConnection = useMemo(
    () => connections.find((connection) => connection.id === activeSidebarConnectionId) ?? null,
    [connections, activeSidebarConnectionId]
  );
  const connectionTables = useMemo(
    () => (activeSidebarConnectionId ? tablesByConnection[activeSidebarConnectionId] ?? [] : []),
    [activeSidebarConnectionId, tablesByConnection]
  );

  const [selectedTable, setSelectedTable] = useState('');
  const [rowCount, setRowCount] = useState('1000');
  const [customRowCount, setCustomRowCount] = useState('');
  const [confirmInsert, setConfirmInsert] = useState(false);
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [runningInsert, setRunningInsert] = useState(false);
  const [columns, setColumns] = useState<Awaited<ReturnType<typeof getTableStructure>>>([]);
  const [structureError, setStructureError] = useState('');

  useEffect(() => {
    setSelectedTable((current) => {
      if (!connectionTables.some((table) => table.name === current)) {
        return connectionTables[0]?.name ?? '';
      }
      return current;
    });
  }, [connectionTables]);

  useEffect(() => {
    let cancelled = false;

    const loadStructure = async () => {
      if (!selectedTable || !activeConnection?.connId) {
        setColumns([]);
        setStructureError('');
        return;
      }

      setLoadingStructure(true);
      setStructureError('');

      try {
        const nextColumns = await getTableStructure(selectedTable, activeConnection.connId);
        if (!cancelled) {
          setColumns(nextColumns);
        }
      } catch (error) {
        console.error('Failed to load table structure:', error);
        if (!cancelled) {
          setColumns([]);
          setStructureError('Failed to inspect the selected table.');
        }
      } finally {
        if (!cancelled) {
          setLoadingStructure(false);
        }
      }
    };

    void loadStructure();

    return () => {
      cancelled = true;
    };
  }, [selectedTable, activeConnection?.connId]);

  const insertableColumns = useMemo(() => getInsertableColumns(columns), [columns]);
  const resolvedRowCount = useMemo(() => {
    const source = rowCount === 'custom' ? customRowCount : rowCount;
    const parsed = Number.parseInt(source, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [rowCount, customRowCount]);

  const handleGenerate = useCallback(async () => {
    if (!developerToolsEnabled || !activeConnection?.connId || !selectedTable) {
      return;
    }
    if (!confirmInsert || resolvedRowCount <= 0 || insertableColumns.length === 0) {
      return;
    }

    setRunningInsert(true);
    try {
      const queries = buildSampleDataTransaction(selectedTable, columns, resolvedRowCount);
      const result = await executeTransaction(queries, activeConnection.connId);
      showAlert({
        title: 'Sample data generated',
        message: result.message || `Inserted ${resolvedRowCount} rows into ${selectedTable}.`,
        type: 'success',
      });
      setConfirmInsert(false);
    } catch (error) {
      console.error('Failed to generate sample data:', error);
      showAlert({
        title: 'Sample data generation failed',
        message: error instanceof Error ? error.message : 'The insert transaction did not complete.',
        type: 'error',
      });
    } finally {
      setRunningInsert(false);
    }
  }, [
    developerToolsEnabled,
    activeConnection?.connId,
    selectedTable,
    confirmInsert,
    resolvedRowCount,
    insertableColumns.length,
    columns,
    showAlert,
  ]);

  const canGenerate =
    developerToolsEnabled &&
    !!activeConnection?.connId &&
    !!selectedTable &&
    resolvedRowCount > 0 &&
    insertableColumns.length > 0 &&
    confirmInsert &&
    !loadingStructure &&
    !runningInsert;

  if (!developerToolsEnabled) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert size={18} className="mt-0.5 text-warning" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Developer tools are disabled</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Enable Developer Tools from General settings before using sample data generation in production builds.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Sample Data Generator</h3>
        <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sample-connection">Connection</Label>
              <div
                id="sample-connection"
                className="flex h-9 items-center rounded-md border border-input bg-background/50 px-3 text-sm text-foreground"
              >
                {activeConnection?.name ?? 'No active connection'}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sample-table">Target Table</Label>
              <Select value={selectedTable} onValueChange={setSelectedTable} disabled={connectionTables.length === 0}>
                <SelectTrigger id="sample-table">
                  <SelectValue placeholder="Select a table" />
                </SelectTrigger>
                <SelectContent>
                  {connectionTables.map((table) => (
                    <SelectItem key={table.name} value={table.name}>
                      {table.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
            <div className="space-y-2">
              <Label htmlFor="sample-row-count">Rows to insert</Label>
              <Select value={rowCount} onValueChange={setRowCount}>
                <SelectTrigger id="sample-row-count">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rowCountOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {Number(option).toLocaleString()} rows
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sample-custom-count">Custom rows</Label>
              <Input
                id="sample-custom-count"
                type="number"
                min={1}
                step={1}
                value={customRowCount}
                onChange={(event) => setCustomRowCount(event.target.value)}
                placeholder="500"
                disabled={rowCount !== 'custom'}
              />
            </div>
          </div>

          <div className="rounded-md border border-border bg-background/50 p-3 text-xs text-muted-foreground space-y-1">
            <div>Insert mode: batched multi-row inserts inside a single transaction.</div>
            <div>
              Insertable columns: {loadingStructure ? 'Loading...' : insertableColumns.length}
            </div>
            <div>
              Estimated batches: {resolvedRowCount > 0 ? Math.ceil(resolvedRowCount / 200) : 0}
            </div>
            {structureError && <div className="text-destructive">{structureError}</div>}
          </div>

          <label className="flex items-start gap-3 rounded-md border border-warning/20 bg-warning/10 p-3">
            <Checkbox checked={confirmInsert} onCheckedChange={(checked) => setConfirmInsert(checked === true)} />
            <span className="text-xs text-muted-foreground leading-relaxed">
              I understand this writes synthetic rows into the selected table on the active database connection.
            </span>
          </label>

          <Button onClick={() => void handleGenerate()} disabled={!canGenerate} className="w-full sm:w-auto">
            {runningInsert ? <Loader2 size={14} className="mr-2 animate-spin" /> : <FlaskConical size={14} className="mr-2" />}
            Generate Sample Data
          </Button>
        </div>
      </div>
    </div>
  );
}

function AppearanceSettings() {
  const theme = useAppStore(s => s.theme);
  const setTheme = useAppStore(s => s.setTheme);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Theme</h3>
        <div className="space-y-2">
          {themeOptions.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                theme === t.id
                  ? "bg-primary/10 border-primary/40"
                  : "bg-secondary/30 border-border hover:border-primary/20 hover:bg-secondary/50"
              )}
            >
              <div 
                className="w-10 h-10 rounded-lg border flex items-center justify-center shrink-0"
                style={{ backgroundColor: t.color, borderColor: theme === t.id ? 'var(--accent-primary)' : 'var(--border)' }}
              >
                <span className={cn(t.iconClass || 'text-primary')}>
                  {t.icon}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.description}</div>
              </div>
              {theme === t.id && (
                <div className="w-2 h-2 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const shortcuts = [
  { keys: ['Cmd', 'N'], action: 'New Connection' },
  { keys: ['Cmd', 'W'], action: 'Close Tab' },
  { keys: ['Cmd', 'T'], action: 'New Query Tab' },
  { keys: ['Cmd', 'L'], action: 'Toggle Logs' },
  { keys: ['Cmd', ','], action: 'Open Settings' },
  { keys: ['Cmd', 'Enter'], action: 'Execute Query' },
];

function KeybindingsSettings() {

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Keyboard Shortcuts</h3>
        <div className="space-y-2">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border">
              <span className="text-sm text-muted-foreground">{s.action}</span>
              <div className="flex gap-1">
                {s.keys.map((key, j) => (
                  <kbd key={j} className="px-2 py-0.5 text-[10px] font-mono bg-background rounded border border-border text-foreground">
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AboutSettings() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center py-6">
        <div className="w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
          <Database size={32} className="text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">VibeDB</h2>
        <p className="text-sm text-muted-foreground mt-1">Cross-platform SQLite Manager</p>
        <div className="text-xs font-mono text-muted-foreground/60 mt-2">Version {packageJson.version}</div>
      </div>

      <div className="p-4 rounded-lg bg-secondary/30 border border-border">
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          A premium, high-performance SQLite database manager built with Tauri v2, React, and Rust. Designed with AI-assisted "vibe coding" for a superior developer experience.
        </p>
      </div>

      <div className="text-center">
        <a 
          href="https://github.com/Rithprohos/Vibe-DB" 
          className="text-xs text-primary hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub Repository
        </a>
      </div>
    </div>
  );
}

export default function SettingsModal() {
  const showSettingsModal = useAppStore(s => s.showSettingsModal);
  const setShowSettingsModal = useAppStore(s => s.setShowSettingsModal);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const activeLabel = useMemo(() => navItems.find(i => i.id === activeTab)?.label, [activeTab]);

  const renderContent = () => {
    switch (activeTab) {
      case 'general': return <GeneralSettings />;
      case 'appearance': return <AppearanceSettings />;
      case 'keybindings': return <KeybindingsSettings />;
      case 'developer': return <DeveloperSettings />;
      case 'about': return <AboutSettings />;
    }
  };

  return (
    <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
      <DialogContent className="sm:max-w-[680px] h-[480px] bg-card border-border shadow-xl shadow-black/5 dark:shadow-2xl dark:shadow-black/40 p-0 overflow-hidden flex">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Configure VibeDB preferences, appearance, keyboard shortcuts, and application information.
        </DialogDescription>
        <div className="w-[180px] bg-secondary/30 border-r border-border flex flex-col shrink-0">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Settings size={16} className="text-primary" />
              <span className="text-sm font-semibold">Settings</span>
            </div>
          </div>
          <nav className="flex-1 p-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left",
                  activeTab === item.id
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border shrink-0">
            <h2 className="text-base font-semibold text-foreground">
              {activeLabel}
            </h2>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {renderContent()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
