import { lazy, Suspense, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useAppStore } from '@/store/useAppStore';
import { navItems } from './constants';
import { type SettingsTab } from './types';
import { GeneralSettings } from './GeneralSettings';
import { AppearanceSettings } from './AppearanceSettings';
import { KeybindingsSettings } from './KeybindingsSettings';
import { AboutSettings } from './AboutSettings';
import { SettingsSidebar } from './SettingsSidebar';

const AiSettings = lazy(async () => import('./AiSettings').then((module) => ({ default: module.AiSettings })));
const DeveloperSettings = lazy(async () =>
  import('./DeveloperSettings').then((module) => ({ default: module.DeveloperSettings })),
);

function SettingsContent({ activeTab }: { activeTab: SettingsTab }) {
  switch (activeTab) {
    case 'general':
      return <GeneralSettings />;
    case 'ai':
      return (
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading AI settings...</div>}>
          <AiSettings />
        </Suspense>
      );
    case 'appearance':
      return <AppearanceSettings />;
    case 'keybindings':
      return <KeybindingsSettings />;
    case 'developer':
      return (
        <Suspense
          fallback={<div className="text-sm text-muted-foreground">Loading developer tools...</div>}
        >
          <DeveloperSettings />
        </Suspense>
      );
    case 'about':
      return <AboutSettings />;
  }
}

export default function SettingsModal() {
  const showSettingsModal = useAppStore((state) => state.showSettingsModal);
  const setShowSettingsModal = useAppStore((state) => state.setShowSettingsModal);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const activeLabel = useMemo(
    () => navItems.find((item) => item.id === activeTab)?.label,
    [activeTab],
  );

  return (
    <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
      <DialogContent className="flex h-[650px] overflow-hidden border-border bg-card p-0 shadow-xl shadow-black/5 dark:shadow-2xl dark:shadow-black/40 sm:max-w-[1000px] rounded-sm">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Configure VibeDB preferences, appearance, keyboard shortcuts, and application
          information.
        </DialogDescription>

        <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-border p-4">
            <h2 className="text-base font-semibold text-foreground">{activeLabel}</h2>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <SettingsContent activeTab={activeTab} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
