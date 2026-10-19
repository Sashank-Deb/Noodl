"use client";

import { useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Ellipsis,
  FileText,
  Folder,
  FolderPlus,
  LayoutTemplate,
  PanelLeftClose,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { db, deleteFolder, hardDeleteNote, restoreNote, saveFolder, saveNote, softDeleteNote } from "@/lib/db";
import { recordHardDelete, deleteRemoteFolder, schedulePush } from "@/lib/sync";
import { cloneNote, countNodes, newId } from "@/lib/tree";
import { download, safeFilename, toJSON } from "@/lib/io";
import type { Folder as FolderT, Note } from "@/lib/types";
import { useEditor } from "@/store/editor-store";
import { aiAvailable } from "@/lib/ai/ai";
import { useSettings } from "@/context/settings";
import { Mark } from "@/components/mark";
import { AccountChip } from "./account-chip";
import { MOD } from "@/components/editor/editor";

export type Section = "all" | "recent" | "trash";

interface Props {
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: (folderId?: string | null) => void;
  onGenerate: () => void;
  onTemplates: () => void;
  onSearch: () => void;
  onSettings: () => void;
  onCollapse: () => void;
}

export function relativeTime(t: number) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 172800) return "yesterday";
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function Sidebar({ activeId, onOpen, onNew, onGenerate, onTemplates, onSearch, onSettings, onCollapse }: Props) {
  const notes = useLiveQuery(() => db().notes.toArray(), []);
  const folders = useLiveQuery(() => db().folders.orderBy("updatedAt").toArray(), []);
  const [section, setSection] = useState<Section>("all");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirmFolder, setConfirmFolder] = useState<FolderT | null>(null);
  const [dropFolder, setDropFolder] = useState<string | null>(null);
  const { settings } = useSettings();

  const live = useMemo(() => (notes ?? []).filter((n) => !n.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt), [notes]);
  const trash = useMemo(() => (notes ?? []).filter((n) => n.deletedAt).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)), [notes]);
  const folderName = (id: string | null) => folders?.find((f) => f.id === id)?.name;

  const list = section === "trash" ? trash : section === "recent" ? live.slice(0, 10) : live;

  const moveNote = async (n: Note, folderId: string | null) => {
    await moveNoteTo(n, folderId);
    toast(folderId ? `Moved to ${folderName(folderId)}` : "Moved out of folder");
  };

  const deleteNote = async (n: Note) => {
    await softDeleteNote(n.id);
    schedulePush();
    toast("Moved to Recycle Bin", {
      action: {
        label: "Undo",
        onClick: () => {
          void restoreNote(n.id).then(() => schedulePush());
        },
      },
    });
  };

  const duplicate = async (n: Note) => {
    const src = useEditor.getState().note?.id === n.id ? useEditor.getState().note! : n;
    const copy = cloneNote(src, `${src.title} (copy)`);
    await saveNote(copy);
    schedulePush();
    onOpen(copy.id);
  };

  const newFolder = async () => {
    const f: FolderT = { id: newId(), name: "New folder", createdAt: Date.now(), updatedAt: Date.now() };
    await saveFolder(f);
    setOpen((o) => ({ ...o, [f.id]: true }));
    setRenaming(f.id);
    schedulePush();
  };

  const noteRow = (n: Note, opts: { showFolder?: boolean; inTrash?: boolean } = {}) => (
    <li key={n.id}>
      <div
        draggable={!opts.inTrash}
        onDragStart={(e) => {
          e.dataTransfer.setData("application/x-mindnote-note", n.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        className={cn(
          "group relative flex items-start gap-1 rounded-lg py-1.5 pr-1 pl-2.5 hover:bg-sidebar-accent",
          activeId === n.id && "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_var(--sidebar-primary)]",
        )}
      >
        {renaming === n.id ? (
          <RenameInput initial={n.title} onDone={(v) => { setRenaming(null); if (v !== null) void renameNote(n, v); }} />
        ) : (
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => !opts.inTrash && onOpen(n.id)}
            onDoubleClick={() => !opts.inTrash && setRenaming(n.id)}
            aria-current={activeId === n.id ? "page" : undefined}
          >
            <span className="block truncate text-sm leading-tight font-medium">{n.title || "Untitled"}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {opts.inTrash
                ? `Deleted ${relativeTime(n.deletedAt!)}`
                : `${countNodes(n)} nodes, ${relativeTime(n.updatedAt)}${opts.showFolder && n.folderId ? ` · ${folderName(n.folderId) ?? ""}` : ""}`}
              {n.conflictOf && " · conflict copy"}
            </span>
          </button>
        )}
        {opts.inTrash ? (
          <div className="flex shrink-0 gap-0.5">
            <Button variant="ghost" size="icon" className="size-7" aria-label={`Restore ${n.title}`} onClick={() => void restoreNote(n.id).then(() => { schedulePush(); toast(`Restored ${n.title}`); })}>
              <Undo2 className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7 text-destructive" aria-label={`Delete ${n.title} forever`} onClick={() => void hardDeleteNote(n.id).then(() => recordHardDelete(n.id))}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 max-md:opacity-100" aria-label={`Actions for ${n.title}`}>
                <Ellipsis className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onSelect={() => setRenaming(n.id)}>Rename</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void duplicate(n)}>Duplicate</DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Move to…</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem disabled={!n.folderId} onSelect={() => void moveNote(n, null)}>No folder</DropdownMenuItem>
                  {(folders ?? []).map((f) => (
                    <DropdownMenuItem key={f.id} disabled={f.id === n.folderId} onSelect={() => void moveNote(n, f.id)}>
                      <Folder /> {f.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onSelect={() => download(`${safeFilename(n.title)}.mindnote.json`, toJSON(n), "application/json")}>Export JSON</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => void deleteNote(n)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </li>
  );

  const navRow = (key: Section | "templates", icon: React.ReactNode, label: string, count?: number, onClick?: () => void) => (
    <button
      type="button"
      onClick={onClick ?? (() => setSection(key as Section))}
      aria-pressed={section === key}
      className={cn(
        "flex h-[34px] w-full items-center gap-2.5 rounded-lg px-2 text-sm hover:bg-sidebar-accent",
        section === key && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
      )}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {count !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{count}</span>}
    </button>
  );

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground" aria-label="Library">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <Mark size={24} />
        <span className="flex-1 truncate text-[15px] font-semibold tracking-tight">MindNote Web</span>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={onSettings} aria-label="Settings">
          <Settings2 className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={onCollapse} aria-label="Hide library">
          <PanelLeftClose className="size-4" />
        </Button>
      </div>

      <div className="px-3">
        <button
          type="button"
          onClick={onSearch}
          className="flex h-9 w-full items-center gap-2 rounded-[10px] border border-input bg-background pr-2 pl-2.5 text-sm text-muted-foreground hover:border-ring/40"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Search notes</span>
          <kbd className="kbd">{MOD}K</kbd>
        </button>
        <div className={cn("mt-2.5 mb-3 grid gap-2", settings.aiEnabled && aiAvailable() ? "grid-cols-2" : "grid-cols-1")}>
          <Button onClick={() => onNew(null)} className="h-9 rounded-[10px]">
            <Plus className="size-4" /> New note
          </Button>
          {settings.aiEnabled && aiAvailable() && (
            <Button variant="outline" onClick={onGenerate} className="h-9 rounded-[10px] border-0 bg-(--ai-soft) text-(--ai-strong) shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--ai)_55%,transparent)] hover:bg-(--ai-soft) hover:brightness-[0.98]">
              <Sparkles className="size-4" /> Generate
            </Button>
          )}
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3" aria-label="Notes">
        {navRow("all", <FileText className="size-4" />, "All notes", live.length)}
        {navRow("recent", <Clock className="size-4" />, "Recent")}
        {navRow("templates", <LayoutTemplate className="size-4" />, "Templates", undefined, onTemplates)}

        <div className="mt-3.5 mb-1 flex items-center justify-between px-2 text-[12.5px] font-semibold text-muted-foreground">
          Folders
          <Button variant="ghost" size="icon" className="size-6" onClick={() => void newFolder()} aria-label="New folder">
            <FolderPlus className="size-3.5" />
          </Button>
        </div>
        {!folders ? null : folders.length === 0 ? (
          <p className="px-2 pb-1 text-xs text-muted-foreground">Group notes into folders. Drag a note onto a folder to move it.</p>
        ) : (
          <ul>
            {folders.map((f) => {
              const fnotes = live.filter((n) => n.folderId === f.id);
              const isOpen = !!open[f.id];
              return (
                <li key={f.id}>
                  <div
                    className={cn("group flex h-[34px] items-center gap-1 rounded-lg pr-1 pl-1 hover:bg-sidebar-accent", dropFolder === f.id && "bg-(--node-drop)")}
                    onDragOver={(e) => {
                      if (e.dataTransfer.types.includes("application/x-mindnote-note")) {
                        e.preventDefault();
                        setDropFolder(f.id);
                      }
                    }}
                    onDragLeave={() => setDropFolder(null)}
                    onDrop={(e) => {
                      setDropFolder(null);
                      const id = e.dataTransfer.getData("application/x-mindnote-note");
                      const n = live.find((x) => x.id === id);
                      if (n) void moveNote(n, f.id);
                    }}
                  >
                    <button type="button" className="grid size-6 place-items-center text-muted-foreground" onClick={() => setOpen((o) => ({ ...o, [f.id]: !isOpen }))} aria-label={isOpen ? `Collapse ${f.name}` : `Expand ${f.name}`} aria-expanded={isOpen}>
                      {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                    </button>
                    <Folder className="size-4 text-muted-foreground" aria-hidden />
                    {renaming === f.id ? (
                      <RenameInput
                        initial={f.name}
                        onDone={(v) => {
                          setRenaming(null);
                          if (v !== null) void saveFolder({ ...f, name: v.trim() || "Untitled folder", updatedAt: Date.now() }).then(() => schedulePush());
                        }}
                      />
                    ) : (
                      <button type="button" className="min-w-0 flex-1 truncate pl-1.5 text-left text-sm" onClick={() => setOpen((o) => ({ ...o, [f.id]: !isOpen }))} onDoubleClick={() => setRenaming(f.id)}>
                        {f.name}
                      </button>
                    )}
                    <span className="text-xs text-muted-foreground tabular-nums group-hover:hidden">{fnotes.length}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="hidden size-7 group-hover:inline-flex data-[state=open]:inline-flex max-md:inline-flex" aria-label={`Actions for folder ${f.name}`}>
                          <Ellipsis className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onSelect={() => onNew(f.id)}>New note here</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setRenaming(f.id)}>Rename</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setConfirmFolder(f)}>
                          Delete folder
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {isOpen && (
                    <ul className="mt-0.5 mb-1 ml-[22px] border-l border-sidebar-border pl-2">
                      {fnotes.length ? fnotes.map((n) => noteRow(n)) : <li className="px-2 py-1.5 text-xs text-muted-foreground">Nothing here yet. Drag notes onto the folder.</li>}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-3.5 mb-1 px-2 text-[12.5px] font-semibold text-muted-foreground" role="heading" aria-level={2}>
          {section === "trash" ? "Recycle Bin" : section === "recent" ? "Recent" : "All notes"}
        </div>
        {!notes ? (
          <div className="space-y-2 px-2 pt-1">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            {section === "trash" ? "Recycle Bin is empty. Deleted notes stay here for 30 days." : "No notes yet."}
          </p>
        ) : (
          <ul className="space-y-px">{list.map((n) => noteRow(n, { showFolder: true, inTrash: section === "trash" }))}</ul>
        )}

        <div className="mt-3">{navRow("trash", <Trash2 className="size-4" />, "Recycle Bin", trash.length)}</div>
      </nav>

      <div className="border-t border-sidebar-border px-2 py-2">
        <AccountChip />
      </div>

      <AlertDialog open={!!confirmFolder} onOpenChange={(o) => !o && setConfirmFolder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{confirmFolder?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The folder is removed. Its {live.filter((n) => n.folderId === confirmFolder?.id).length} notes move to All notes, nothing is deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmFolder) return;
                const id = confirmFolder.id;
                void deleteFolder(id).then(() => {
                  void deleteRemoteFolder(id);
                  schedulePush();
                });
                setConfirmFolder(null);
              }}
            >
              Delete folder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

async function renameNote(n: Note, title: string) {
  const t = title.trim() || "Untitled";
  const st = useEditor.getState();
  if (st.note?.id === n.id) st.setText(n.rootId, t);
  else {
    await saveNote({ ...n, title: t, updatedAt: Date.now(), nodes: { ...n.nodes, [n.rootId]: { ...n.nodes[n.rootId], text: t } } });
    schedulePush();
  }
}

async function moveNoteTo(n: Note, folderId: string | null) {
  const st = useEditor.getState();
  if (st.note?.id === n.id) {
    st.apply((d) => {
      d.folderId = folderId;
    });
  } else {
    await saveNote({ ...n, folderId, updatedAt: Date.now() });
    schedulePush();
  }
}

function RenameInput({ initial, onDone: done }: { initial: string; onDone: (v: string | null) => void }) {
  const [v, setV] = useState(initial);
  const finished = useRef(false);
  const onDone = (x: string | null) => {
    if (finished.current) return;
    finished.current = true;
    done(x);
  };
  return (
    <input
      autoFocus
      value={v}
      aria-label="Name"
      onChange={(e) => setV(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => onDone(v)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onDone(v);
        if (e.key === "Escape") onDone(null);
      }}
      className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    />
  );
}
