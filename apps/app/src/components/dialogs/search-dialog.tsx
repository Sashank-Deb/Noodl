"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FileText, LayoutTemplate, Moon, Plus, Settings2, Sparkles, Upload } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { db } from "@/lib/db";
import { ancestorsText } from "@/lib/tree";

export interface SearchActions {
  open: (noteId: string, nodeId?: string) => void;
  newNote: () => void;
  generate: () => void;
  templates: () => void;
  importFile: () => void;
  settings: () => void;
  toggleTheme: () => void;
}

export function SearchDialog({ open, onOpenChange, actions }: { open: boolean; onOpenChange: (o: boolean) => void; actions: SearchActions }) {
  const notes = useLiveQuery(() => (open ? db().notes.filter((n) => !n.deletedAt).toArray() : []), [open]);
  const [q, setQ] = useState("");

  const nodeHits = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (query.length < 2 || !notes) return [];
    const out: { noteId: string; nodeId: string; text: string; path: string }[] = [];
    for (const n of notes) {
      for (const node of Object.values(n.nodes)) {
        if (node.id !== n.rootId && node.text.toLowerCase().includes(query)) {
          out.push({ noteId: n.id, nodeId: node.id, text: node.text, path: [...ancestorsText(n, node.id)].join(" › ") });
          if (out.length >= 30) return out;
        }
      }
    }
    return out;
  }, [q, notes]);

  const run = (fn: () => void) => {
    onOpenChange(false);
    setQ("");
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search" description="Search notes, nodes and actions">
      <CommandInput placeholder="Search notes and nodes…" value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>No notes match “{q}”.</CommandEmpty>
        <CommandGroup heading="Notes">
          {(notes ?? [])
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 50)
            .map((n) => (
              <CommandItem key={n.id} value={`note ${n.title} ${n.id}`} onSelect={() => run(() => actions.open(n.id))}>
                <FileText /> {n.title}
              </CommandItem>
            ))}
        </CommandGroup>
        {nodeHits.length > 0 && (
          <CommandGroup heading="Nodes">
            {nodeHits.map((h) => (
              <CommandItem key={h.nodeId} value={`node ${h.text} ${h.path} ${h.nodeId}`} onSelect={() => run(() => actions.open(h.noteId, h.nodeId))}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{h.text}</span>
                  <span className="truncate text-xs text-muted-foreground">{h.path}</span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Actions">
          <CommandItem value="action new note" onSelect={() => run(actions.newNote)}>
            <Plus /> New note
          </CommandItem>
          <CommandItem value="action generate map ai" onSelect={() => run(actions.generate)}>
            <Sparkles /> Generate a map with AI
          </CommandItem>
          <CommandItem value="action templates" onSelect={() => run(actions.templates)}>
            <LayoutTemplate /> New from template
          </CommandItem>
          <CommandItem value="action import file" onSelect={() => run(actions.importFile)}>
            <Upload /> Import Markdown or JSON
          </CommandItem>
          <CommandItem value="action toggle theme dark light" onSelect={() => run(actions.toggleTheme)}>
            <Moon /> Toggle theme
          </CommandItem>
          <CommandItem value="action settings" onSelect={() => run(actions.settings)}>
            <Settings2 /> Settings
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
