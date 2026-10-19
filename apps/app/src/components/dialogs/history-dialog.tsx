"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { listSnapshots, saveNote, takeSnapshot, type Snapshot } from "@/lib/db";
import { schedulePush } from "@/lib/sync";
import { cloneNote, toOutline, type OutlineItem } from "@/lib/tree";
import { useEditor } from "@/store/editor-store";
import type { Note } from "@/lib/types";

const fmt = (t: number) =>
  new Date(t).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function HistoryDialog({ open, onOpenChange, onOpenNote }: { open: boolean; onOpenChange: (o: boolean) => void; onOpenNote: (id: string) => void }) {
  const note = useEditor((s) => s.note);
  const [snaps, setSnaps] = useState<Snapshot[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !note) return;
    let alive = true;
    void listSnapshots(note.id).then((l) => {
      if (!alive) return;
      setSnaps(l);
      setSel(l[0]?.id ?? null);
    });
    return () => {
      alive = false;
    };
    // Only reload the list when the dialog opens or the note changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, note?.id]);

  const snap = snaps?.find((s) => s.id === sel) ?? null;
  const asNote = (s: Snapshot): Note => ({ ...note!, title: s.title, rootId: s.rootId, nodes: s.nodes });

  const restore = async () => {
    if (!snap || !note) return;
    await takeSnapshot(note, "Before restoring a version");
    useEditor.getState().apply((d) => {
      d.rootId = snap.rootId;
      d.nodes = snap.nodes as typeof d.nodes;
    });
    useEditor.getState().requestFit();
    onOpenChange(false);
    toast(`Restored the version from ${fmt(snap.at)}`, { action: { label: "Undo", onClick: () => useEditor.getState().undo() } });
  };

  const restoreCopy = async () => {
    if (!snap || !note) return;
    const copy = cloneNote(asNote(snap), `${snap.title} (${fmt(snap.at)})`);
    await saveNote(copy);
    schedulePush();
    onOpenChange(false);
    onOpenNote(copy.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4" /> Version history
          </DialogTitle>
          <DialogDescription>The last 20 versions of this note, saved on this device as you edit and before AI changes.</DialogDescription>
        </DialogHeader>
        {!snaps ? null : snaps.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No earlier versions yet. Versions are saved every few minutes while you edit.</p>
        ) : (
          <div className="grid max-h-[60vh] gap-3 sm:grid-cols-[220px_1fr]">
            <ul className="space-y-0.5 overflow-auto" role="listbox" aria-label="Versions">
              {snaps.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={s.id === sel}
                    onClick={() => setSel(s.id!)}
                    className={cn("w-full rounded-lg px-2.5 py-2 text-left hover:bg-accent", s.id === sel && "bg-accent text-accent-foreground")}
                  >
                    <span className="block text-sm font-medium">{fmt(s.at)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {s.reason} · {s.nodeCount} nodes
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex min-h-0 flex-col rounded-xl border">
              <div className="min-h-0 flex-1 overflow-auto p-4 text-sm">
                {snap && (
                  <>
                    <p className="mb-2 font-semibold">{snap.nodes[snap.rootId]?.text || "Untitled"}</p>
                    <Preview items={toOutline(asNote(snap)).children ?? []} />
                  </>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t p-2">
                <Button variant="ghost" size="sm" onClick={restoreCopy} disabled={!snap}>
                  Restore as copy
                </Button>
                <Button size="sm" onClick={restore} disabled={!snap}>
                  Restore this version
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Preview({ items }: { items: OutlineItem[] }) {
  return (
    <ul className="space-y-0.5 border-l pl-3">
      {items.map((it, i) => (
        <li key={i}>
          {it.text || <span className="text-muted-foreground">Untitled</span>}
          {it.children?.length ? <Preview items={it.children} /> : null}
        </li>
      ))}
    </ul>
  );
}
