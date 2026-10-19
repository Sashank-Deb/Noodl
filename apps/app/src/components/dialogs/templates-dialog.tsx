"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TEMPLATES, type Template } from "@/lib/templates";
import type { OutlineItem } from "@/lib/tree";

const count = (o: OutlineItem): number => 1 + (o.children ?? []).reduce((s, c) => s + count(c), 0);

/** Tiny static preview of a template's first two levels. */
function MiniMap({ outline }: { outline: OutlineItem }) {
  const kids = (outline.children ?? []).slice(0, 5);
  const h = Math.max(60, kids.length * 18 + 10);
  return (
    <svg viewBox={`0 0 200 ${h}`} className="h-[72px] w-full" aria-hidden>
      {kids.map((_, i) => {
        const y = 5 + i * 18 + 9;
        return <path key={i} d={`M58 ${h / 2} C90 ${h / 2} 90 ${y} 118 ${y}`} fill="none" stroke={`var(--branch-${(i % 8) + 1})`} strokeWidth="2" strokeLinecap="round" />;
      })}
      <rect x="8" y={h / 2 - 10} width="50" height="20" rx="6" fill="var(--node-root-bg)" />
      {kids.map((_, i) => (
        <rect key={i} x="118" y={5 + i * 18 + 3} width={40 + ((i * 17) % 30)} height="12" rx="4" fill={`color-mix(in oklch, var(--branch-${(i % 8) + 1}) 18%, var(--node-bg))`} stroke={`color-mix(in oklch, var(--branch-${(i % 8) + 1}) 60%, var(--node-bg))`} />
      ))}
    </svg>
  );
}

export function TemplatesDialog({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (t: Template) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Start from a template</DialogTitle>
          <DialogDescription>Creates a copy you can change freely.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[65vh] grid-cols-1 gap-3 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t)}
              className="group rounded-xl border bg-card p-3 text-left transition-colors hover:border-ring/50 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="map-canvas mb-2.5 rounded-lg border" style={{ backgroundSize: "14px 14px" }}>
                <MiniMap outline={t.outline} />
              </div>
              <p className="text-sm font-semibold">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.description}</p>
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">{count(t.outline)} nodes</p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
