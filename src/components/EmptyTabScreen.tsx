import { memo } from 'react';
import { FileQuestion } from 'lucide-react';

const EmptyTabScreen = memo(function EmptyTabScreen() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background relative">
      <div className="w-16 h-16 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground mb-4">
        <FileQuestion size={28} />
      </div>
      <p className="text-muted-foreground text-sm">No tab open</p>
      <p className="text-muted-foreground/60 text-xs mt-1">Select a table from the sidebar to get started</p>
    </div>
  );
});

export default EmptyTabScreen;