import { Database } from 'lucide-react';
import packageJson from '../../../package.json';

export function AboutSettings() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center py-6">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
          <Database size={32} className="text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">VibeDB</h2>
        <p className="mt-1 text-sm text-muted-foreground">Premium Database Manager</p>
        <div className="mt-2 text-xs font-mono text-muted-foreground/60">
          Version {packageJson.version}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-secondary/30 p-4">
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          A premium, high-performance database manager built with Tauri v2, React, and
          Rust. Designed with AI-assisted &quot;vibe coding&quot; for a superior developer experience.
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
