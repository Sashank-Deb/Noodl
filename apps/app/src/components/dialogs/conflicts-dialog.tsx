"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { db, saveNote, softDeleteNote, takeSnapshot } from "@/lib/db";
import { schedulePush } from "@/lib/sync";
import { toOutline, type OutlineItem } from "@/lib/tree";
import type { Note } from "@/lib/types";
import { persistEditor, useEditor } from "@/store/editor-store";
import { relativeTime } from "@/components/library/sidebar";

/** Flattened text lines, used to highlight what differs between versions. */
function lines(o: OutlineItem, depth = 0, out: { text: string; depth: number }[] = []) {
  out.push({ text: o.text, depth });
  o.children?.forEach((c) => lines(c, depth + 1, out));
  return out;
}

function Version({ title, note, other }: { title: string; note: Note; other: Note }) {
  const mine = lines(toOutline(note));
  const theirs = new Set(lines(toOutline(other)).map((l) => `${l.depth}:${l.text}`));
  return (
    <div className="flex min-h-0 flex-col rounded-xl border">
      <div className="border-b px-3 py-2">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">
          Edited {relativeTime(note.updatedAt)} · {Object.keys(note.nodes).length} nodes
        </p>
      </div>
      <ul className="min-h-0 flex-1 overflow-auto p-3 text-sm">
        {mine.map((l, i) => (
          <li
            key={i}
            style={{ paddingLeft: l.depth * 14 }}
            className={cn("rounded px-1", !theirs.has(`${l.depth}:${l.text}`) && "bg-(--ai-soft) text-(--ai-strong)")}
          >
            {l.text || <span className="text-muted-foreground">Untitled</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ConflictsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const pairs = useLiveQuery(async () => {
    const copies = await db().notes.filter((n) => !!n.conflictOf && !n.deletedAt).toArray();
    const out: { copy: Note; original: Note | undefined }[] = [];
    for (const c of copies) out.push({ copy: c, original: await db().notes.get(c.conflictOf!) });
    return out;
  }, [open]);
  const [idx, setIdx] = useState(0);
  const pair = useMemo(() => pairs?.[Math.min(idx, (pairs?.length ?? 1) - 1)], [pairs, idx]);

  const done = (msg: string) => {
    schedulePush();
    toast(msg);
    if ((pairs?.length ?? 0) <= 1) onOpenChange(false);
  };

  const keepOriginal = async () => {
    if (!pair) return;
    await softDeleteNote(pair.copy.id);
    done("Kept this device's version. The other one is in the Recycle Bin.");
  };

  const keepCopy = async () => {
    if (!pair?.original) return;
    const { copy, original } = pair;
    await takeSnapshot(original, "Before resolving a conflict");
    const st = useEditor.getState();
    if (st.note?.id === original.id) {
      st.apply((d) => {
        d.rootId = copy.rootId;
        d.nodes = copy.nodes as typeof d.nodes;
      });
      await persistEditor();
    } else {
      await saveNote({ ...original, rootId: copy.rootId, nodes: copy.nodes, title: original.title, updatedAt: Date.now() });
    }
    await softDeleteNote(copy.id);
    done("Kept the other version. The replaced one is in Version history.");
  };

  const keepBoth = async () => {
    if (!pair) return;
    await saveNote({ ...pair.copy, conflictOf: null, updatedAt: Date.now() });
    done("Kept both as separate notes.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-(--status-conflict)" /> Review changes made on two devices
          </DialogTitle>
          <DialogDescription>
            {pairs?.length
              ? `This note was edited on two devices before they synced. Lines only in one version are highlighted.${pairs.length > 1 ? ` ${idx + 1} of ${pairs.length}.` : ""}`
              : "Nothing to review. All your devices agree."}
          </DialogDescription>
        </DialogHeader>
        {pair && (
          <>
            <div className="grid max-h-[55vh] min-h-0 gap-3 sm:grid-cols-2">
              {pair.original ? <Version title="This version (kept in place)" note={pair.original} other={pair.copy} /> : <p className="text-sm text-muted-foreground">The original note no longer exists.</p>}
              <Version title="Other version" note={pair.copy} other={pair.original ?? pair.copy} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1">
                {pairs && pairs.length > 1 && (
                  <>
                    <Button variant="ghost" size="sm" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
                      Previous
                    </Button>
                    <Button variant="ghost" size="sm" disabled={idx >= pairs.length - 1} onClick={() => setIdx((i) => i + 1)}>
                      Next
                    </Button>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void keepBoth()}>
                  Keep both
                </Button>
                <Button variant="outline" onClick={() => void keepCopy()} disabled={!pair.original}>
                  Keep the other version
                </Button>
                <Button onClick={() => void keepOriginal()}>Keep this version</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
