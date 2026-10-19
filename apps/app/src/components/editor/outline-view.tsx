"use client";

import { memo, useCallback, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditor } from "@/store/editor-store";
import { branchIndex, flattenVisible, isAncestor } from "@/lib/tree";
import { NodeInput, type NodeAction } from "./node-input";
import { NodeBody, TableEditor } from "./node-content";

type Drop = { target: string; where: "before" | "after" | "inside" } | null;

export function OutlineView({ onAction }: { onAction: (id: string, a: NodeAction, e?: React.KeyboardEvent) => void }) {
  const note = useEditor((s) => s.note);
  const [drag, setDrag] = useState<{ id: string; drop: Drop } | null>(null);

  const startDrag = useCallback((id: string, e: React.PointerEvent) => {
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    let active = false;
    let last: Drop = null;
    const move = (ev: PointerEvent) => {
      if (!active && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
      active = true;
      const row = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-outline-row]") as HTMLElement | null;
      const n = useEditor.getState().note!;
      let drop: Drop = null;
      if (row?.dataset.id && row.dataset.id !== id && !isAncestor(n, id, row.dataset.id)) {
        const r = row.getBoundingClientRect();
        const rel = (ev.clientY - r.top) / r.height;
        const isRoot = row.dataset.id === n.rootId;
        drop = { target: row.dataset.id, where: isRoot ? "inside" : rel < 0.3 ? "before" : rel > 0.7 ? "after" : "inside" };
      }
      last = drop;
      setDrag({ id, drop });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDrag(null);
      if (!last) return;
      const st = useEditor.getState();
      const n = st.note!;
      const t = n.nodes[last.target];
      if (last.where === "inside") st.move(id, t.id);
      else if (t.parentId) {
        const idx = n.nodes[t.parentId].children.indexOf(t.id);
        st.move(id, t.parentId, last.where === "before" ? idx : idx + 1);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, []);

  if (!note) return null;
  const rows = flattenVisible(note);

  return (
    <div className="h-full overflow-auto outline-none" tabIndex={-1} data-editor-surface onPointerDown={(e) => {
      if (e.target === e.currentTarget) useEditor.getState().edit(null);
    }}>
      <div role="tree" aria-label="Outline" className="mx-auto w-full max-w-3xl px-4 pt-8 pb-40 sm:px-8">
        {rows.map(({ id, depth }) => (
          <OutlineRow
            key={id}
            id={id}
            depth={depth}
            onAction={onAction}
            onDragStart={startDrag}
            drop={drag?.drop?.target === id ? drag.drop.where : null}
            dragging={drag?.id === id}
          />
        ))}
      </div>
    </div>
  );
}

interface RowProps {
  id: string;
  depth: number;
  onAction: (id: string, a: NodeAction, e?: React.KeyboardEvent) => void;
  onDragStart: (id: string, e: React.PointerEvent) => void;
  drop: "before" | "after" | "inside" | null;
  dragging: boolean;
}

const OutlineRow = memo(function OutlineRow({ id, depth, onAction, onDragStart, drop, dragging }: RowProps) {
  const node = useEditor((s) => s.note?.nodes[id]);
  const editing = useEditor((s) => s.editingId === id);
  const selected = useEditor((s) => s.selectedId === id);
  const bi = useEditor((s) => (s.note?.nodes[id] ? branchIndex(s.note, id) : 0));
  const act = useCallback((a: NodeAction, e?: React.KeyboardEvent) => onAction(id, a, e), [id, onAction]);
  if (!node) return null;
  const isRoot = depth === 0;
  const hasKids = node.children.length > 0;
  const color = `var(--branch-${(bi % 8) + 1})`;

  if (isRoot) {
    return (
      <div data-outline-row data-id={id} className={cn("mb-4 rounded-lg", drop && "outline-drop-inside")}>
        <div
          className="cursor-text text-2xl leading-9 font-semibold tracking-tight sm:text-3xl sm:leading-10"
          onClick={() => !editing && useEditor.getState().edit(id)}
        >
          {editing ? (
            <NodeInput nodeId={id} onAction={act} autoFocus placeholder="Untitled" ariaLabel="Note title" />
          ) : (
            <NodeBody node={node} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      data-outline-row
      data-id={id}
      role="treeitem"
      aria-level={depth}
      aria-expanded={hasKids ? !node.collapsed : undefined}
      aria-selected={selected}
      className={cn(
        "group relative flex items-start rounded-md py-[3px] pr-2",
        selected && !editing && "bg-accent/60",
        dragging && "opacity-40",
        drop === "inside" && "outline-drop-inside",
        drop === "before" && "outline-drop-before",
        drop === "after" && "outline-drop-after",
      )}
      style={{ paddingLeft: (depth - 1) * 24 }}
    >
      {/* indent guides */}
      {Array.from({ length: depth - 1 }).map((_, i) => (
        <span key={i} aria-hidden className="absolute top-0 bottom-0 w-px bg-border" style={{ left: i * 24 + 21 }} />
      ))}
      <button
        type="button"
        tabIndex={-1}
        aria-label={hasKids ? (node.collapsed ? "Expand" : "Collapse") : undefined}
        aria-hidden={!hasKids}
        onClick={() => hasKids && useEditor.getState().toggleCollapse(id)}
        className={cn(
          "grid h-6 w-5 shrink-0 place-items-center text-muted-foreground transition-transform",
          !hasKids && "invisible",
        )}
      >
        <ChevronRight className={cn("size-3.5 transition-transform motion-reduce:transition-none", !node.collapsed && "rotate-90")} />
      </button>
      <span
        role="button"
        tabIndex={-1}
        aria-label="Drag to move"
        title="Drag to move"
        onPointerDown={(e) => onDragStart(id, e)}
        className="grid h-6 w-5 shrink-0 cursor-grab touch-none place-items-center active:cursor-grabbing"
      >
        <span
          className={cn("block rounded-full transition-[box-shadow]", node.collapsed && hasKids ? "size-2 ring-4" : "size-1.5")}
          style={{ background: color, ["--tw-ring-color" as string]: `color-mix(in oklch, ${color} 25%, transparent)` }}
        />
      </span>
      <div
        className={cn("min-w-0 flex-1 cursor-text pl-1.5 leading-6", depth === 1 ? "text-[15px] font-medium" : "text-[15px]")}
        onClick={() => !editing && useEditor.getState().edit(id)}
      >
        {editing ? (
          <>
            <NodeInput nodeId={id} onAction={act} autoFocus placeholder="Type, or wait for ideas…" />
            {node.type === "table" && <TableEditor nodeId={id} />}
          </>
        ) : (
          <NodeBody node={node} placeholder="" />
        )}
      </div>
    </div>
  );
});
