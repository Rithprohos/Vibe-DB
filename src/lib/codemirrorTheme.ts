import type { Extension } from "@codemirror/state";
import { vscodeDarkInit, vscodeLightInit } from "@uiw/codemirror-theme-vscode";

import type { Theme } from "@/store/types";

const sharedEditorSettings = {
  background: "var(--background)",
  foreground: "var(--foreground)",
  caret: "var(--foreground)",
  selection: "rgba(var(--glow-color), 0.22)",
  selectionMatch: "rgba(var(--glow-color), 0.35)",
  lineHighlight: "rgba(var(--glow-color), 0.08)",
  gutterBackground: "var(--background)",
  gutterForeground: "var(--muted-foreground)",
  gutterActiveForeground: "var(--foreground)",
  fontFamily: '"JetBrains Mono", monospace',
};

const codemirrorDarkTheme = vscodeDarkInit({
  settings: sharedEditorSettings,
});

const codemirrorLightTheme = vscodeLightInit({
  settings: sharedEditorSettings,
});

export function getCodeMirrorTheme(theme: Theme): Extension {
  return theme === "light" ? codemirrorLightTheme : codemirrorDarkTheme;
}
