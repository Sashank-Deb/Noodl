"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditor } from "@/store/editor-store";
import { branchIndex, depthOf, isAncestor } from "@/lib/tree";
import { connectorPath, layoutTree, measureText, type Box } from "@/lib/layout";
import type { MapStyle, MindNode, Note } from "@/lib/types";
import { NodeInput, type NodeAction } from "./node-input";
import { NodeBody, TableEditor } from "./node-content";

export interface Viewport {
  x: number;
  y: number;
  k: number;
}

const MIN_K = 0.2;
const MAX_K = 2.5;

/** Node anatomy per depth (DESIGN.md §6). */
export const NODE_STYLE = [
  {
    font: (f: string) => `650 17px ${f}`,
    css: "650 17px/22px var(--font-sans)",
    lh: 22,
    padX: 20,
    minH: 48,
    maxW: 280,
  },
  {
    font: (f: string) => `600 15px ${f}`,
    css: "600 15px/20px var(--font-sans)",
    lh: 20,
    padX: 14,
    minH: 36,
    maxW: 240,
  },
  {
    font: (f: string) => `450 14px ${f}`,
    css: "450 14px/20px var(--font-sans)",
    lh: 20,
    padX: 6,
    minH: 30,
    maxW: 280,
  },
];
export const styleFor = (depth: number) => NODE_STYLE[Math.min(depth, 2)];

export function useMapLayout(
  note: Note | null,
  family: string,
  editingId: string | null,
  balanced = false,
) {
  return useMemo(() => {
    if (!note) return null;
    return layoutTree(
      note,
      (n: MindNode, depth: number) => {
        const st = styleFor(depth);
        const t = measureText(n.text || "Untitled", st.font(family), st.maxW);
        const lines = Math.max(1, Math.round(t.h / 20));
        // +4: borders and sub-pixel rounding so measured text never wraps unexpectedly.
        let w =
          Math.max(depth === 0 ? 96 : 28, t.w) +
          st.padX * 2 +
          4 +
          (n.type === "link" ? 18 : 0);
        let h = Math.max(st.minH, lines * st.lh + (st.minH - st.lh));
        if (n.id === editingId) {
          // Room for the caret, ghost text and the Tab chip while typing.
          w = Math.max(w + 56, 180);
          h = Math.max(h, 34);
        }
        if (n.type === "image" && n.assetId) {
          w = Math.max(w, 160 + st.padX * 2 + 12);
          h += 132;
        }
        if (n.type === "table" && n.table?.length) {
          const cols = Math.max(...n.table.map((r) => r.length));
          const colW = Array.from(
            { length: cols },
            (_, c) =>
              Math.max(
                ...n.table!.map(
                  (r) => measureText(r[c] ?? "", `400 12px ${family}`, 160).w,
                ),
              ) + 14,
          );
          w = Math.max(
            w,
            colW.reduce((a, b) => a + b, 0) + st.padX * 2 + cols + 12,
          );
          h += n.table.length * 21 + 12;
        }
        return { w: Math.ceil(w), h: Math.ceil(h) };
      },
      {
        hGap: (d) => (d === 0 ? 56 : d === 1 ? 44 : 36),
        vGap: 10,
        groupGap: 16,
        balanced,
      },
    );
  }, [note, family, editingId, balanced]);
}

interface MapProps {
  onAction: (id: string, a: NodeAction, e: React.KeyboardEvent) => void;
  viewport: Viewport;
  setViewport: React.Dispatch<React.SetStateAction<Viewport>>;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

export function MindMapView({
  onAction,
  viewport,
  setViewport,
  contentRef,
}: MapProps) {
  const note = useEditor((s) => s.note);
  const fitRequest = useEditor((s) => s.fitRequest);
  const containerRef = useRef<HTMLDivElement>(null);
  const [family, setFamily] = useState(() =>
    typeof document === "undefined"
      ? "system-ui, sans-serif"
      : getComputedStyle(document.body).fontFamily || "system-ui, sans-serif",
  );
  const [dragging, setDragging] = useState<{
    id: string;
    x: number;
    y: number;
    target: string | null;
  } | null>(null);

  useEffect(() => {
    // Re-measure once web fonts are ready so boxes match rendered text.
    document.fonts?.ready.then(() =>
      setFamily(getComputedStyle(document.body).fontFamily + " "),
    );
  }, []);

  const editingId = useEditor((s) => s.editingId);
  const layout = useMapLayout(note, family, editingId);

  const fit = useCallback(() => {
    const el = containerRef.current;
    if (!el || !layout) return;
    const { minX, minY, maxX, maxY } = layout.bounds;
    const pad = 64;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const k = Math.min(
      1,
      Math.max(
        MIN_K,
        Math.min(
          (w - pad * 2) / (maxX - minX || 1),
          (h - pad * 2) / (maxY - minY || 1),
        ),
      ),
    );
    if (k < 0.55 && w < 700) {
      // Small screens: keep text readable and start at the root instead of shrinking everything.
      const kk = 0.75;
      const root = layout.boxes[useEditor.getState().note!.rootId];
      setViewport({
        k: kk,
        x: 20 - root.x * kk,
        y: h / 2 - (root.y + root.h / 2) * kk,
      });
      return;
    }
    setViewport({
      k,
      x: w / 2 - ((minX + maxX) / 2) * k,
      y: h / 2 - ((minY + maxY) / 2) * k,
    });
  }, [layout, setViewport]);

  // Fit on load / "Restore view" / expand-level changes.
  const lastFit = useRef(-1);
  useEffect(() => {
    if (layout && lastFit.current !== fitRequest) {
      lastFit.current = fitRequest;
      fit();
    }
  }, [fitRequest, layout, fit]);

  // Keep the selected/editing node on screen.
  const selectedId = useEditor((s) => s.selectedId);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !layout || !selectedId) return;
    const b = layout.boxes[selectedId];
    if (!b) return;
    const m = 40;
    setViewport((v) => {
      const sx = b.x * v.k + v.x;
      const sy = b.y * v.k + v.y;
      let { x, y } = v;
      if (sx < m) x += m - sx;
      else if (sx + b.w * v.k > el.clientWidth - m)
        x -= sx + b.w * v.k - (el.clientWidth - m);
      if (sy < m) y += m - sy;
      else if (sy + b.h * v.k > el.clientHeight - m)
        y -= sy + b.h * v.k - (el.clientHeight - m);
      return x === v.x && y === v.y ? v : { ...v, x, y };
    });
  }, [selectedId, layout, setViewport]);

  // Wheel: pan (trackpad/mouse); Ctrl/⌘ + wheel or pinch: zoom at cursor.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        setViewport((v) => {
          const k = Math.min(
            MAX_K,
            Math.max(MIN_K, v.k * Math.exp(-e.deltaY * 0.01)),
          );
          return {
            k,
            x: cx - ((cx - v.x) / v.k) * k,
            y: cy - ((cy - v.y) / v.k) * k,
          };
        });
      } else {
        setViewport((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setViewport]);

  // Background pan (mouse/touch) + two-finger pinch.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const panStart = useRef<{
    x: number;
    y: number;
    vx: number;
    vy: number;
  } | null>(null);
  const pinch = useRef<{
    d: number;
    k: number;
    cx: number;
    cy: number;
    vx: number;
    vy: number;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-map-node],[data-map-ui]"))
      return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      containerRef.current?.focus({ preventScroll: true });
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        vx: viewport.x,
        vy: viewport.y,
      };
      useEditor.getState().edit(null);
      (document.activeElement as HTMLElement | null)?.blur?.();
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const rect = containerRef.current!.getBoundingClientRect();
      pinch.current = {
        d: Math.hypot(a.x - b.x, a.y - b.y),
        k: viewport.k,
        cx: (a.x + b.x) / 2 - rect.left,
        cy: (a.y + b.y) / 2 - rect.top,
        vx: viewport.x,
        vy: viewport.y,
      };
      panStart.current = null;
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const p = pinch.current;
      const k = Math.min(
        MAX_K,
        Math.max(MIN_K, (p.k * Math.hypot(a.x - b.x, a.y - b.y)) / p.d),
      );
      setViewport({
        k,
        x: p.cx - ((p.cx - p.vx) / p.k) * k,
        y: p.cy - ((p.cy - p.vy) / p.k) * k,
      });
    } else if (panStart.current) {
      const s = panStart.current;
      setViewport((v) => ({
        ...v,
        x: s.vx + e.clientX - s.x,
        y: s.vy + e.clientY - s.y,
      }));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = panStart.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      // A click on blank canvas (no drag) clears selection like Excalidraw.
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 3)
        useEditor.getState().select(null);
      panStart.current = null;
    }
  };

  // Node drag → reparent.
  const startNodeDrag = useCallback((id: string, e: React.PointerEvent) => {
    const startX = e.clientX;
    const startY = e.clientY;
    let active = false;
    const move = (ev: PointerEvent) => {
      if (!active && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6)
        return;
      active = true;
      const el = document
        .elementFromPoint(ev.clientX, ev.clientY)
        ?.closest("[data-map-node]") as HTMLElement | null;
      const t = el?.dataset.id ?? null;
      const n = useEditor.getState().note!;
      const valid = t && t !== id && !isAncestor(n, id, t) ? t : null;
      setDragging({ id, x: ev.clientX, y: ev.clientY, target: valid });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDragging((d) => {
        if (d?.target) useEditor.getState().move(d.id, d.target);
        return null;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, []);

  const zoomBy = (f: number) => {
    const el = containerRef.current!;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    setViewport((v) => {
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k * f));
      return {
        k,
        x: cx - ((cx - v.x) / v.k) * k,
        y: cy - ((cy - v.y) / v.k) * k,
      };
    });
  };

  if (!note || !layout) return null;
  const { boxes, bounds } = layout;
  const ids = Object.keys(boxes);

  return (
    <div
      ref={containerRef}
      className="map-canvas relative h-full w-full touch-none overflow-hidden outline-none select-none"
      style={{
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        backgroundSize: `${22 * viewport.k}px ${22 * viewport.k}px`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={(e) => {
        if (!(e.target as HTMLElement).closest("[data-map-node],[data-map-ui]"))
          fit();
      }}
      role="application"
      tabIndex={0}
      data-editor-surface
      aria-label="Mind map canvas. Use arrow keys to move between nodes, Tab to add a child, Enter to add a sibling, Space to edit."
    >
      <div
        className="absolute top-0 left-0 origin-top-left will-change-transform"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.k})`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: bounds.minX - 40,
            top: bounds.minY - 40,
          }}
        >
          <div
            ref={contentRef}
            data-export-root
            style={{
              position: "relative",
              width: bounds.maxX - bounds.minX + 80,
              height: bounds.maxY - bounds.minY + 80,
            }}
          >
            <svg
              className="pointer-events-none absolute inset-0 overflow-visible"
              width={bounds.maxX - bounds.minX + 80}
              height={bounds.maxY - bounds.minY + 80}
              aria-hidden
            >
              <g
                transform={`translate(${-bounds.minX + 40}, ${-bounds.minY + 40})`}
              >
                {ids.map((id) => {
                  const n = note.nodes[id];
                  if (!n?.parentId || !boxes[n.parentId]) return null;
                  const bi = branchIndex(note, id);
                  return (
                    <path
                      key={id}
                      d={connectorPath(
                        boxes[n.parentId],
                        boxes[id],
                        note.mapStyle,
                      )}
                      fill="none"
                      stroke={`var(--branch-${(bi % 8) + 1})`}
                      strokeWidth={
                        boxes[n.parentId].depth === 0
                          ? 3
                          : boxes[n.parentId].depth === 1
                            ? 2
                            : 1.75
                      }
                      strokeLinecap="round"
                    />
                  );
                })}
              </g>
            </svg>
            {ids.map((id) => (
              <MapNode
                key={id}
                id={id}
                box={boxes[id]}
                offsetX={-bounds.minX + 40}
                offsetY={-bounds.minY + 40}
                mapStyle={note.mapStyle}
                onAction={onAction}
                onDragStart={startNodeDrag}
                dropTarget={dragging?.target === id}
                beingDragged={dragging?.id === id}
              />
            ))}
          </div>
        </div>
      </div>

      {dragging && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border bg-popover px-3 py-1.5 text-sm shadow-lg"
          style={{ left: dragging.x + 12, top: dragging.y + 12 }}
        >
          {note.nodes[dragging.id]?.text || "Untitled"}
          <span className="ml-2 text-xs text-muted-foreground">
            {dragging.target ? "Drop to move here" : "Drag onto a node"}
          </span>
        </div>
      )}

      <div
        data-map-ui
        className="absolute right-3 bottom-3 flex items-center gap-1 rounded-xl border bg-background/90 p-1 shadow-sm backdrop-blur"
      >
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.2)}
          className="grid size-8 place-items-center rounded-lg hover:bg-accent"
          aria-label="Zoom out"
        >
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          onClick={fit}
          className="min-w-12 rounded-lg px-1.5 text-xs tabular-nums hover:bg-accent"
          aria-label="Fit map to screen"
          title="Fit to screen (⌘0)"
        >
          {Math.round(viewport.k * 100)}%
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1.2)}
          className="grid size-8 place-items-center rounded-lg hover:bg-accent"
          aria-label="Zoom in"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

interface NodeProps {
  id: string;
  box: Box;
  offsetX: number;
  offsetY: number;
  mapStyle: MapStyle;
  onAction: (id: string, a: NodeAction, e: React.KeyboardEvent) => void;
  onDragStart: (id: string, e: React.PointerEvent) => void;
  dropTarget: boolean;
  beingDragged: boolean;
}

const MapNode = memo(function MapNode({
  id,
  box,
  offsetX,
  offsetY,
  mapStyle,
  onAction,
  onDragStart,
  dropTarget,
  beingDragged,
}: NodeProps) {
  const node = useEditor((s) => s.note?.nodes[id]);
  const depth = useEditor((s) => (s.note?.nodes[id] ? depthOf(s.note, id) : 0));
  const bi = useEditor((s) =>
    s.note?.nodes[id] ? branchIndex(s.note, id) : 0,
  );
  const selected = useEditor((s) => s.selectedId === id);
  const editing = useEditor((s) => s.editingId === id);
  const color = `var(--branch-${(bi % 8) + 1})`;
  const act = useCallback(
    (a: NodeAction, e: React.KeyboardEvent) => onAction(id, a, e),
    [id, onAction],
  );

  if (!node) return null;
  const isRoot = depth === 0;
  const boxed = mapStyle === "boxed";

  return (
    <div
      data-map-node
      data-id={id}
      data-selected={selected || undefined}
      className={cn(
        "map-node absolute flex flex-col justify-center rounded-xl transition-[box-shadow,opacity] duration-150 motion-reduce:transition-none",
        isRoot && "map-node-root",
        depth === 1 && (boxed ? "map-node-boxed" : "map-node-l1"),
        depth >= 2 && (boxed ? "map-node-boxed" : "map-node-leaf"),
        selected && "map-node-selected",
        editing && "map-node-editing",
        dropTarget && "map-node-drop",
        beingDragged && "opacity-40",
      )}
      style={
        {
          left: box.x + offsetX,
          top: box.y + offsetY,
          width: box.w,
          minHeight: box.h,
          padding: `0 ${editing ? 10 : styleFor(depth).padX}px`,
          "--branch": color,
          font: styleFor(depth).css,
        } as React.CSSProperties
      }
      onPointerDown={(e) => {
        if (e.button !== 0 || editing) return;
        e.stopPropagation();
        (e.currentTarget.closest("[data-editor-surface]") as HTMLElement | null)?.focus({ preventScroll: true });
        useEditor.getState().select(id);
        if (!isRoot) onDragStart(id, e);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        useEditor.getState().edit(id);
      }}
    >
      {editing ? (
        <>
          {node.type === "image" && <NodeBodyImageOnly node={node} />}
          <NodeInput
            nodeId={id}
            onAction={act}
            autoFocus
            placeholder={isRoot ? "Central topic" : "Type…"}
            ariaLabel={`Edit ${isRoot ? "central topic" : "node"}`}
          />
          {node.type === "table" && <TableEditor nodeId={id} />}
        </>
      ) : (
        <NodeBody node={node} />
      )}
      {node.children.length > 0 && !isRoot && (
        <button
          type="button"
          data-map-ui
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            useEditor.getState().toggleCollapse(id);
          }}
          aria-label={
            node.collapsed
              ? `Expand (${node.children.length} hidden)`
              : "Collapse"
          }
          aria-expanded={!node.collapsed}
          className={cn(
            "absolute top-1/2 grid -translate-y-1/2 place-items-center rounded-full border-2 bg-background text-[10px] font-semibold tabular-nums transition-opacity",
            box.side === -1 ? "-left-3" : "-right-3",
            node.collapsed
              ? "size-6 opacity-100"
              : "size-4 opacity-0 hover:opacity-100 focus-visible:opacity-100 [.map-node:hover_&]:opacity-100",
          )}
          style={{ borderColor: color, color }}
        >
          {node.collapsed ? (
            node.children.length
          ) : (
            <Minus className="size-2.5" strokeWidth={3} />
          )}
        </button>
      )}
    </div>
  );
});

function NodeBodyImageOnly({ node }: { node: MindNode }) {
  return (
    <NodeBody node={{ ...node, text: "", type: "image" }} placeholder="" />
  );
}
