import type { TreeNode } from "@/lib/templates";

/**
 * A static, build-time rendered thumbnail of a mind map, using the same
 * right-side tidy-tree rules as the app (DESIGN.md §7), scaled down.
 * Pure SVG, no client JS. Text is never smaller than 8px.
 */

interface Placed {
  text: string;
  depth: number;
  branch: number;
  x: number;
  cy: number;
  w: number;
  h: number;
  parent?: Placed;
}

const FONT = { 0: 10.5, 1: 9, 2: 8 } as const;
const HEIGHT = { 0: 22, 1: 17, 2: 13 } as const;
const PAD = { 0: 9, 1: 6, 2: 2 } as const;
const H_GAP = { 0: 18, 1: 14, 2: 12 } as const;
const ROW_GAP = 4;
const GROUP_GAP = 6;

const d = (depth: number) => Math.min(depth, 2) as 0 | 1 | 2;

// Rough Onest advance width per character (em). Good enough for thumbnails.
function textWidth(text: string, size: number, weight: number) {
  const em = weight >= 600 ? 0.57 : 0.53;
  return text.length * size * em;
}

function layout(root: TreeNode) {
  const nodes: Placed[] = [];
  let cursor = 0;

  function visit(n: TreeNode, depth: number, branch: number, x: number, parent?: Placed): Placed {
    const k = d(depth);
    const weight = depth === 0 ? 650 : depth === 1 ? 600 : 450;
    const w = Math.ceil(textWidth(n.text, FONT[k], weight) + PAD[k] * 2);
    const p: Placed = { text: n.text, depth, branch, x, cy: 0, w, h: HEIGHT[k], parent };
    nodes.push(p);
    const children = n.children ?? [];
    if (children.length === 0) {
      p.cy = cursor + p.h / 2;
      cursor += p.h + ROW_GAP;
    } else {
      const placed = children.map((c, i) => {
        if (depth === 0 && i > 0) cursor += GROUP_GAP;
        return visit(c, depth + 1, depth === 0 ? (i % 8) + 1 : branch, x + w + H_GAP[k], p);
      });
      p.cy = (placed[0].cy + placed[placed.length - 1].cy) / 2;
    }
    return p;
  }

  visit(root, 0, 0, 0);
  const minY = Math.min(...nodes.map((n) => n.cy - n.h / 2));
  const maxY = Math.max(...nodes.map((n) => n.cy + n.h / 2));
  const maxX = Math.max(...nodes.map((n) => n.x + n.w));
  return { nodes, minY, maxY, maxX };
}

function anchorOut(n: Placed) {
  return n.depth >= 2 ? { x: n.x + n.w, y: n.cy + n.h / 2 } : { x: n.x + n.w, y: n.cy };
}
function anchorIn(n: Placed) {
  return n.depth >= 2 ? { x: n.x, y: n.cy + n.h / 2 } : { x: n.x, y: n.cy };
}

export function MiniMap({
  tree,
  title,
  className,
  scale = 1.25,
  maxHeight = 236,
}: {
  tree: TreeNode;
  title: string;
  className?: string;
  /** Display size relative to the layout units (text is 8px at scale 1). */
  scale?: number;
  maxHeight?: number;
}) {
  const { nodes, minY, maxY, maxX } = layout(tree);
  const pad = 10;
  const vbX = -pad;
  const vbY = minY - pad;
  const vbW = Math.ceil(maxX + pad * 2);
  const vbH = Math.ceil(maxY - minY + pad * 2);

  return (
    <svg
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      width={vbW}
      height={vbH}
      role="img"
      aria-label={title}
      className={className}
      style={{ width: Math.round(vbW * scale), maxWidth: "100%", height: "auto", maxHeight }}
    >
      <g fill="none" strokeLinecap="round">
        {nodes
          .filter((n) => n.parent)
          .map((n, i) => {
            const P = anchorOut(n.parent!);
            const C = anchorIn(n);
            const k = (C.x - P.x) * 0.5;
            return (
              <path
                key={i}
                d={`M${P.x} ${P.y}C${P.x + k} ${P.y} ${C.x - k} ${C.y} ${C.x} ${C.y}`}
                style={{ stroke: `var(--branch-${n.branch})` }}
                strokeWidth={n.parent!.depth === 0 ? 2 : 1.4}
              />
            );
          })}
      </g>
      {nodes.map((n, i) => {
        const top = n.cy - n.h / 2;
        if (n.depth === 0) {
          return (
            <g key={i}>
              <rect x={n.x} y={top} width={n.w} height={n.h} rx={7} style={{ fill: "var(--node-root-bg)" }} />
              <text
                x={n.x + n.w / 2}
                y={n.cy + FONT[0] * 0.36}
                textAnchor="middle"
                fontSize={FONT[0]}
                fontWeight={650}
                style={{ fill: "var(--node-root-fg)" }}
              >
                {n.text}
              </text>
            </g>
          );
        }
        if (n.depth === 1) {
          const b = `var(--branch-${n.branch})`;
          return (
            <g key={i}>
              <rect
                x={n.x}
                y={top}
                width={n.w}
                height={n.h}
                rx={5}
                strokeWidth={1}
                style={{
                  fill: `color-mix(in oklch, ${b} 13%, var(--node-bg))`,
                  stroke: `color-mix(in oklch, ${b} 60%, var(--node-bg))`,
                }}
              />
              <text
                x={n.x + n.w / 2}
                y={n.cy + FONT[1] * 0.36}
                textAnchor="middle"
                fontSize={FONT[1]}
                fontWeight={600}
                style={{ fill: "var(--node-fg)" }}
              >
                {n.text}
              </text>
            </g>
          );
        }
        return (
          <g key={i}>
            <line
              x1={n.x}
              x2={n.x + n.w}
              y1={n.cy + n.h / 2}
              y2={n.cy + n.h / 2}
              strokeWidth={1.4}
              strokeLinecap="round"
              style={{ stroke: `var(--branch-${n.branch})` }}
            />
            <text x={n.x + PAD[2]} y={n.cy + 2.5} fontSize={FONT[2]} style={{ fill: "var(--node-fg)" }}>
              {n.text}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
