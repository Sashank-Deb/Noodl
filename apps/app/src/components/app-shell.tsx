"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Plus, Sparkles, Upload } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/library/sidebar";
import { Editor, MOD } from "@/components/editor/editor";
import dynamic from "next/dynamic";

// Dialogs are code-split: they load the first time they're opened.
const GenerateDialog = dynamic(() => import("@/components/dialogs/generate-dialog").then((m) => m.GenerateDialog), { ssr: false });
const TemplatesDialog = dynamic(() => import("@/components/dialogs/templates-dialog").then((m) => m.TemplatesDialog), { ssr: false });
const SettingsDialog = dynamic(() => import("@/components/dialogs/settings-dialog").then((m) => m.SettingsDialog), { ssr: false });
const SearchDialog = dynamic(() => import("@/components/dialogs/search-dialog").then((m) => m.SearchDialog), { ssr: false });
import { Mark } from "@/components/mark";
import { persistEditor, useEditor } from "@/store/editor-store";
import { useSettings } from "@/context/settings";
import { db, getNote, kvGet, kvSet, purgeRecycleBin, saveNote } from "@/lib/db";
import { schedulePush } from "@/lib/sync";
import { createNote, noteFromOutline, type OutlineItem } from "@/lib/tree";
import { TEMPLATES, WELCOME } from "@/lib/templates";
import { fromJSON, fromMarkdown } from "@/lib/io";
import { localIndex } from "@/lib/ai/local-suggest";
import { aiAvailable } from "@/lib/ai/ai";
import type { Note } from "@/lib/types";

function useIsDesktop() {
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desktop;
}

function setUrlNote(id: string | null) {
  const url = new URL(window.location.href);
  ["new", "generate", "template"].forEach((k) => url.searchParams.delete(k));
  if (id) url.searchParams.set("n", id);
  else url.searchParams.delete("n");
  window.history.replaceState(null, "", url.toString());
}

export function AppShell() {
  const { settings, ready } = useSettings();
  const { resolvedTheme, setTheme } = useTheme();
  const desktop = useIsDesktop();
  const [sidebarPinned, setSidebarPinned] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const note = useEditor((s) => s.note);
  const activeId = note?.id ?? null;
  const folderName = useLiveQuery(async () => (note?.folderId ? (await db().folders.get(note.folderId))?.name ?? null : null), [note?.folderId]);

  const open = useCallback(
    async (id: string, nodeId?: string) => {
      await persistEditor();
      const n = await getNote(id);
      if (!n || n.deletedAt) {
        toast.error("That note isn't available.");
        return;
      }
      useEditor.getState().load(n, settings.defaultView);
      if (nodeId && n.nodes[nodeId]) {
        // Expand ancestors so the node is visible, then select it.
        useEditor.getState().apply((d) => {
          let p = d.nodes[nodeId].parentId;
          while (p) {
            d.nodes[p].collapsed = false;
            p = d.nodes[p].parentId;
          }
        });
        useEditor.getState().select(nodeId);
      }
      setUrlNote(id);
      setSheetOpen(false);
    },
    [settings.defaultView],
  );

  const createAndOpen = useCallback(
    async (n: Note, editRoot = false) => {
      await saveNote(n);
      schedulePush();
      await open(n.id);
      if (editRoot) useEditor.getState().edit(n.rootId);
      else useEditor.getState().requestFit();
    },
    [open],
  );

  const newNote = useCallback(
    (folderId: string | null = null) => {
      const n = createNote("", { folderId, mapStyle: settings.defaultMapStyle });
      void createAndOpen(n, true);
    },
    [createAndOpen, settings.defaultMapStyle],
  );

  const fromOutline = useCallback(
    (o: OutlineItem) => {
      void createAndOpen(noteFromOutline(o, { mapStyle: settings.defaultMapStyle, folderId: useEditor.getState().note?.folderId ?? null }));
      setGenOpen(false);
      setTplOpen(false);
    },
    [createAndOpen, settings.defaultMapStyle],
  );

  const importFiles = useCallback(
    async (files: FileList | File[]) => {
      for (const f of [...files]) {
        try {
          const text = await f.text();
          const n = /\.json$/i.test(f.name) ? fromJSON(text) : fromMarkdown(text, f.name.replace(/\.[^.]+$/, ""));
          n.mapStyle = settings.defaultMapStyle;
          await createAndOpen(n);
          toast(`Imported ${n.title}`);
        } catch {
          toast.error(`${f.name} isn't a MindNote JSON or Markdown outline.`);
        }
      }
    },
    [createAndOpen, settings.defaultMapStyle],
  );

  // ---- Boot: seed first note, honour deep links, purge old trash -------------
  const booted = useRef(false);
  useEffect(() => {
    if (!ready || booted.current) return;
    booted.current = true;
    void (async () => {
      void purgeRecycleBin();
      const params = new URLSearchParams(window.location.search);
      if (!(await kvGet<boolean>("seeded"))) {
        await kvSet("seeded", true);
        if ((await db().notes.count()) === 0) await saveNote(noteFromOutline(WELCOME));
      }
      const tpl = params.get("template");
      if (params.get("new")) return newNote();
      if (params.get("generate")) {
        setGenOpen(true);
      }
      if (tpl) {
        const t = TEMPLATES.find((x) => x.id === tpl);
        if (t) return fromOutline(t.outline);
      }
      const want = params.get("n") ?? (await kvGet<string>("lastOpen"));
      const n = want ? await getNote(want) : undefined;
      if (n && !n.deletedAt) return open(n.id);
      const latest = (await db().notes.orderBy("updatedAt").reverse().filter((x) => !x.deletedAt).first()) ?? null;
      if (latest) void open(latest.id);
    })();
  }, [ready, newNote, fromOutline, open]);

  useEffect(() => {
    if (activeId) void kvSet("lastOpen", activeId);
  }, [activeId]);

  // Offline support: cache the app shell (production only).
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/app/sw.js", { scope: "/app/" }).catch(() => {});
    }
  }, []);

  // Follow the stored copy of the open note: close it if it was moved to the
  // Recycle Bin, and swap in newer versions that arrive via sync.
  const stored = useLiveQuery(() => (activeId ? db().notes.get(activeId) : undefined), [activeId]);
  useEffect(() => {
    if (!stored) return;
    const st = useEditor.getState();
    if (st.note?.id !== stored.id) return;
    if (stored.deletedAt) {
      st.load(null);
      setUrlNote(null);
      return;
    }
    const clean = st.revision === st.savedRevision;
    if (clean && stored.updatedAt > st.note.updatedAt) st.reload(stored);
  }, [stored]);

  // Local typeahead index over all notes (rebuilt lazily).
  const allNotes = useLiveQuery(() => db().notes.toArray(), []);
  useEffect(() => {
    if (!allNotes) return;
    const t = setTimeout(() => {
      localIndex.clear();
      for (const n of allNotes) if (!n.deletedAt) for (const node of Object.values(n.nodes)) localIndex.add(node.text);
    }, 1500);
    return () => clearTimeout(t);
  }, [allNotes]);

  // ---- Global shortcuts ---------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      } else if (mod && e.key === "\\") {
        e.preventDefault();
        if (desktop) setSidebarPinned((p) => !p);
        else setSheetOpen((o) => !o);
      } else if (e.altKey && e.code === "KeyN") {
        e.preventDefault();
        newNote();
      } else if (mod && e.shiftKey && k === "g" && settings.aiEnabled && aiAvailable()) {
        e.preventDefault();
        setGenOpen(true);
      } else if (mod && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [desktop, newNote, settings.aiEnabled]);

  const toggleSidebar = () => (desktop ? setSidebarPinned((p) => !p) : setSheetOpen((o) => !o));

  const sidebar = (
    <Sidebar
      activeId={activeId}
      onOpen={(id) => void open(id)}
      onNew={(f) => newNote(f ?? null)}
      onGenerate={() => setGenOpen(true)}
      onTemplates={() => setTplOpen(true)}
      onSearch={() => setSearchOpen(true)}
      onSettings={() => setSettingsOpen(true)}
      onCollapse={toggleSidebar}
    />
  );

  return (
    <div
      className="flex h-dvh w-full overflow-hidden bg-background"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setDragOver(false);
        const docs = [...e.dataTransfer.files].filter((f) => /\.(md|markdown|txt|json)$/i.test(f.name));
        if (docs.length) void importFiles(docs);
      }}
    >
      <a href="#editor" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-background focus:px-3 focus:py-2">
        Skip to editor
      </a>
      {desktop && sidebarPinned && <div className="w-[272px] shrink-0 border-r border-sidebar-border xl:w-[288px]">{sidebar}</div>}
      {!desktop && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="left" className="w-[min(86vw,340px)] gap-0 p-0 [&>button]:hidden">
            <SheetTitle className="sr-only">Library</SheetTitle>
            {sidebar}
          </SheetContent>
        </Sheet>
      )}

      <main id="editor" className="flex min-w-0 flex-1 flex-col">
        {note ? (
          <Editor
            folderName={folderName ?? null}
            sidebarOpen={desktop ? sidebarPinned : sheetOpen}
            onToggleSidebar={toggleSidebar}
            onOpenGenerate={() => setGenOpen(true)}
            onImport={() => fileRef.current?.click()}
          />
        ) : (
          <EmptyState onNew={() => newNote()} onGenerate={() => setGenOpen(true)} onImport={() => fileRef.current?.click()} onMenu={toggleSidebar} />
        )}
      </main>

      <input
        ref={fileRef}
        type="file"
        accept=".md,.markdown,.txt,.json,text/markdown,application/json"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void importFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {genOpen && <GenerateDialog open={genOpen} onOpenChange={setGenOpen} onCreate={fromOutline} />}
      {tplOpen && <TemplatesDialog open={tplOpen} onOpenChange={setTplOpen} onPick={(t) => (t.id === "blank" ? (setTplOpen(false), newNote()) : fromOutline(t.outline))} />}
      {settingsOpen && <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />}
      {searchOpen && <SearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        actions={{
          open: (id, nodeId) => void open(id, nodeId),
          newNote: () => newNote(),
          generate: () => setGenOpen(true),
          templates: () => setTplOpen(true),
          importFile: () => fileRef.current?.click(),
          settings: () => setSettingsOpen(true),
          toggleTheme: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
        }}
      />}

      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-primary px-10 py-8 text-center">
            <Upload className="mx-auto mb-2 size-6 text-primary" />
            <p className="font-medium">Drop to import as a new note</p>
            <p className="text-sm text-muted-foreground">Markdown or MindNote JSON</p>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onNew, onGenerate, onImport, onMenu }: { onNew: () => void; onGenerate: () => void; onImport: () => void; onMenu: () => void }) {
  const { settings } = useSettings();
  return (
    <div className="map-canvas grid h-full place-items-center p-6" style={{ backgroundSize: "22px 22px" }}>
      <div className="max-w-sm text-center">
        <Mark size={44} className="mx-auto mb-4" />
        <h1 className="text-2xl font-bold tracking-tight">Start with one idea.</h1>
        <p className="mt-2 text-muted-foreground">Type a topic and press Tab to branch it. Everything stays on this device.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={onNew}>
            <Plus className="size-4" /> New note
          </Button>
          {settings.aiEnabled && aiAvailable() && (
            <Button variant="outline" onClick={onGenerate}>
              <Sparkles className="size-4 text-(--ai)" /> Generate with AI
            </Button>
          )}
          <Button variant="ghost" onClick={onImport}>
            <Upload className="size-4" /> Import
          </Button>
        </div>
        <button type="button" onClick={onMenu} className="mt-4 text-sm text-primary underline-offset-4 hover:underline lg:hidden">
          Open library
        </button>
        <p className="mt-6 text-xs text-muted-foreground">
          Tip: press <kbd className="kbd">{MOD}K</kbd> to search, <kbd className="kbd">⌥N</kbd> for a new note.
        </p>
      </div>
    </div>
  );
}
