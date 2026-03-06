import {
  FlaskConical,
  Info,
  Keyboard,
  Moon,
  Palette,
  Settings,
  Sliders,
  Sparkles,
  Sun,
} from 'lucide-react';
import { type SettingsNavItem, type ShortcutDefinition, type ThemeOption } from './types';

export const rowCountOptions = ['100', '1000', '10000'] as const;

export const navItems: SettingsNavItem[] = [
  { id: 'general', label: 'General', icon: <Sliders size={16} /> },
  { id: 'ai', label: 'AI', icon: <Sparkles size={16} /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
  { id: 'keybindings', label: 'Keybindings', icon: <Keyboard size={16} /> },
  { id: 'developer', label: 'Developer', icon: <FlaskConical size={16} /> },
  { id: 'about', label: 'About', icon: <Info size={16} /> },
];

export const themeOptions: ThemeOption[] = [
  {
    id: 'dark',
    name: 'VibeDB Dark',
    description: 'Default dark theme for database work',
    icon: <Moon size={16} />,
    color: '#0a0a0f',
  },
  {
    id: 'dark-modern',
    name: 'Dark Modern',
    description: 'Sleek dark theme with cyan accents',
    icon: <Moon size={16} />,
    color: '#0d1117',
  },
  {
    id: 'light',
    name: 'Light',
    description: 'Clean light theme for daytime use',
    icon: <Sun size={16} />,
    color: '#ffffff',
    iconClass: 'text-gray-800',
  },
  {
    id: 'purple',
    name: 'Purple Solarized',
    description: 'Vibrant purple theme with solarized feel',
    icon: <Sparkles size={16} />,
    color: '#1a1625',
  },
];

export const shortcuts: ShortcutDefinition[] = [
  { keys: ['Cmd', 'N'], action: 'New Connection' },
  { keys: ['Cmd', 'W'], action: 'Close Tab' },
  { keys: ['Cmd', 'T'], action: 'New Query Tab' },
  { keys: ['Cmd', 'L'], action: 'Toggle Logs' },
  { keys: ['Cmd', ','], action: 'Open Settings' },
  { keys: ['Cmd', 'Enter'], action: 'Execute Query' },
];

export const settingsIcon = <Settings size={16} className="text-primary" />;
