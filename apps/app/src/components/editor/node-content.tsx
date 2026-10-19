"use client";

import { useEffect, useState } from "react";
import { ExternalLink, ImageOff } from "lucide-react";
import { db } from "@/lib/db";
import { safeUrl } from "@/lib/tree";
import type { MindNode } from "@/lib/types";
import { useEditor } from "@/store/editor-store";

/** Read-only rendering of a node's body (text, link, image, table). */
export function NodeBody({ node, placeholder = "Untitled" }: { node: MindNode; placeholder?: string }) {
  return (
    <>
      {node.type === "image" && node.assetId && <NodeImage assetId={node.assetId} />}
      {node.type === "link" && safeUrl(node.url) ? (
        <a
          href={safeUrl(node.url)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline decoration-1 underline-offset-2 hover:text-primary"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{node.text || node.url}</span>
          <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden />
        </a>
      ) : (
        <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
          {node.text || <span className="text-muted-foreground/70">{placeholder}</span>}
        </span>
      )}
      {node.type === "table" && node.table && <NodeTable table={node.table} />}
    </>
  );
}

export function NodeTable({ table }: { table: string[][] }) {
  return (
    <table className="mt-1.5 w-full border-collapse text-xs">
      <tbody>
        {table.map((row, r) => (
          <tr key={r}>
            {row.map((c, i) => (
              <td key={i} className={`border border-border px-1.5 py-0.5 ${r === 0 ? "bg-muted font-medium" : ""}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const urlCache = new Map<string, string>();

export function NodeImage({ assetId }: { assetId: string }) {
  const [url, setUrl] = useState<string | null>(urlCache.get(assetId) ?? null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (urlCache.has(assetId)) return;
    let alive = true;
    db()
      .assets.get(assetId)
      .then((a) => {
        if (!alive) return;
        if (!a) return setMissing(true);
        const u = URL.createObjectURL(a.blob);
        urlCache.set(assetId, u);
        setUrl(u);
      });
    return () => {
      alive = false;
    };
  }, [assetId]);
  if (missing)
    return (
      <div className="mb-1.5 flex h-[90px] w-[160px] items-center justify-center gap-1.5 rounded-md bg-muted text-xs text-muted-foreground">
        <ImageOff className="size-4" /> Image on another device
      </div>
    );
  if (!url) return <div className="mb-1.5 h-[120px] w-[160px] animate-pulse rounded-md bg-muted" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" draggable={false} className="mb-1.5 h-[120px] w-[160px] rounded-md object-cover" />;
}

/** Inline cell editor shown while a table node is being edited. */
export function TableEditor({ nodeId }: { nodeId: string }) {
  const table = useEditor((s) => s.note?.nodes[nodeId]?.table);
  const update = useEditor((s) => s.updateNode);
  if (!table) return null;
  const set = (next: string[][]) => update(nodeId, { table: next });
  const cols = Math.max(...table.map((r) => r.length));
  return (
    <div className="mt-1.5" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <table className="w-full border-collapse text-xs">
        <tbody>
          {table.map((row, r) => (
            <tr key={r}>
              {Array.from({ length: cols }, (_, c) => (
                <td key={c} className={`border border-border p-0 ${r === 0 ? "bg-muted font-medium" : ""}`}>
                  <input
                    value={row[c] ?? ""}
                    aria-label={`Row ${r + 1}, column ${c + 1}`}
                    onChange={(e) => set(table.map((rr, i) => (i === r ? Array.from({ length: cols }, (_, j) => (j === c ? e.target.value : rr[j] ?? "")) : rr)))}
                    className="w-full min-w-14 bg-transparent px-1.5 py-0.5 outline-none focus:bg-accent"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-1 flex gap-1 text-[11px]">
        <button type="button" className="rounded border px-1.5 py-0.5 hover:bg-accent" onClick={() => set([...table, Array(cols).fill("")])}>
          + Row
        </button>
        <button type="button" className="rounded border px-1.5 py-0.5 hover:bg-accent" onClick={() => set(table.map((r, i) => [...r, i === 0 ? `Column ${cols + 1}` : ""]))}>
          + Column
        </button>
        {table.length > 2 && (
          <button type="button" className="rounded border px-1.5 py-0.5 hover:bg-accent" onClick={() => set(table.slice(0, -1))}>
            − Row
          </button>
        )}
      </div>
    </div>
  );
}
