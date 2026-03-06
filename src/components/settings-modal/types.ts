import { type ReactNode } from 'react';
import { type Theme } from '@/store/useAppStore';

export type SettingsTab = 'general' | 'ai' | 'appearance' | 'keybindings' | 'developer' | 'about';

export interface SettingsNavItem {
  id: SettingsTab;
  label: string;
  icon: ReactNode;
}

export interface ThemeOption {
  id: Theme;
  name: string;
  description: string;
  icon: ReactNode;
  color: string;
  iconClass?: string;
}

export interface ShortcutDefinition {
  keys: string[];
  action: string;
}
