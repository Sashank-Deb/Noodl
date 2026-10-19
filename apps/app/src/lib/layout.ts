/**
 * Tidy-tree layout for the mind map view.
 *
 * Each node is measured (width/height), then:
 *  1. subtree heights are computed bottom-up,
 *  2. children are stacked vertically, centred on their parent,
 *  3. x is the parent's right edge + horizontal gap (mirrored for left-side
 *     branches in balanced mode).
 * Runs in O(n) and is pure, so it is easy to unit-test.
 */
import type { MindNode, Note } from "./types";

export interface Size {
  w: number;
  h: number;
}
export interface Box extends Size {
  x: number;
  y: number;
  /** -1 = branch grows to the left, 1 = to the right, 0 = root */
  side: -1 | 0 | 1;
  depth: number;
}
export interface LayoutResult {
  boxes: Record<string, Box>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface LayoutOptions {
  /** Horizontal gap after a parent, optionally per parent depth. */
  hGap?: number | ((parentDepth: number) => number);
  vGap?: number;
  /** Extra space between first-level subtrees. */
  groupGap?: number;
  balanced?: boolean;
}

export function layoutTree(
  note: Note,
  measure: (node: MindNode, depth: number) => Size,
  opts: LayoutOptions = {},
): LayoutResult {
  const hg = opts.hGap ?? 56;
  const hGap = (d: number) => (typeof hg === "function" ? hg(d) : hg);
  const vGap = opts.vGap ?? 14;
  const groupGap = opts.groupGap ?? 0;
  const gapAfter = (depth: number) => vGap + (depth === 1 ? groupGap : 0);
  const sizes: Record<string, Size> = {};
  const subH: Record<string, number> = {};
  const boxes: Record<string, Box> = {};

  const visibleChildren = (n: MindNode) => (n.collapsed ? [] : n.children);

  const measureAll = (id: string, depth: number) => {
    const n = note.nodes[id];
    sizes[id] = measure(n, depth);
    visibleChildren(n).forEach((c) => measureAll(c, depth + 1));
  };
  const subtree = (ids: string[], depth: number): number => {
    if (!ids.length) return 0;
    return ids.reduce((sum, c) => sum + computeSub(c, depth), 0) + gapAfter(depth) * (ids.length - 1);
  };
  const computeSub = (id: string, depth: number): number => {
    const n = note.nodes[id];
    const kids = subtree(visibleChildren(n), depth + 1);
    subH[id] = Math.max(sizes[id].h, kids);
    return subH[id];
  };

  const place = (ids: string[], parent: Box, side: -1 | 1) => {
    const depth = parent.depth + 1;
    const total = ids.reduce((sum, c) => sum + subH[c], 0) + gapAfter(depth) * Math.max(0, ids.length - 1);
    let y = parent.y + parent.h / 2 - total / 2;
    for (const id of ids) {
      const s = sizes[id];
      const h = subH[id];
      const gap = hGap(parent.depth);
      const x = side === 1 ? parent.x + parent.w + gap : parent.x - gap - s.w;
      const box: Box = { x, y: y + h / 2 - s.h / 2, w: s.w, h: s.h, side, depth };
      boxes[id] = box;
      place(visibleChildren(note.nodes[id]), box, side);
      y += h + gapAfter(depth);
    }
  };

  const root = note.nodes[note.rootId];
  measureAll(root.id, 0);
  computeSub(root.id, 0);
  const rs = sizes[root.id];
  const rootBox: Box = { x: 0, y: -rs.h / 2, w: rs.w, h: rs.h, side: 0, depth: 0 };
  boxes[root.id] = rootBox;
  const kids = visibleChildren(root);

  if (opts.balanced && kids.length > 1) {
    // Greedy split that balances total subtree height on both sides, keeping order.
    const total = kids.reduce((s, c) => s + subH[c], 0);
    let acc = 0;
    let split = kids.length;
    for (let i = 0; i < kids.length; i++) {
      if (acc + subH[kids[i]] / 2 > total / 2) {
        split = i;
        break;
      }
      acc += subH[kids[i]];
    }
    split = Math.max(1, Math.min(split, kids.length - 1));
    place(kids.slice(0, split), rootBox, 1);
    place(kids.slice(split), rootBox, -1);
  } else {
    place(kids, rootBox, 1);
  }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const b of Object.values(boxes)) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  return { boxes, bounds: { minX, minY, maxX, maxY } };
}

/** Where a connector meets a node: underlined leaves anchor on the underline, pills at the middle. */
export const anchorY = (b: Box, underlineLeaves: boolean) =>
  underlineLeaves && b.depth >= 2 ? b.y + b.h - 1 : b.y + b.h / 2;

/**
 * Cubic bezier with horizontal tangents (k = Δx/2) from the parent's outgoing
 * anchor to the child's incoming anchor; "elbow" draws rounded orthogonal lines.
 */
export function connectorPath(parent: Box, child: Box, style: "curved" | "elbow" | "boxed"): string {
  const right = child.side !== -1;
  const underline = style === "curved";
  const x1 = right ? parent.x + parent.w : parent.x;
  const y1 = anchorY(parent, underline);
  const x2 = right ? child.x : child.x + child.w;
  const y2 = anchorY(child, underline);
  if (style === "elbow") {
    const mx = x1 + (x2 - x1) / 2;
    const r = Math.min(8, Math.abs(y2 - y1) / 2, Math.abs(mx - x1));
    const dir = y2 > y1 ? 1 : -1;
    const hx = right ? 1 : -1;
    if (Math.abs(y2 - y1) < 1) return `M${x1},${y1} L${x2},${y2}`;
    return `M${x1},${y1} L${mx - hx * r},${y1} Q${mx},${y1} ${mx},${y1 + dir * r} L${mx},${y2 - dir * r} Q${mx},${y2} ${mx + hx * r},${y2} L${x2},${y2}`;
  }
  const dx = (x2 - x1) * 0.5;
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

// ---------------------------------------------------------------------------
// Text measurement (browser) with a deterministic fallback for tests/SSR.
// ---------------------------------------------------------------------------
let ctx: CanvasRenderingContext2D | null | undefined;
function textWidth(text: string, font: string): number {
  if (ctx === undefined) {
    ctx =
      typeof document !== "undefined"
        ? document.createElement("canvas").getContext("2d")
        : null;
  }
  if (!ctx) return text.length * 7.5;
  ctx.font = font;
  return ctx.measureText(text).width;
}

export const NODE_MAX_TEXT_W = 260;
export const NODE_PAD_X = 14;
export const NODE_PAD_Y = 8;
export const LINE_H = 20;

/** Greedy word-wrap measurement matching the node's CSS (max-width + pre-wrap). */
export function measureText(text: string, font: string, maxW = NODE_MAX_TEXT_W): Size {
  const lines = (text || " ").split("\n");
  let w = 0;
  let count = 0;
  for (const line of lines) {
    const words = line.split(/(\s+)/);
    let cur = "";
    let lineCount = 1;
    for (const word of words) {
      const next = cur + word;
      const nw = textWidth(next, font);
      if (nw > maxW && cur.trim()) {
        w = Math.max(w, textWidth(cur, font));
        cur = word.trimStart();
        lineCount++;
      } else {
        cur = next;
      }
    }
    w = Math.max(w, Math.min(maxW, textWidth(cur, font)));
    count += lineCount;
  }
  return { w: Math.ceil(w), h: count * LINE_H };
}
