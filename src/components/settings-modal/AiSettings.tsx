import { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  Loader2, 
  Zap, 
  Bot, 
  Cpu, 
  Plus, 
  Trash2, 
  Save, 
  Undo2, 
  Key, 
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  getDefaultAiProviderConfig,
  hasCustomAiApiKey,
  saveCustomAiApiKey,
  clearCustomAiApiKey,
  type DefaultAiProviderConfig,
} from '@/lib/db';
import { type AiCustomProviderKind, useAppStore } from '@/store/useAppStore';

const DEFAULT_ENV_VALUE = '__default_env__';
const DEFAULT_POLLI_BASE_URL = 'https://gen.pollinations.ai';
const DEFAULT_POLLI_MODEL = 'openai';
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

export function AiSettings() {
  const aiProviderMode = useAppStore((state) => state.aiProviderMode);
  const setAiProviderMode = useAppStore((state) => state.setAiProviderMode);
  const aiCustomProfiles = useAppStore((state) => state.aiCustomProfiles);
  const aiActiveCustomProfileId = useAppStore((state) => state.aiActiveCustomProfileId);
  const setAiActiveCustomProfileId = useAppStore((state) => state.setAiActiveCustomProfileId);
  const upsertAiCustomProfile = useAppStore((state) => state.upsertAiCustomProfile);
  const removeAiCustomProfile = useAppStore((state) => state.removeAiCustomProfile);
  const showAlert = useAppStore((state) => state.showAlert);

  const [defaultConfig, setDefaultConfig] = useState<DefaultAiProviderConfig | null>(null);
  const [formName, setFormName] = useState('');
  const [formProviderKind, setFormProviderKind] = useState<AiCustomProviderKind>('polli');
  const [formBaseUrl, setFormBaseUrl] = useState('');
  const [formModel, setFormModel] = useState('');
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [isCreatingEnvironment, setIsCreatingEnvironment] = useState(false);

  const selectedEnvValue = useMemo(
    () =>
      aiProviderMode === 'default'
        ? DEFAULT_ENV_VALUE
        : (aiActiveCustomProfileId ?? DEFAULT_ENV_VALUE),
    [aiProviderMode, aiActiveCustomProfileId],
  );

  const defaultPolliBaseUrl = defaultConfig?.baseUrl ?? DEFAULT_POLLI_BASE_URL;
  const defaultPolliModel = defaultConfig?.model ?? DEFAULT_POLLI_MODEL;

  const resetToDefaultEnvironment = useCallback(() => {
    setAiProviderMode('default');
    setFormName('');
    setFormProviderKind('polli');
    setFormBaseUrl(defaultPolliBaseUrl);
    setFormModel(defaultPolliModel);
    setApiKeyInput('');
    setHasSavedApiKey(false);
  }, [defaultPolliBaseUrl, defaultPolliModel, setAiProviderMode]);

  const loadProfileIntoForm = useCallback(
    (profileId: string) => {
      const profile = aiCustomProfiles.find((item) => item.id === profileId);
      if (!profile) {
        return null;
      }

      setAiProviderMode('custom');
      setAiActiveCustomProfileId(profile.id);
      setFormName(profile.name);
      setFormProviderKind(profile.providerKind);
      setFormBaseUrl(profile.baseUrl);
      setFormModel(profile.model);
      setHasSavedApiKey(profile.hasApiKey);
      setApiKeyInput('');
      return profile;
    },
    [aiCustomProfiles, setAiActiveCustomProfileId, setAiProviderMode],
  );

  const withTimeout = useCallback(async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error('AI operation timed out.')), ms);
      }),
    ]);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      try {
        const resolvedDefaults = await withTimeout(getDefaultAiProviderConfig(), 4000);
        if (!cancelled) {
          setDefaultConfig(resolvedDefaults);
        }
      } catch (error) {
        console.error('Failed to load AI settings:', error);
        if (!cancelled) {
          showAlert({
            title: 'Failed to load AI settings',
            message: error instanceof Error ? error.message : 'Could not read AI configuration.',
            type: 'error',
          });
        }
      }
    };

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, [showAlert, withTimeout]);

  useEffect(() => {
    if (aiProviderMode === 'default') {
      setFormName('Default (Pollinations)');
      setFormProviderKind('polli');
      setFormBaseUrl(defaultPolliBaseUrl);
      setFormModel(defaultPolliModel);
      setHasSavedApiKey(false);
      setApiKeyInput('');
    }
  }, [aiProviderMode, defaultPolliBaseUrl, defaultPolliModel]);

  useEffect(() => {
    if (aiProviderMode !== 'custom' || aiActiveCustomProfileId || isCreatingEnvironment) {
      return;
    }

    resetToDefaultEnvironment();
  }, [
    aiProviderMode,
    aiActiveCustomProfileId,
    isCreatingEnvironment,
    resetToDefaultEnvironment,
  ]);

  useEffect(() => {
    if (aiProviderMode !== 'custom' || isCreatingEnvironment || !aiActiveCustomProfileId) {
      return;
    }

    const profile = loadProfileIntoForm(aiActiveCustomProfileId);
    if (!profile) {
      resetToDefaultEnvironment();
      return;
    }

    let cancelled = false;

    void hasCustomAiApiKey(profile.id)
      .then((hasKey: boolean) => {
        if (cancelled) {
          return;
        }

        setHasSavedApiKey(hasKey);
        if (hasKey !== profile.hasApiKey) {
          upsertAiCustomProfile({ ...profile, hasApiKey: hasKey });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error('Failed to read API key state:', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    aiActiveCustomProfileId,
    aiProviderMode,
    isCreatingEnvironment,
    loadProfileIntoForm,
    resetToDefaultEnvironment,
    withTimeout,
    upsertAiCustomProfile,
  ]);

  const handleSelectEnvironment = useCallback(
    (value: string) => {
      if (value === DEFAULT_ENV_VALUE) {
        setAiActiveCustomProfileId(null);
        setIsCreatingEnvironment(false);
        resetToDefaultEnvironment();
        return;
      }

      setAiProviderMode('custom');
      setIsCreatingEnvironment(false);

      const profile = loadProfileIntoForm(value);
      if (!profile) {
        return;
      }

      void hasCustomAiApiKey(profile.id)
        .then((hasKey: boolean) => {
          setHasSavedApiKey(hasKey);
          if (hasKey !== profile.hasApiKey) {
            upsertAiCustomProfile({ ...profile, hasApiKey: hasKey });
          }
        })
        .catch((error: unknown) => console.error('Failed to read API key state:', error));
    },
    [
      loadProfileIntoForm,
      resetToDefaultEnvironment,
      setAiActiveCustomProfileId,
      setAiProviderMode,
      withTimeout,
      upsertAiCustomProfile,
    ],
  );

  const handleStartCreateEnvironment = useCallback(() => {
    setAiProviderMode('custom');
    setAiActiveCustomProfileId(null);
    setIsCreatingEnvironment(true);
    setFormName('');
    setFormProviderKind('polli');
    setFormBaseUrl(DEFAULT_POLLI_BASE_URL);
    setFormModel(DEFAULT_POLLI_MODEL);
    setHasSavedApiKey(false);
    setApiKeyInput('');
  }, [setAiActiveCustomProfileId, setAiProviderMode]);

  const handleCancelCreateEnvironment = useCallback(() => {
    setIsCreatingEnvironment(false);
    setApiKeyInput('');
    setHasSavedApiKey(false);

    if (!aiActiveCustomProfileId) {
      resetToDefaultEnvironment();
      return;
    }

    const profile = loadProfileIntoForm(aiActiveCustomProfileId);
    if (!profile) {
      resetToDefaultEnvironment();
    }
  }, [aiActiveCustomProfileId, loadProfileIntoForm, resetToDefaultEnvironment]);

  const handleProviderKindChange = useCallback(
    (value: AiCustomProviderKind) => {
      setFormProviderKind(value);

      if (value === 'polli') {
        setFormBaseUrl(defaultPolliBaseUrl);
        if (!formModel.trim()) {
          setFormModel(defaultPolliModel);
        }
        if (!formName.trim()) {
          setFormName('My Pollinations');
        }
        return;
      }

      if (!formName.trim()) {
        setFormName('My OpenAI');
      }
      setFormBaseUrl(DEFAULT_OPENAI_BASE_URL);
      if (!formModel.trim() || formModel === defaultPolliModel) {
        setFormModel(DEFAULT_OPENAI_MODEL);
      }
    },
    [defaultPolliBaseUrl, defaultPolliModel, formModel, formName],
  );

  const handleSaveProfile = useCallback(async () => {
    const resolvedName = formName.trim();
    const resolvedBaseUrl = formBaseUrl.trim();
    const resolvedModel = formModel.trim();

    if (!resolvedName || !resolvedBaseUrl || !resolvedModel) {
      showAlert({
        title: 'Missing custom configuration fields',
        message: 'Name, base URL, and model are required.',
        type: 'error',
      });
      return;
    }

    setSavingProfile(true);
    const profileId =
      aiActiveCustomProfileId ??
      `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    try {
      let nextHasApiKey =
        aiCustomProfiles.find((profile) => profile.id === profileId)?.hasApiKey ?? false;

      if (apiKeyInput.trim()) {
        await saveCustomAiApiKey(apiKeyInput.trim(), profileId);
        nextHasApiKey = true;
        setApiKeyInput('');
        setHasSavedApiKey(true);
      }

      upsertAiCustomProfile({
        id: profileId,
        name: resolvedName,
        providerKind: formProviderKind,
        baseUrl: resolvedBaseUrl,
        model: resolvedModel,
        hasApiKey: nextHasApiKey,
      });
      setAiActiveCustomProfileId(profileId);
      setIsCreatingEnvironment(false);
      showAlert({
        title: 'AI environment saved',
        message: 'Environment added to the switch list.',
        type: 'success',
      });
    } catch (error) {
      console.error('Failed to save custom AI configuration:', error);
      showAlert({
        title: 'Failed to save custom configuration',
        message: error instanceof Error ? error.message : 'Could not save custom AI configuration.',
        type: 'error',
      });
    } finally {
      setSavingProfile(false);
    }
  }, [
    aiActiveCustomProfileId,
    aiCustomProfiles,
    apiKeyInput,
    formBaseUrl,
    formModel,
    formName,
    formProviderKind,
    showAlert,
    upsertAiCustomProfile,
    setAiActiveCustomProfileId,
    withTimeout,
  ]);

  const handleClearApiKey = useCallback(async () => {
    if (!aiActiveCustomProfileId) {
      return;
    }

    setSavingKey(true);
    try {
      await clearCustomAiApiKey(aiActiveCustomProfileId);
      setHasSavedApiKey(false);
      const currentProfile = aiCustomProfiles.find((profile) => profile.id === aiActiveCustomProfileId);
      if (currentProfile) {
        upsertAiCustomProfile({ ...currentProfile, hasApiKey: false });
      }
      showAlert({
        title: 'API key removed',
        message: 'Removed from the selected environment.',
        type: 'success',
      });
    } catch (error) {
      console.error('Failed to clear AI API key:', error);
      showAlert({
        title: 'Failed to remove API key',
        message: error instanceof Error ? error.message : 'Could not remove API key.',
        type: 'error',
      });
    } finally {
      setSavingKey(false);
    }
  }, [aiActiveCustomProfileId, aiCustomProfiles, showAlert, upsertAiCustomProfile, withTimeout]);

  const handleDeleteProfile = useCallback(async () => {
    if (!aiActiveCustomProfileId) {
      return;
    }

    setSavingProfile(true);
    try {
      const currentProfile = aiCustomProfiles.find((profile) => profile.id === aiActiveCustomProfileId);
      if (hasSavedApiKey || currentProfile?.hasApiKey) {
        try {
          await clearCustomAiApiKey(aiActiveCustomProfileId);
        } catch (error) {
          console.error('Failed to remove AI API key during profile deletion:', error);
        }
      }

      removeAiCustomProfile(aiActiveCustomProfileId);
      setAiActiveCustomProfileId(null);
      setIsCreatingEnvironment(false);
      setFormName('');
      setFormProviderKind('polli');
      setFormBaseUrl(DEFAULT_POLLI_BASE_URL);
      setFormModel(DEFAULT_POLLI_MODEL);
      setApiKeyInput('');
      setHasSavedApiKey(false);
      showAlert({
        title: 'AI environment removed',
        message: 'The selected environment was removed from the list.',
        type: 'success',
      });
    } catch (error) {
      console.error('Failed to remove custom profile:', error);
      showAlert({
        title: 'Failed to remove custom configuration',
        message: error instanceof Error ? error.message : 'Could not remove configuration.',
        type: 'error',
      });
    } finally {
      setSavingProfile(false);
    }
  }, [
    aiActiveCustomProfileId,
    aiCustomProfiles,
    hasSavedApiKey,
    removeAiCustomProfile,
    setAiActiveCustomProfileId,
    showAlert,
    withTimeout,
  ]);

  return (
    <div className="flex h-full min-h-[500px] flex-col overflow-hidden md:flex-row gap-0 border border-border bg-background shadow-md pb-2 rounded-sm">
      {/* Sidebar: Environment List */}
      <div className="w-full md:w-72 border-r border-border/50 bg-secondary/10 flex flex-col">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Globe size={14} className="text-primary" />
            Environments
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-sm hover:bg-primary hover:text-primary-foreground transition-colors"
            onClick={() => handleStartCreateEnvironment()}
            disabled={savingProfile}
          >
            <Plus size={16} />
          </Button>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {/* Default Card */}
            <button
              onClick={() => handleSelectEnvironment(DEFAULT_ENV_VALUE)}
              className={cn(
                "w-full text-left p-3 rounded-sm transition-all group relative overflow-hidden",
                selectedEnvValue === DEFAULT_ENV_VALUE 
                  ? "bg-primary/10 border border-primary/30 shadow-sm" 
                  : "hover:bg-secondary/40 border border-transparent"
              )}
            >
              <div className="flex items-center gap-3 relative z-10">
                <div className={cn(
                  "p-2 rounded-sm",
                  selectedEnvValue === DEFAULT_ENV_VALUE ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                )}>
                  <Zap size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">Default</p>
                  <p className="text-[10px] text-muted-foreground truncate uppercase font-mono">Pollinations AI</p>
                </div>
                {selectedEnvValue === DEFAULT_ENV_VALUE && (
                  <ChevronRight size={14} className="text-primary animate-pulse" />
                )}
              </div>
            </button>

            {/* Custom Profiles */}
            {aiCustomProfiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => handleSelectEnvironment(profile.id)}
                className={cn(
                  "w-full text-left p-3 rounded-sm transition-all group relative overflow-hidden",
                  selectedEnvValue === profile.id 
                    ? "bg-primary/10 border border-primary/30 shadow-sm" 
                    : "hover:bg-secondary/40 border border-transparent"
                )}
              >
                <div className="flex items-center gap-3 relative z-10">
                  <div className={cn(
                    "p-2 rounded-sm",
                    selectedEnvValue === profile.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                  )}>
                    {profile.providerKind === 'polli' ? <Zap size={16} /> : <Bot size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{profile.name}</p>
                    <div className="flex items-center gap-1">
                      <p className="text-[10px] text-muted-foreground truncate uppercase font-mono">
                        {profile.providerKind === 'openai' ? 'OpenAI' : 'Polli'}
                      </p>
                      {profile.hasApiKey && (
                        <ShieldCheck size={10} className="text-primary" />
                      )}
                    </div>
                  </div>
                  {selectedEnvValue === profile.id && (
                    <ChevronRight size={14} className="text-primary animate-pulse" />
                  )}
                </div>
              </button>
            ))}

            {isCreatingEnvironment && (
              <div className="w-full text-left p-3 rounded-sm bg-primary/5 border border-dashed border-primary/40">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-sm bg-primary/20 text-primary animate-pulse">
                    <Cpu size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold italic truncate text-primary">New Environment...</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content Area: Detail Console */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-background/30 overflow-hidden">
        {/* Scrollable Form Section */}
        <ScrollArea className="flex-1 h-full">
          <div className="p-6 space-y-8">
            {/* Header section */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight">
                  {isCreatingEnvironment ? 'Architect Node' : (aiProviderMode === 'default' ? 'Global Default' : formName)}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="text-[10px] uppercase font-bold tracking-tighter text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-sm border border-border/50">
                    {isCreatingEnvironment ? 'Drafting' : 'Operational'}
                  </span>
                </div>
              </div>
              {isCreatingEnvironment && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-sm px-4 border-dashed"
                  onClick={() => handleCancelCreateEnvironment()}
                  disabled={savingProfile}
                >
                  <Undo2 size={14} className="mr-2" />
                  Discard
                </Button>
              )}
            </div>

            {/* Config Sections */}
            <div className="grid gap-6">
              {/* Connection Specs */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                  <Globe size={14} className="text-primary" />
                  <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Endpoint Specifications</h4>
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="custom-name" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Alias</Label>
                    <Input
                      id="custom-name"
                      value={formName}
                      disabled={aiProviderMode === 'default' && !isCreatingEnvironment}
                      onChange={(event) => setFormName(event.target.value)}
                      placeholder="e.g. My Pollinations"
                      className="bg-background border-border/50 placeholder:text-muted-foreground/40 text-sm font-medium focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary h-9 rounded-sm"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custom-provider-kind" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Core Logic</Label>
                    <Select
                      disabled={true}
                      value={formProviderKind}
                      onValueChange={(value) => handleProviderKindChange(value as AiCustomProviderKind)}
                    >
                      <SelectTrigger id="custom-provider-kind" className="bg-background border-border/50 text-sm focus:ring-1 focus:ring-primary h-9 rounded-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-sm">
                        <SelectItem value="polli">Pollinations</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="custom-base-url" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Base Protocol (URL)</Label>
                  <Input
                    id="custom-base-url"
                    value={formBaseUrl}
                    disabled={aiProviderMode === 'default' && !isCreatingEnvironment}
                    onChange={(event) => setFormBaseUrl(event.target.value)}
                    placeholder={DEFAULT_OPENAI_BASE_URL}
                    className="bg-background border-border/50 placeholder:text-muted-foreground/40 font-mono text-xs focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary h-9 rounded-sm"
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="custom-model" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Model ID</Label>
                  <Input
                    id="custom-model"
                    value={formModel}
                    disabled={aiProviderMode === 'default' && !isCreatingEnvironment}
                    onChange={(event) => setFormModel(event.target.value)}
                    placeholder={DEFAULT_OPENAI_MODEL}
                    className="bg-background border-border/50 placeholder:text-muted-foreground/40 font-mono text-xs focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary h-9 rounded-sm"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Security Specs */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                  <Key size={14} className="text-primary" />
                  <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Security Vault</h4>
                </div>

                <div className="space-y-2 relative">
                  <Label htmlFor="custom-api-key-inline" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">API Authentication Key</Label>
                  <div className="relative">
                    <Input
                      id="custom-api-key-inline"
                      type="password"
                      value={apiKeyInput}
                      disabled={aiProviderMode === 'default' && !isCreatingEnvironment}
                      onChange={(event) => setApiKeyInput(event.target.value)}
                      placeholder={
                        hasSavedApiKey
                          ? '••••••••••••••••'
                          : 'sk-...'
                      }
                      className="bg-background border-border/50 placeholder:text-muted-foreground/40 pr-10 font-mono focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary h-9 rounded-sm"
                      autoComplete="off"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50">
                      {hasSavedApiKey ? <ShieldCheck size={14} className="text-primary" /> : <ShieldAlert size={14} />}
                    </div>
                  </div>
                  {hasSavedApiKey && (
                    <p className="text-[10px] text-primary/70 lg:ml-1 italic italic">
                      Key securely stored. Enter a new value to replace it.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Action Footer - Fixed at bottom without absolute hacks */}
        <div className="border-t border-border bg-background p-5 pb-8 flex items-center justify-between gap-3 flex-shrink-0 z-20">
          <div className="flex items-center gap-2">
            {aiActiveCustomProfileId || isCreatingEnvironment ? (
              <>
                <Button 
                  onClick={() => void handleSaveProfile()} 
                  disabled={savingProfile}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all font-bold px-8 h-10 rounded-sm"
                >
                  {savingProfile ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
                  Save Changes
                </Button>
                
                {hasSavedApiKey && aiActiveCustomProfileId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void handleClearApiKey()}
                    disabled={savingKey}
                    title="Clear API Key"
                    className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors rounded-sm"
                  >
                    {savingKey ? <Loader2 size={16} className="animate-spin" /> : <Key size={18} />}
                  </Button>
                )}
              </>
            ) : (
              <Button disabled variant="outline" className="opacity-50 cursor-not-allowed border-dashed px-6 h-10 rounded-sm">
                <ShieldCheck size={14} className="mr-2" />
                Default Environment (Read Only)
              </Button>
            )}
          </div>

          {aiActiveCustomProfileId && !isCreatingEnvironment && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleDeleteProfile()}
              disabled={savingProfile}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors rounded-sm"
            >
              <Trash2 size={14} className="mr-2" />
              Terminate Node
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
