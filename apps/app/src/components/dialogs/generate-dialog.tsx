"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AI_LIMITS, generateMap, summarizeToMap } from "@/lib/ai/ai";
import type { OutlineItem } from "@/lib/tree";
import { aiErrorMessage, MOD } from "@/components/editor/editor";

const EXAMPLES = ["Plan a community garden", "Revise photosynthesis for an exam", "Launch plan for a podcast", "Pros and cons of remote work"];
const MAX_SOURCE = AI_LIMITS.source;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (outline: OutlineItem) => void;
}

export function GenerateDialog({ open, onOpenChange, onCreate }: Props) {
  const [tab, setTab] = useState("prompt");
  const [prompt, setPrompt] = useState("");
  const [source, setSource] = useState("");
  const [depth, setDepth] = useState("3");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<OutlineItem | null>(null);

  const run = async () => {
    setError(null);
    const input = tab === "prompt" ? prompt.trim() : source.trim();
    if (!input) return setError(tab === "prompt" ? "Describe what the map should be about." : "Paste some text to summarize.");
    setBusy(true);
    setPreview(null);
    try {
      const out = tab === "prompt" ? await generateMap(input, Number(depth)) : await summarizeToMap(input);
      if (!out.children?.length) throw new Error("empty");
      setPreview(out);
    } catch (e) {
      setError((e as Error).message === "empty" ? "The AI returned an empty map. Try rephrasing." : aiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setPreview(null);
    setError(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-[600px]" onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !busy) {
          e.preventDefault();
          if (preview) {
            onCreate(preview);
            reset();
          } else void run();
        }
      }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-(--ai)" /> Generate a map
          </DialogTitle>
          <DialogDescription>Describe a topic, or paste text to turn into a map. You can edit everything afterwards.</DialogDescription>
        </DialogHeader>

        {preview ? (
          <div className="max-h-[50vh] overflow-auto rounded-xl border bg-(--ai-soft)/40 p-4 text-sm">
            <p className="mb-2 font-semibold">{preview.text}</p>
            <PreviewList items={preview.children ?? []} />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="prompt">From a prompt</TabsTrigger>
              <TabsTrigger value="summarize">Summarize pasted text</TabsTrigger>
            </TabsList>
            <TabsContent value="prompt" className="space-y-3 pt-2">
              <Textarea
                autoFocus
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, AI_LIMITS.prompt))}
                maxLength={AI_LIMITS.prompt}
                placeholder="e.g. Study plan for learning Spanish in 3 months"
                className="min-h-[84px] resize-none"
                aria-label="What should the map be about?"
              />
              <p className="-mt-2 text-right text-xs text-muted-foreground tabular-nums">
                {prompt.length} / {AI_LIMITS.prompt}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button key={ex} type="button" onClick={() => setPrompt(ex)} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                    {ex}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">Depth</span>
                <ToggleGroup type="single" value={depth} onValueChange={(v) => v && setDepth(v)} variant="outline" size="sm">
                  {["2", "3", "4"].map((d) => (
                    <ToggleGroupItem key={d} value={d} className="w-9" aria-label={`${d} levels`}>
                      {d}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </TabsContent>
            <TabsContent value="summarize" className="space-y-1.5 pt-2">
              <Textarea
                value={source}
                onChange={(e) => setSource(e.target.value.slice(0, MAX_SOURCE))}
                maxLength={MAX_SOURCE}
                placeholder="Paste an article, transcript or notes (up to 6,000 characters)"
                className="min-h-[160px] resize-y"
                aria-label="Text to summarize"
              />
              <p className="text-right text-xs text-muted-foreground tabular-nums">
                {source.length.toLocaleString()} / {MAX_SOURCE.toLocaleString()}
              </p>
            </TabsContent>
          </Tabs>
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <p className="text-xs text-muted-foreground">Your prompt is sent to our AI provider (Groq). Your other notes aren&apos;t sent.</p>
          <div className="flex gap-2">
            {preview ? (
              <>
                <Button variant="ghost" onClick={reset}>
                  Try again
                </Button>
                <Button
                  onClick={() => {
                    onCreate(preview);
                    reset();
                  }}
                >
                  Open map <kbd className="ml-1 text-[11px] opacity-70">{MOD}⏎</kbd>
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={run} disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  {busy ? "Generating…" : "Generate map"}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewList({ items }: { items: OutlineItem[] }) {
  return (
    <ul className="space-y-0.5 border-l pl-3">
      {items.map((it, i) => (
        <li key={i}>
          <span>{it.text}</span>
          {it.children?.length ? <PreviewList items={it.children} /> : null}
        </li>
      ))}
    </ul>
  );
}
