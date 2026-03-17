import { useCallback, useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_SAVED_QUERY_NAME_LENGTH,
  type Connection,
} from "@/store/useAppStore";

export type SavedQueryDialogMode = "create" | "save-as" | "rename";

interface SavedQueryDialogProps {
  open: boolean;
  mode: SavedQueryDialogMode;
  initialName: string;
  connection: Connection | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { name: string }) => Promise<void> | void;
}

function getDialogCopy(mode: SavedQueryDialogMode): {
  title: string;
  description: string;
  submitLabel: string;
} {
  switch (mode) {
    case "save-as":
      return {
        title: "Save Query As",
        description: "Create a new saved query without overwriting the current linked record.",
        submitLabel: "Save As",
      };
    case "rename":
      return {
        title: "Rename Saved Query",
        description: "Update the saved query name and keep linked tabs in sync.",
        submitLabel: "Rename",
      };
    case "create":
    default:
      return {
        title: "Save Query",
        description: "Store this SQL as reusable app metadata without executing it.",
        submitLabel: "Save",
      };
  }
}

export default function SavedQueryDialog({
  open,
  mode,
  initialName,
  connection,
  onOpenChange,
  onSubmit,
}: SavedQueryDialogProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    setName(initialName);
    setError("");
    setSubmitting(false);
  }, [initialName, open, mode]);

  const copy = useMemo(() => getDialogCopy(mode), [mode]);
  const showConnectionField = mode !== "rename";

  const handleSubmit = useCallback(async () => {
    try {
      setSubmitting(true);
      setError("");
      await onSubmit({ name });
      onOpenChange(false);
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Unable to save query");
    } finally {
      setSubmitting(false);
    }
  }, [name, onOpenChange, onSubmit]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[460px] bg-card border-border shadow-2xl shadow-black/20 p-0 overflow-hidden">
        <div className="border-b border-border/60 bg-secondary/20 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-lg font-bold tracking-tight">
              <span className="flex h-9 w-9 items-center justify-center rounded-sm border border-primary/30 bg-primary/10 text-primary">
                <Save size={16} />
              </span>
              {copy.title}
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-muted-foreground">
              {copy.description}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="saved-query-name" className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Name
              </Label>
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground/70">
                {name.trim().length}/{MAX_SAVED_QUERY_NAME_LENGTH}
              </span>
            </div>
            <Input
              id="saved-query-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="weekly revenue audit"
              maxLength={MAX_SAVED_QUERY_NAME_LENGTH}
              className="h-9 border-border/35 bg-background text-sm font-medium placeholder:text-muted-foreground/40 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
              autoFocus
            />
          </div>

          {showConnectionField && (
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Connection
              </Label>
              <div className="flex h-9 items-center rounded-sm border border-border/35 bg-background px-3 text-sm text-foreground">
                {connection?.name ?? "No connection"}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border/60 bg-secondary/20 px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
            {copy.submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
