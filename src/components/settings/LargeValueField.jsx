import React, { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Pencil } from "lucide-react";

const DEFAULT_THRESHOLD_CHARS = 20000;
const DEFAULT_PREVIEW_CHARS = 800;

/**
 * Prevents rendering huge controlled inputs on first paint (can freeze preview).
 * For large values it shows a short read-only preview + an editor dialog.
 */
export function LargeValueField({
  id,
  value,
  onChange,
  placeholder,
  kind = "textarea", // 'textarea' | 'text'
  rows = 6,
  disabled = false,
  thresholdChars = DEFAULT_THRESHOLD_CHARS,
  previewChars = DEFAULT_PREVIEW_CHARS,
  title = "Edit value",
  description,
}) {
  const stringValue = value ?? "";
  const isLarge = stringValue.length > thresholdChars;

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const preview = useMemo(() => {
    if (!isLarge) return stringValue;
    return stringValue.slice(0, previewChars);
  }, [isLarge, previewChars, stringValue]);

  const openEditor = () => {
    setDraft(stringValue);
    setOpen(true);
  };

  const applyDraft = () => {
    onChange?.(draft);
    setOpen(false);
  };

  if (!isLarge) {
    return kind === "textarea" ? (
      <Textarea
        id={id}
        value={stringValue}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
      />
    ) : (
      <Input
        id={id}
        value={stringValue}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    );
  }

  return (
    <div className="space-y-2">
      {kind === "textarea" ? (
        <Textarea
          id={id}
          value={preview}
          readOnly
          rows={Math.min(rows, 6)}
          placeholder={placeholder}
          className="resize-none"
        />
      ) : (
        <Input id={id} value={preview} readOnly placeholder={placeholder} />
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Large value ({stringValue.length.toLocaleString()} chars). Open editor to view/edit full text.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={openEditor} disabled={disabled}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            <div className="pr-4">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={placeholder}
                className="min-h-[60vh] font-mono"
              />
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={applyDraft}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
