interface SuggestionListProps {
  suggestions: readonly string[];
  disabled: boolean;
  onSelect: (value: string) => void;
}

export function SuggestionList({
  suggestions,
  disabled,
  onSelect,
}: SuggestionListProps) {
  return (
    <div className="p-3 border-b border-border/50">
      <div className="text-xs text-muted-foreground mb-2 tracking-wider font-sans">SUGGESTIONS</div>
      <div className="flex flex-col gap-1.5">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSelect(suggestion)}
            disabled={disabled}
            className="bg-secondary border border-border text-muted-foreground p-2 rounded-md text-left text-sm hover:bg-accent hover:text-foreground transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            &ldquo;{suggestion}&rdquo;
          </button>
        ))}
      </div>
    </div>
  );
}
