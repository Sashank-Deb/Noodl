/**
 * Editor state lives in Zustand (not React Context) on purpose: a map can hold
 * hundreds of typeahead nodes, and each node subscribes only to its own slice
 * (`useEditor(s => s.note?.nodes[id])`), so typing in one node doesn't
 * re-render the rest. App-wide, rarely-changing state (auth, settings, theme)
 * stays in React Context — see src/context.
 */
import { create } from "zustand";
import { produce, type Draft } from "immer";
import type { MapStyle, Note, ViewMode } from "@/lib/types";
import * as T from "@/lib/tree";

const HISTORY_LIMIT = 200;
const COALESCE_MS = 800;

interface EditorState {
  note: Note | null;
  past: Note[];
  future: Note[];
  selectedId: string | null;
  editingId: string | null;
  view: ViewMode;
  /** Bumped on every content change; autosave listens to it. */
  revision: number;
  /** Increments to ask the map view to re-fit ("Restore view"). */
  fitRequest: number;
  lastCoalesce: { key: string; at: number } | null;

  load: (note: Note | null, view?: ViewMode) => void;
  apply: (recipe: (n: Draft<Note>) => void, coalesceKey?: string) => void;
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
  edit: (id: string | null) => void;
  setView: (v: ViewMode) => void;
  requestFit: () => void;

  setText: (id: string, text: string) => void;
  addChild: (parentId: string, text?: string) => string | null;
  addSibling: (id: string, text?: string) => string | null;
  remove: (id: string) => void;
  move: (id: string, parentId: string, index?: number) => void;
  indent: (id: string) => void;
  outdent: (id: string) => void;
  moveUpDown: (id: string, delta: -1 | 1) => void;
  toggleCollapse: (id: string, value?: boolean) => void;
  expandToLevel: (level: number) => void;
  setMapStyle: (s: MapStyle) => void;
  updateNode: (id: string, patch: Partial<Note["nodes"][string]>) => void;
  replaceSubtree: (id: string, items: T.OutlineItem[]) => void;
}

export const useEditor = create<EditorState>((set, get) => ({
  note: null,
  past: [],
  future: [],
  selectedId: null,
  editingId: null,
  view: "map",
  revision: 0,
  fitRequest: 0,
  lastCoalesce: null,

  load: (note, view) =>
    set((s) => ({
      note,
      past: [],
      future: [],
      selectedId: note?.rootId ?? null,
      editingId: null,
      view: view ?? s.view,
      lastCoalesce: null,
      fitRequest: s.fitRequest + 1,
    })),

  apply: (recipe, coalesceKey) => {
    const { note, past, lastCoalesce, revision } = get();
    if (!note) return;
    const next = produce(note, (d) => {
      recipe(d);
      d.title = d.nodes[d.rootId].text.trim() || "Untitled";
      d.updatedAt = Date.now();
    });
    if (next === note) return;
    const now = Date.now();
    const coalesce =
      !!coalesceKey && lastCoalesce?.key === coalesceKey && now - lastCoalesce.at < COALESCE_MS;
    set({
      note: next,
      past: coalesce ? past : [...past, note].slice(-HISTORY_LIMIT),
      future: [],
      revision: revision + 1,
      lastCoalesce: coalesceKey ? { key: coalesceKey, at: now } : null,
    });
  },

  undo: () => {
    const { past, note, future, revision, selectedId } = get();
    if (!past.length || !note) return;
    const prev = past[past.length - 1];
    set({
      note: prev,
      past: past.slice(0, -1),
      future: [note, ...future],
      revision: revision + 1,
      lastCoalesce: null,
      editingId: null,
      selectedId: selectedId && prev.nodes[selectedId] ? selectedId : prev.rootId,
    });
  },

  redo: () => {
    const { past, note, future, revision, selectedId } = get();
    if (!future.length || !note) return;
    const next = future[0];
    set({
      note: next,
      past: [...past, note],
      future: future.slice(1),
      revision: revision + 1,
      lastCoalesce: null,
      editingId: null,
      selectedId: selectedId && next.nodes[selectedId] ? selectedId : next.rootId,
    });
  },

  select: (id) => set({ selectedId: id }),
  edit: (id) => set(id ? { editingId: id, selectedId: id } : { editingId: null }),
  setView: (view) => set((s) => ({ view, editingId: null, fitRequest: s.fitRequest + 1 })),
  requestFit: () => set((s) => ({ fitRequest: s.fitRequest + 1 })),

  setText: (id, text) =>
    get().apply((n) => {
      if (n.nodes[id]) n.nodes[id].text = text;
    }, `text:${id}`),

  addChild: (parentId, text = "") => {
    let id: string | null = null;
    get().apply((n) => {
      id = T.addChild(n as Note, parentId, text);
    });
    if (id) set({ selectedId: id, editingId: id });
    return id;
  },

  addSibling: (sid, text = "") => {
    let id: string | null = null;
    get().apply((n) => {
      id = T.addSibling(n as Note, sid, text);
    });
    if (id) set({ selectedId: id, editingId: id });
    return id;
  },

  remove: (id) => {
    let next: string | null = null;
    get().apply((n) => {
      next = T.removeNode(n as Note, id);
    });
    if (next) set({ selectedId: next, editingId: null });
  },

  move: (id, parentId, index) => get().apply((n) => void T.moveNode(n as Note, id, parentId, index)),
  indent: (id) => get().apply((n) => void T.indent(n as Note, id)),
  outdent: (id) => get().apply((n) => void T.outdent(n as Note, id)),
  moveUpDown: (id, delta) => get().apply((n) => void T.moveUpDown(n as Note, id, delta)),

  toggleCollapse: (id, value) =>
    get().apply((n) => {
      const node = n.nodes[id];
      if (node && node.children.length) node.collapsed = value ?? !node.collapsed;
    }),

  expandToLevel: (level) => {
    get().apply((n) => T.expandToLevel(n as Note, level));
    get().requestFit();
  },

  setMapStyle: (s) =>
    get().apply((n) => {
      n.mapStyle = s;
    }),

  updateNode: (id, patch) =>
    get().apply((n) => {
      if (n.nodes[id]) Object.assign(n.nodes[id], patch);
    }),

  /** Appends generated children under `id` (AI "expand node", templates, paste). */
  replaceSubtree: (id, items) =>
    get().apply((n) => {
      const add = (parentId: string, list: T.OutlineItem[]) => {
        for (const it of list) {
          const cid = T.addChild(n as Note, parentId, it.text);
          if (it.children?.length) add(cid, it.children);
        }
      };
      add(id, items);
    }),
}));

/** Convenience selector hooks. */
export const useNode = (id: string) => useEditor((s) => s.note?.nodes[id]);
