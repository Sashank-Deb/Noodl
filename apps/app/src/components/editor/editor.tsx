"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronRight,
  Download,
  ListTree,
  Network,
  PanelLeft,
  Redo2,
  RotateCcw,
  Sparkles,
  Undo2,
  Wand2,
  Image as ImageIcon,
  Link2,
  Table2,
  Type,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useEditor } from "@/store/editor-store";
import { useSettings } from "@/context/settings";
import { saveNote, saveImageAsset } from "@/lib/db";
import { schedulePush } from "@/lib/sync";
import { ancestorsText, flattenVisible, newId, toOutline } from "@/lib/tree";
import { download, fromIndentedText, safeFilename, toHTML, toJSON, toMarkdown, toPlainText } from "@/lib/io";
import { aiAvailable, expandNode, rewriteNode, type RewriteMode } from "@/lib/ai/ai";
import type { MapStyle } from "@/lib/types";
import { MindMapView, type Viewport } from "./mindmap-view";
import { OutlineView } from "./outline-view";
import type { NodeAction } from "./node-input";
import { SyncChip } from "./sync-chip";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
export const MOD = isMac ? "⌘" : "Ctrl";

interface EditorProps {
  folderName: string | null;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenGenerate: () => void;
  onImport: () => void;
}

export function Editor({ folderName, sidebarOpen, onToggleSidebar, onOpenGenerate, onImport }: EditorProps) {
  const note = useEditor((s) => s.note);
  const view = useEditor((s) => s.view);
  const revision = useEditor((s) => s.revision);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const { settings } = useSettings();
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, k: 1 });
  const contentRef = useRef<HTMLDivElement>(null);
  const [aiBusy, setAiBusy] = useState(false);

  // ---- Autosave (debounced) → IndexedDB → optional cloud push ------------
  useEffect(() => {
    if (!revision) return;
    const n = useEditor.getState().note;
    if (!n) return;
    const t = setTimeout(() => {
      void saveNote(n).then(() => schedulePush());
    }, 400);
    return () => clearTimeout(t);
  }, [revision]);

  // Flush on tab hide / unload.
  useEffect(() => {
    const flush = () => {
      const n = useEditor.getState().note;
      if (n) void saveNote(n);
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, []);

  // ---- Node input actions (edit mode) --------------------------------------
  const onAction = useCallback((id: string, a: NodeAction) => {
    const st = useEditor.getState();
    const n = st.note;
    if (!n) return;
    const isRoot = id === n.rootId;
    const order = flattenVisible(n).map((r) => r.id);
    const idx = order.indexOf(id);
    switch (a) {
      case "child":
        if (st.view === "outline" && !isRoot) {
          const sibs = n.nodes[n.nodes[id].parentId!].children;
          if (sibs.indexOf(id) > 0) st.indent(id);
        } else st.addChild(id);
        return;
      case "sibling":
        if (isRoot) {
          // Enter on the title starts the first branch.
          let cid: string | null = null;
          st.apply((d) => {
            const c = { id: newId(), parentId: d.rootId, children: [], text: "", type: "text" as const };
            d.nodes[c.id] = c;
            d.nodes[d.rootId].children.unshift(c.id);
            d.nodes[d.rootId].collapsed = false;
            cid = c.id;
          });
          if (cid) st.edit(cid);
          return;
        }
        // Enter on an empty outline row outdents it (outliner convention).
        if (st.view === "outline" && !n.nodes[id].text.trim() && n.nodes[n.nodes[id].parentId!].parentId) {
          st.outdent(id);
          return;
        }
        st.addSibling(id);
        return;
      case "exit":
        st.edit(null);
        st.select(id);
        return;
      case "up":
        if (idx > 0) st.edit(order[idx - 1]);
        return;
      case "down":
        if (idx < order.length - 1) st.edit(order[idx + 1]);
        return;
      case "outdent":
        st.outdent(id);
        return;
      case "deleteEmpty":
        if (isRoot) return;
        st.remove(id);
        st.edit(order[idx - 1] ?? n.rootId);
        return;
    }
  }, []);

  // ---- Clipboard (subtree as indented text) -------------------------------
  const copySubtree = useCallback((cut: boolean) => {
    const st = useEditor.getState();
    const n = st.note;
    const id = st.selectedId;
    if (!n || !id) return;
    const lines: string[] = [];
    const walk = (nid: string, d: number) => {
      lines.push(`${"  ".repeat(d)}- ${n.nodes[nid].text}`);
      n.nodes[nid].children.forEach((c) => walk(c, d + 1));
    };
    walk(id, 0);
    void navigator.clipboard?.writeText(lines.join("\n"));
    toast(cut ? "Cut node" : `Copied ${lines.length} node${lines.length > 1 ? "s" : ""}`);
    if (cut && id !== n.rootId) st.remove(id);
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const st = useEditor.getState();
      if (!st.note || st.editingId || isTyping(e.target)) return;
      const target = st.selectedId ?? st.note.rootId;
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) {
        e.preventDefault();
        void addImage(target, file);
        return;
      }
      const text = e.clipboardData?.getData("text/plain");
      if (!text?.trim()) return;
      e.preventDefault();
      const items = fromIndentedText(text);
      st.replaceSubtree(target, items);
      toast(`Pasted ${countItems(items)} nodes`);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  // ---- Select-mode keyboard -------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useEditor.getState();
      const n = st.note;
      if (!n) return;
      const mod = e.metaKey || e.ctrlKey;
      const typing = isTyping(e.target);

      // Undo/redo work in both modes (the text is controlled by our history).
      if (mod && e.key.toLowerCase() === "z") {
        if (typing && !st.editingId) return;
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        st.redo();
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        st.setView(st.view === "map" ? "outline" : "map");
        return;
      }
      if (typing || st.editingId) return;

      const sel = st.selectedId;
      const order = flattenVisible(n).map((r) => r.id);
      const node = sel ? n.nodes[sel] : null;

      if (e.altKey && /^Digit[0-3]$/.test(e.code)) {
        e.preventDefault();
        const lvl = Number(e.code.slice(5));
        st.expandToLevel(lvl === 0 ? Infinity : lvl);
        return;
      }
      if (e.shiftKey && e.code === "Digit1") {
        e.preventDefault();
        st.requestFit();
        return;
      }
      if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        setViewport((v) => ({ ...v, k: Math.min(2.5, v.k * 1.1) }));
        return;
      }
      if (mod && e.key === "-") {
        e.preventDefault();
        setViewport((v) => ({ ...v, k: Math.max(0.2, v.k / 1.1) }));
        return;
      }
      if (mod && e.key === "0") {
        e.preventDefault();
        st.requestFit();
        return;
      }
      if (!sel || !node) {
        if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Tab", "Enter", " "].includes(e.key)) {
          e.preventDefault();
          st.select(n.rootId);
        }
        return;
      }
      if (mod && e.key.toLowerCase() === "c") return copySubtree(false);
      if (mod && e.key.toLowerCase() === "x") {
        e.preventDefault();
        return copySubtree(true);
      }
      if (mod && e.key.toLowerCase() === "d" && node.parentId) {
        e.preventDefault();
        const items = [toOutline(n, sel)];
        st.replaceSubtree(node.parentId, items);
        return;
      }
      if (mod && e.key === ";") {
        e.preventDefault();
        st.toggleCollapse(sel);
        return;
      }
      if (mod && e.key === "]") {
        e.preventDefault();
        st.indent(sel);
        return;
      }
      if (mod && e.key === "[") {
        e.preventDefault();
        st.outdent(sel);
        return;
      }
      switch (e.key) {
        case "Tab":
          e.preventDefault();
          if (e.shiftKey) st.outdent(sel);
          else st.addChild(sel);
          return;
        case "Enter":
          e.preventDefault();
          if (e.shiftKey && node.parentId) {
            const parent = n.nodes[node.parentId];
            let cid: string | null = null;
            st.apply((d) => {
              const c = { id: newId(), parentId: parent.id, children: [], text: "", type: "text" as const };
              d.nodes[c.id] = c;
              d.nodes[parent.id].children.splice(parent.children.indexOf(sel), 0, c.id);
              cid = c.id;
            });
            if (cid) st.edit(cid);
          } else st.addSibling(sel);
          return;
        case " ":
        case "F2":
          e.preventDefault();
          st.edit(sel);
          return;
        case "Delete":
        case "Backspace":
          if (!node.parentId) return;
          e.preventDefault();
          st.remove(sel);
          toast("Deleted node", { action: { label: "Undo", onClick: () => useEditor.getState().undo() } });
          return;
        case "Escape":
          st.select(null);
          return;
        case "ArrowUp":
        case "ArrowDown": {
          e.preventDefault();
          if (e.altKey) return st.moveUpDown(sel, e.key === "ArrowUp" ? -1 : 1);
          if (st.view === "map" && node.parentId) {
            const sibs = n.nodes[node.parentId].children;
            const j = sibs.indexOf(sel) + (e.key === "ArrowUp" ? -1 : 1);
            if (j >= 0 && j < sibs.length) return st.select(sibs[j]);
          }
          const i = order.indexOf(sel) + (e.key === "ArrowUp" ? -1 : 1);
          if (i >= 0 && i < order.length) st.select(order[i]);
          return;
        }
        case "ArrowLeft":
          e.preventDefault();
          if (st.view === "outline" && node.children.length && !node.collapsed) return st.toggleCollapse(sel, true);
          if (node.parentId) st.select(node.parentId);
          return;
        case "ArrowRight":
          e.preventDefault();
          if (node.children.length) {
            if (node.collapsed) return st.toggleCollapse(sel, false);
            st.select(node.children[0]);
          }
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [copySubtree]);

  // ---- AI node actions -------------------------------------------------------
  const runRewrite = async (mode: RewriteMode) => {
    const st = useEditor.getState();
    const n = st.note;
    const id = st.selectedId;
    if (!n || !id || !n.nodes[id].text.trim()) return toast("Select a node with text first");
    setAiBusy(true);
    try {
      const text = await rewriteNode(n.nodes[id].text, mode, ancestorsText(n, id));
      if (!text) throw new Error("Empty response");
      const before = n.nodes[id].text;
      st.setText(id, text);
      useEditor.setState({ lastCoalesce: null });
      toast("Rewrote node", { description: `“${truncate(before)}” → “${truncate(text)}”`, action: { label: "Undo", onClick: () => useEditor.getState().undo() } });
    } catch (e) {
      toast.error(aiErrorMessage(e));
    } finally {
      setAiBusy(false);
    }
  };

  const runExpand = async () => {
    const st = useEditor.getState();
    const n = st.note;
    const id = st.selectedId ?? n?.rootId;
    if (!n || !id) return;
    setAiBusy(true);
    try {
      const items = await expandNode(ancestorsText(n, id), n.nodes[id].text, n.nodes[id].children.map((c) => n.nodes[c].text));
      if (!items.length) throw new Error("No ideas came back. Try again.");
      st.replaceSubtree(id, items);
      toast(`Added ${countItems(items)} ideas`, { action: { label: "Undo", onClick: () => useEditor.getState().undo() } });
    } catch (e) {
      toast.error(aiErrorMessage(e));
    } finally {
      setAiBusy(false);
    }
  };

  // ---- Node type / media -------------------------------------------------------
  const turnInto = (type: "text" | "link" | "table" | "image") => {
    const st = useEditor.getState();
    const id = st.selectedId;
    const n = st.note;
    if (!id || !n) return;
    if (type === "image") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = () => input.files?.[0] && void addImage(id, input.files[0]);
      input.click();
      return;
    }
    if (type === "link") {
      const url = window.prompt("Link URL", n.nodes[id].url ?? "https://");
      if (!url) return;
      const safe = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      st.updateNode(id, { type: "link", url: safe });
      return;
    }
    if (type === "table") {
      st.updateNode(id, { type: "table", table: n.nodes[id].table ?? [["Column 1", "Column 2"], ["", ""], ["", ""]] });
      st.edit(id);
      return;
    }
    st.updateNode(id, { type: "text", url: undefined, table: undefined });
  };

  // ---- Export ----------------------------------------------------------------
  const exportAs = async (kind: "png" | "jpeg" | "pdf" | "md" | "html" | "json" | "txt") => {
    const n = useEditor.getState().note;
    if (!n) return;
    const name = safeFilename(n.title);
    try {
      if (kind === "md") download(`${name}.md`, toMarkdown(n), "text/markdown");
      else if (kind === "html") download(`${name}.html`, toHTML(n), "text/html");
      else if (kind === "json") download(`${name}.mindnote.json`, toJSON(n), "application/json");
      else if (kind === "txt") download(`${name}.txt`, toPlainText(n));
      else {
        if (useEditor.getState().view !== "map") {
          useEditor.getState().setView("map");
          await new Promise((r) => setTimeout(r, 120));
        }
        // Clean picture: no selection ring or open editor.
        useEditor.getState().edit(null);
        useEditor.getState().select(null);
        await new Promise((r) => setTimeout(r, 220)); // let selection transitions finish
        const el = contentRef.current;
        if (!el) throw new Error("Map not ready");
        const mod = await import("@/lib/export-image");
        if (kind === "pdf") await mod.exportPDF(el, n);
        else await mod.exportImage(el, n, kind);
      }
      toast(`Exported ${name}.${kind === "jpeg" ? "jpg" : kind === "json" ? "mindnote.json" : kind}`);
    } catch (e) {
      console.error(e);
      toast.error("Export failed. Try again.");
    }
  };

  if (!note) return null;
  const ai = settings.aiEnabled && aiAvailable();

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* Top bar: breadcrumb | view toggle | sync + export */}
      <header className="grid h-[52px] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b bg-background px-2 sm:px-3">
        <div className="flex min-w-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={onToggleSidebar} aria-label={sidebarOpen ? "Hide library" : "Show library"}>
                <PanelLeft className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Library <kbd className="kbd ml-1">{MOD}\</kbd>
            </TooltipContent>
          </Tooltip>
          <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm md:flex">
            {folderName && (
              <>
                <span className="truncate text-muted-foreground">{folderName}</span>
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
              </>
            )}
            <span className="truncate font-semibold" aria-current="page">
              {note.title}
            </span>
          </nav>
        </div>

        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && useEditor.getState().setView(v as "map" | "outline")}
          className="rounded-[11px] bg-muted p-[3px] shadow-[inset_0_0_0_1px_var(--border)]"
          aria-label="View"
        >
          <ToggleGroupItem value="outline" className="h-[30px] gap-1.5 rounded-lg px-3 text-[13.5px] font-medium text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm" aria-label="Outline view">
            <ListTree className="size-4" />
            <span className="hidden sm:inline">Outline</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="map" className="h-[30px] gap-1.5 rounded-lg px-3 text-[13.5px] font-medium text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm" aria-label="Mind map view">
            <Network className="size-4 -rotate-90" />
            <span className="hidden sm:inline">Mind map</span>
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="flex items-center justify-end gap-0.5">
          <SyncChip />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="hidden size-8 sm:inline-flex" disabled={!canUndo} onClick={() => useEditor.getState().undo()} aria-label="Undo">
                <Undo2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Undo <kbd className="kbd ml-1">{MOD}Z</kbd>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="hidden size-8 sm:inline-flex" disabled={!canRedo} onClick={() => useEditor.getState().redo()} aria-label="Redo">
                <Redo2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Redo <kbd className="kbd ml-1">⇧{MOD}Z</kbd>
            </TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5" aria-label="Export">
                <Download className="size-4" />
                <span className="hidden lg:inline">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Image</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => exportAs("png")}>PNG</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportAs("jpeg")}>JPEG</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Document</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => exportAs("pdf")}>PDF</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportAs("md")}>Markdown</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportAs("html")}>HTML</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportAs("txt")}>Plain text</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Data</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => exportAs("json")}>JSON (lossless)</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onImport}>Import…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className={cn("relative flex min-h-0 flex-1 flex-col", view === "outline" && "items-stretch")}>
        {view === "map" ? (
          <MindMapView onAction={onAction} viewport={viewport} setViewport={setViewport} contentRef={contentRef} />
        ) : (
          <div className="order-2 min-h-0 flex-1">
            <OutlineView onAction={onAction} />
          </div>
        )}

        {/* Toolbar: floats over the canvas in map view, sits in flow above the outline. */}
        <div
          data-map-ui
          className={cn(
            "float-bar z-10 flex max-w-[calc(100%-24px)] items-center gap-1 overflow-x-auto p-1",
            view === "map" ? "absolute top-3 left-1/2 -translate-x-1/2" : "order-1 mx-auto mt-3 w-fit shrink-0",
          )}
        >
          <LevelToggle />
          {view === "map" && (
            <>
              <Sep />
              <StylePicker />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-[30px] gap-1.5 px-2.5 text-[13px]" onClick={() => useEditor.getState().requestFit()}>
                    <RotateCcw className="size-3.5" />
                    <span className="hidden md:inline">Restore view</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Fit the map <kbd className="kbd ml-1">⇧1</kbd>
                </TooltipContent>
              </Tooltip>
            </>
          )}
          <Sep />
          <NodeTypeMenu onPick={turnInto} />
          {ai && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-[30px] gap-1.5 px-2.5 text-[13px] text-(--ai-strong)" disabled={aiBusy} aria-label="AI actions">
                  {aiBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-(--ai)" />}
                  <span className="hidden md:inline">AI</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem onSelect={runExpand}>
                  <Wand2 /> Expand selected into ideas
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Sparkles /> Rewrite node
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onSelect={() => runRewrite("shorter")}>Make shorter</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => runRewrite("expand")}>Make more specific</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => runRewrite("grammar")}>Fix spelling and grammar</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => runRewrite("clearer")}>Make it clearer</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onOpenGenerate}>
                  <Sparkles /> Generate a new map…
                  <DropdownMenuShortcut>⇧{MOD}G</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}

function Sep() {
  return <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-border" />;
}

function LevelToggle() {
  const [level, setLevel] = useState("all");
  return (
    <ToggleGroup
      type="single"
      value={level}
      onValueChange={(v) => {
        if (!v) return;
        setLevel(v);
        useEditor.getState().expandToLevel(v === "all" ? Infinity : Number(v));
      }}
      aria-label="Expand to level"
      className="gap-0.5"
    >
      {[
        ["all", "All"],
        ["1", "L1"],
        ["2", "L2"],
        ["3", "L3"],
      ].map(([v, l]) => (
        <ToggleGroupItem
          key={v}
          value={v}
          className="h-[30px] min-w-[34px] rounded-lg px-2 text-[13px] font-medium text-muted-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
          aria-label={v === "all" ? "Expand all" : `Expand to level ${v}`}
        >
          {l}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

const STYLES: { value: MapStyle; label: string }[] = [
  { value: "curved", label: "Ballpoint" },
  { value: "elbow", label: "Elbow" },
  { value: "boxed", label: "Index card" },
];

function StylePicker() {
  const style = useEditor((s) => s.note?.mapStyle ?? "curved");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-[30px] gap-2 px-2.5 text-[13px]" aria-label="Map style">
          <span className="flex" aria-hidden>
            {[1, 2, 3].map((i) => (
              <i key={i} className="-ml-[3px] block size-2.5 rounded-full shadow-[0_0_0_1.5px_var(--card)] first:ml-0" style={{ background: `var(--branch-${i})` }} />
            ))}
          </span>
          <span className="hidden md:inline">{STYLES.find((s) => s.value === style)?.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        <DropdownMenuRadioGroup value={style} onValueChange={(v) => useEditor.getState().setMapStyle(v as MapStyle)}>
          {STYLES.map((s) => (
            <DropdownMenuRadioItem key={s.value} value={s.value}>
              {s.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NodeTypeMenu({ onPick }: { onPick: (t: "text" | "link" | "table" | "image") => void }) {
  const hasSel = useEditor((s) => !!s.selectedId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-[30px] gap-1.5 px-2.5 text-[13px]" disabled={!hasSel} aria-label="Node type">
          <Type className="size-3.5" />
          <span className="hidden lg:inline">Turn into</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        <DropdownMenuItem onSelect={() => onPick("text")}>
          <Type /> Text
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onPick("link")}>
          <Link2 /> Link
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onPick("image")}>
          <ImageIcon /> Add image (child)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onPick("table")}>
          <Table2 /> Table
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---- helpers -------------------------------------------------------------------
async function addImage(parentId: string, file: File) {
  const st = useEditor.getState();
  const n = st.note;
  if (!n) return;
  const assetId = newId();
  try {
    await saveImageAsset(n.id, file, assetId);
    let cid: string | null = null;
    st.apply((d) => {
      const c = { id: newId(), parentId, children: [], text: file.name.replace(/\.[a-z0-9]+$/i, ""), type: "image" as const, assetId };
      d.nodes[c.id] = c;
      d.nodes[parentId].children.push(c.id);
      d.nodes[parentId].collapsed = false;
      cid = c.id;
    });
    if (cid) st.select(cid);
  } catch {
    toast.error("Couldn't read that image");
  }
}

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable || el.tagName === "SELECT");
}
function countItems(items: { children?: unknown[] }[]): number {
  return items.reduce((s, i) => s + 1 + countItems((i.children as { children?: unknown[] }[]) ?? []), 0);
}
const truncate = (s: string, n = 32) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
export function aiErrorMessage(e: unknown) {
  const m = String((e as Error)?.message ?? e);
  if (/rate|429|quota/i.test(m)) return "AI is busy (free quota). Try again in a minute.";
  if (/network|fetch|offline/i.test(m)) return "You're offline. AI needs a connection.";
  if (/app.?check/i.test(m)) return "AI request was blocked by App Check. Reload and try again.";
  return "Gemini didn't respond. Try again.";
}
