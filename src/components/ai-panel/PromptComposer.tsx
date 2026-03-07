import { Loader2, Sparkles } from 'lucide-react';

interface PromptComposerProps {
  prompt: string;
  disabled: boolean;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
}

export function PromptComposer({
  prompt,
  disabled,
  onPromptChange,
  onSubmit,
}: PromptComposerProps) {
  const isSubmitDisabled = disabled || !prompt.trim();

  return (
    <>
      <div className="text-xs text-muted-foreground tracking-wider font-sans">ASK IN PLAIN ENGLISH</div>
      <textarea
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSubmit();
          }
        }}
        placeholder="e.g. show me the largest tables..."
        disabled={disabled}
        className="bg-secondary border border-border text-foreground p-2.5 rounded-md text-sm resize-none h-[96px] outline-none focus:border-accent-secondary/50 focus:ring-1 focus:ring-accent-secondary/30 transition-all font-sans leading-relaxed placeholder:text-muted-foreground/50 disabled:opacity-50"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      <button
        onClick={onSubmit}
        disabled={isSubmitDisabled}
        className={`
          border-none p-2.5 rounded-md text-sm flex items-center justify-center gap-1.5 font-semibold tracking-wide transition-all
          ${isSubmitDisabled
            ? 'bg-border/30 text-muted-foreground/50 cursor-not-allowed'
            : 'bg-gradient-to-br from-accent-secondary to-purple-500 text-white cursor-pointer hover:opacity-90'}
        `}
      >
        {disabled ? (
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
    </>
  );
}
