/**
 * Pure, immutable-friendly tree operations on a Note's node map.
 * All functions mutate the `note` argument in place and are meant to be called
 * inside an immer `produce` (the Zustand store does this), which keeps them
 * simple and still gives us structural sharing for undo/redo.
 */
import { nanoid } from "nanoid";
import type { MindNode, Note, NodeType, MapStyle } from "./types";

export const newId = () => nanoid(10);

export function createNode(
  parentId: string | null,
  text = "",
  type: NodeType = "text",
): MindNode {
  return { id: newId(), parentId, children: [], text, type };
}

export function createNote(
  title = "Untitled",
  opts: { folderId?: string | null; mapStyle?: MapStyle } = {},
): Note {
  const root = createNode(null, title);
  const now = Date.now();
  return {
    id: newId(),
    title,
    folderId: opts.folderId ?? null,
    rootId: root.id,
    nodes: { [root.id]: root },
    mapStyle: opts.mapStyle ?? "curved",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncedAt: null,
  };
}

/** Builds a note from a nested outline `{ text, children }`. */
export interface OutlineItem {
  text: string;
  children?: OutlineItem[];
  type?: NodeType;
  url?: string;
  table?: string[][];
}

const NODE_TYPES: NodeType[] = ["text", "link", "image", "table"];

/** Only http(s) and mailto links are allowed anywhere (import, edit, export). */
export function safeUrl(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  const u = url.trim();
  if (!u) return undefined;
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}`;
    const parsed = new URL(withScheme);
    return ["http:", "https:", "mailto:"].includes(parsed.protocol) ? withScheme : undefined;
  } catch {
    return undefined;
  }
}

function sanitizeTable(t: unknown): string[][] | undefined {
  if (!Array.isArray(t) || !t.length) return undefined;
  return t.slice(0, 100).map((row) => (Array.isArray(row) ? row.slice(0, 30).map((c) => String(c ?? "")) : [String(row ?? "")]));
}

/** Coerces untrusted outline data (imports, AI output) into a valid shape. */
export function sanitizeOutline(raw: unknown, depth = 0): OutlineItem {
  const o = (raw && typeof raw === "object" ? raw : { text: raw }) as Record<string, unknown>;
  const item: OutlineItem = { text: typeof o.text === "string" ? o.text.slice(0, 5000) : o.text == null ? "" : String(o.text) };
  const type = NODE_TYPES.includes(o.type as NodeType) ? (o.type as NodeType) : "text";
  if (type === "link") {
    const url = safeUrl(o.url);
    if (url) {
      item.type = "link";
      item.url = url;
    }
  } else if (type === "table") {
    const table = sanitizeTable(o.table);
    if (table) {
      item.type = "table";
      item.table = table;
    }
  }
  if (Array.isArray(o.children) && depth < 50) item.children = o.children.map((c) => sanitizeOutline(c, depth + 1));
  return item;
}

/** Validates a stored note (e.g. from a backup) node by node. */
export function sanitizeNote(n: Note): Note {
  const nodes: Record<string, MindNode> = {};
  for (const [id, node] of Object.entries(n.nodes ?? {})) {
    const clean = sanitizeOutline(node);
    nodes[id] = {
      id,
      parentId: typeof node.parentId === "string" ? node.parentId : null,
      children: Array.isArray(node.children) ? node.children.filter((c) => typeof c === "string") : [],
      text: clean.text,
      type: node.type === "image" && typeof node.assetId === "string" ? "image" : clean.type ?? "text",
      ...(clean.url ? { url: clean.url } : {}),
      ...(clean.table ? { table: clean.table } : {}),
      ...(node.type === "image" && typeof node.assetId === "string" ? { assetId: node.assetId } : {}),
      ...(node.collapsed ? { collapsed: true } : {}),
    };
  }
  return { ...n, nodes };
}

export function noteFromOutline(
  rawOutline: OutlineItem,
  opts: { folderId?: string | null; mapStyle?: MapStyle } = {},
): Note {
  const outline = sanitizeOutline(rawOutline);
  const note = createNote(outline.text || "Untitled", opts);
  const root = note.nodes[note.rootId];
  if (outline.type) root.type = outline.type;
  const add = (parentId: string, items: OutlineItem[] = []) => {
    for (const item of items) {
      const n = createNode(parentId, item.text ?? "", item.type ?? "text");
      if (item.url) n.url = item.url;
      if (item.table) n.table = item.table;
      note.nodes[n.id] = n;
      note.nodes[parentId].children.push(n.id);
      add(n.id, item.children);
    }
  };
  add(root.id, outline.children);
  return note;
}

export function toOutline(note: Note, id = note.rootId): OutlineItem {
  const n = note.nodes[id];
  const item: OutlineItem = { text: n.text };
  if (n.type !== "text") item.type = n.type;
  if (n.url) item.url = n.url;
  if (n.table) item.table = n.table;
  if (n.children.length) item.children = n.children.map((c) => toOutline(note, c));
  return item;
}

export function addChild(note: Note, parentId: string, text = "", index?: number): string {
  const parent = note.nodes[parentId];
  if (!parent) throw new Error(`No node ${parentId}`);
  const n = createNode(parentId, text);
  note.nodes[n.id] = n;
  if (index === undefined || index < 0 || index > parent.children.length) {
    parent.children.push(n.id);
  } else {
    parent.children.splice(index, 0, n.id);
  }
  parent.collapsed = false;
  return n.id;
}

/** Adds a sibling after `id`. Adding a sibling to the root adds a child instead. */
export function addSibling(note: Note, id: string, text = ""): string {
  const node = note.nodes[id];
  if (!node.parentId) return addChild(note, id, text);
  const parent = note.nodes[node.parentId];
  return addChild(note, parent.id, text, parent.children.indexOf(id) + 1);
}

export function removeNode(note: Note, id: string): string | null {
  const node = note.nodes[id];
  if (!node || !node.parentId) return null; // root cannot be removed
  const parent = note.nodes[node.parentId];
  const idx = parent.children.indexOf(id);
  parent.children.splice(idx, 1);
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    stack.push(...note.nodes[cur].children);
    delete note.nodes[cur];
  }
  // Return the node that should receive selection next.
  return parent.children[idx] ?? parent.children[idx - 1] ?? parent.id;
}

export function isAncestor(note: Note, ancestorId: string, id: string): boolean {
  let cur: string | null = id;
  while (cur) {
    if (cur === ancestorId) return true;
    cur = note.nodes[cur]?.parentId ?? null;
  }
  return false;
}

/** Moves `id` under `newParentId` at `index`. Refuses cycles and moving the root. */
export function moveNode(note: Note, id: string, newParentId: string, index?: number): boolean {
  const node = note.nodes[id];
  if (!node || !node.parentId) return false;
  if (isAncestor(note, id, newParentId)) return false;
  const oldParent = note.nodes[node.parentId];
  const oldIdx = oldParent.children.indexOf(id);
  oldParent.children.splice(oldIdx, 1);
  const newParent = note.nodes[newParentId];
  let i = index ?? newParent.children.length;
  if (oldParent.id === newParentId && oldIdx < i) i -= 1;
  i = Math.max(0, Math.min(i, newParent.children.length));
  newParent.children.splice(i, 0, id);
  node.parentId = newParentId;
  newParent.collapsed = false;
  return true;
}

/** Outline "indent": become last child of previous sibling. */
export function indent(note: Note, id: string): boolean {
  const node = note.nodes[id];
  if (!node?.parentId) return false;
  const siblings = note.nodes[node.parentId].children;
  const idx = siblings.indexOf(id);
  if (idx <= 0) return false;
  return moveNode(note, id, siblings[idx - 1]);
}

/** Outline "outdent": become next sibling of parent. */
export function outdent(note: Note, id: string): boolean {
  const node = note.nodes[id];
  if (!node?.parentId) return false;
  const parent = note.nodes[node.parentId];
  if (!parent.parentId) return false;
  const grand = note.nodes[parent.parentId];
  return moveNode(note, id, grand.id, grand.children.indexOf(parent.id) + 1);
}

export function moveUpDown(note: Note, id: string, delta: -1 | 1): boolean {
  const node = note.nodes[id];
  if (!node?.parentId) return false;
  const siblings = note.nodes[node.parentId].children;
  const idx = siblings.indexOf(id);
  const j = idx + delta;
  if (j < 0 || j >= siblings.length) return false;
  [siblings[idx], siblings[j]] = [siblings[j], siblings[idx]];
  return true;
}

export function depthOf(note: Note, id: string): number {
  let d = 0;
  let cur = note.nodes[id]?.parentId;
  while (cur) {
    d++;
    cur = note.nodes[cur]?.parentId;
  }
  return d;
}

/** Visible nodes in pre-order (respects collapsed), with depth. */
export function flattenVisible(note: Note): { id: string; depth: number }[] {
  const out: { id: string; depth: number }[] = [];
  const walk = (id: string, depth: number) => {
    out.push({ id, depth });
    const n = note.nodes[id];
    if (!n.collapsed) n.children.forEach((c) => walk(c, depth + 1));
  };
  walk(note.rootId, 0);
  return out;
}

/** Expand all levels < `level`, collapse the rest. `level = Infinity` expands everything. */
export function expandToLevel(note: Note, level: number) {
  const walk = (id: string, depth: number) => {
    const n = note.nodes[id];
    if (n.children.length) n.collapsed = depth >= level;
    n.children.forEach((c) => walk(c, depth + 1));
  };
  walk(note.rootId, 0);
}

/** Path of texts from root to `id`'s parent — used as AI context. */
export function ancestorsText(note: Note, id: string): string[] {
  const out: string[] = [];
  let cur = note.nodes[id]?.parentId;
  while (cur) {
    out.unshift(note.nodes[cur].text);
    cur = note.nodes[cur].parentId;
  }
  return out;
}

export function siblingTexts(note: Note, id: string): string[] {
  const n = note.nodes[id];
  if (!n?.parentId) return [];
  return note.nodes[n.parentId].children
    .filter((c) => c !== id)
    .map((c) => note.nodes[c].text)
    .filter(Boolean);
}

/** Top-level branch index of a node (for branch colours). Root returns -1. */
export function branchIndex(note: Note, id: string): number {
  let cur = id;
  while (true) {
    const n = note.nodes[cur];
    if (!n.parentId) return -1;
    if (n.parentId === note.rootId) return note.nodes[note.rootId].children.indexOf(cur);
    cur = n.parentId;
  }
}

export function countNodes(note: Note): number {
  return Object.keys(note.nodes).length;
}

/** Deep-copies a note with fresh ids (used by "Duplicate" and templates). */
export function cloneNote(note: Note, title?: string): Note {
  const copy = noteFromOutline(toOutline(note), {
    folderId: note.folderId,
    mapStyle: note.mapStyle,
  });
  if (title) {
    copy.title = title;
    copy.nodes[copy.rootId].text = title;
  } else {
    copy.title = note.title;
  }
  return copy;
}

/** Validates the structural invariants of a note. Returns a list of problems. */
export function validateNote(note: Note): string[] {
  const problems: string[] = [];
  const root = note.nodes[note.rootId];
  if (!root) return ["missing root"];
  if (root.parentId !== null) problems.push("root has a parent");
  const seen = new Set<string>();
  const walk = (id: string) => {
    if (seen.has(id)) return problems.push(`cycle or duplicate at ${id}`);
    seen.add(id);
    const n = note.nodes[id];
    if (!n) return problems.push(`dangling child ${id}`);
    for (const c of n.children) {
      if (note.nodes[c] && note.nodes[c].parentId !== id) problems.push(`parent mismatch ${c}`);
      walk(c);
    }
  };
  walk(note.rootId);
  for (const id of Object.keys(note.nodes)) if (!seen.has(id)) problems.push(`orphan ${id}`);
  return problems;
}
