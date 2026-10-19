"use client";

/**
 * The typeahead node editor. Every node in both views edits through this.
 *
 *  - Inline ghost text: the top suggestion's continuation, shown after the caret.
 *  - Dropdown: up to 5 suggestions (AI first, then local history).
 *  - Keys: Tab / → accept ghost text (Tab adds a child when there's no ghost),
 *    ↑ ↓ choose, Enter picks the highlighted suggestion (else new sibling),
 *    Shift+Enter new line, Esc closes the list (or stops editing).
 *  - Empty node + pause → AI "ideas" for this position (no ghost text).
 *  - Debounced, cached and rate-limited so the free Gemini quota lasts.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Popover as P } from "radix-ui";
import { CornerDownLeft, History, IndentDecrease, IndentIncrease, Loader2, Sparkles, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditor } from "@/store/editor-store";
import { ancestorsText, siblingTexts } from "@/lib/tree";
import { cachedSuggestions, suggest, aiAvailable, useAIStatus } from "@/lib/ai/ai";
import { localIndex } from "@/lib/ai/local-suggest";
import { useSettings } from "@/context/settings";

export type NodeAction =
  | "child"
  | "sibling"
  | "exit"
  | "up"
  | "down"
  | "outdent"
  | "deleteEmpty";

interface Suggestion {
  text: string;
  source: "ai" | "local";
}

export const TYPEAHEAD = {
  debounceMs: 350,
  ideasDelayMs: 700,
  minChars: 2,
  max: 5,
};

interface Props {
  nodeId: string;
  className?: string;
  placeholder?: string;
  onAction: (a: NodeAction, e?: React.KeyboardEvent) => void;
  /** Outline rows are always rendered as inputs; only the focused one runs suggestions. */
  autoFocus?: boolean;
  ariaLabel?: string;
  onFocus?: () => void;
  selectAllOnFocus?: boolean;
}

export function NodeInput({ nodeId, className, placeholder, onAction, autoFocus, ariaLabel, onFocus, selectAllOnFocus }: Props) {
  const value = useEditor((s) => s.note?.nodes[nodeId]?.text ?? "");
  const setText = useEditor((s) => s.setText);
  const { settings } = useSettings();
  const aiStatus = useAIStatus((s) => s.status);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const [caretAtEnd, setCaretAtEnd] = useState(true);
  const [composing, setComposing] = useState(false);
  // AI results are tagged with the text they were requested for.
  const [ai, setAi] = useState<{ forText: string; list: string[] } | null>(null);
  const [loadingFor, setLoadingFor] = useState<string | null>(null);
  // Esc dismisses suggestions until the text changes.
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  // Highlighted row, valid only for the text it was chosen on.
  const [sel, setSel] = useState<{ v: string; i: number }>({ v: "", i: -1 });
  const [acceptedFor, setAcceptedFor] = useState<string | null>(null);
  const listId = useId();
  const useAI = settings.aiEnabled && aiAvailable();
  const phone = usePhone();
  const delay = Math.min(600, Math.max(150, settings.typeaheadDelay ?? TYPEAHEAD.debounceMs));

  // Auto-grow fallback for browsers without `field-sizing: content`.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  useEffect(() => {
    if (!autoFocus) return;
    const el = ref.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    if (selectAllOnFocus) el.select();
    else el.setSelectionRange(el.value.length, el.value.length);
  }, [autoFocus, selectAllOnFocus]);

  // Context for this node (only computed while focused).
  const ctx = useEditor((s) => {
    if (!focused || !s.note?.nodes[nodeId]) return null;
    return JSON.stringify({ path: ancestorsText(s.note, nodeId), siblings: siblingTexts(s.note, nodeId), isRoot: !s.note.nodes[nodeId].parentId });
  });
  const context = useMemo(() => (ctx ? (JSON.parse(ctx) as { path: string[]; siblings: string[]; isRoot: boolean }) : null), [ctx]);

  const trimmed = value.trim();
  const ideasMode = !trimmed && !!context && !context.isRoot;
  const wantsAI = !!context && useAI && !composing && acceptedFor !== value && (ideasMode || trimmed.length >= TYPEAHEAD.minChars);

  // Local suggestions are instant and free.
  const local = useMemo<Suggestion[]>(() => {
    if (!context || !trimmed) return [];
    return localIndex.suggest(value, new Set(context.siblings), TYPEAHEAD.max).map((text) => ({ text, source: "local" as const }));
  }, [context, value, trimmed]);

  // AI suggestions: debounced, cached, aborted on every keystroke.
  useEffect(() => {
    if (!wantsAI || !context) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const req = { path: context.path, siblings: context.siblings, text: value };
    const ctrl = new AbortController();
    const cached = cachedSuggestions(req);
    const t = setTimeout(
      async () => {
        if (cached) return setAi({ forText: value, list: cached });
        setLoadingFor(value);
        try {
          const list = await suggest(req, ctrl.signal);
          if (!ctrl.signal.aborted) setAi({ forText: value, list });
        } catch {
          /* local results remain */
        } finally {
          if (!ctrl.signal.aborted) setLoadingFor(null);
        }
      },
      cached ? 0 : ideasMode ? Math.max(TYPEAHEAD.ideasDelayMs, delay * 2) : delay,
    );
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [wantsAI, context, value, ideasMode, delay]);

  // Merge: AI results still matching what's typed, then local ones.
  const items = useMemo<Suggestion[]>(() => {
    if (!context || acceptedFor === value) return [];
    const lower = value.toLowerCase();
    const aiList =
      ai && (ai.forText === value || (trimmed && ai.list.some((x) => x.toLowerCase().startsWith(lower))))
        ? ai.list.filter((x) => ai.forText === value || x.toLowerCase().startsWith(lower))
        : [];
    const exclude = new Set(context.siblings.map((x) => x.toLowerCase()));
    const seen = new Set<string>();
    const out: Suggestion[] = [];
    for (const s of [...aiList.map((text) => ({ text, source: "ai" as const })), ...local]) {
      const k = s.text.toLowerCase();
      if (seen.has(k) || exclude.has(k) || k === trimmed.toLowerCase()) continue;
      seen.add(k);
      out.push(s);
    }
    return out.slice(0, TYPEAHEAD.max);
  }, [ai, local, value, trimmed, context, acceptedFor]);

  const loading = loadingFor === value && wantsAI;
  const open = focused && items.length > 0 && dismissedFor !== value;
  const active = sel.v === value && sel.i < items.length ? sel.i : -1;
  const setActive = (fn: (i: number) => number) => setSel({ v: value, i: fn(active) });

  const ghost = (() => {
    if (!open || !value || composing || !caretAtEnd) return "";
    const pick = active >= 0 ? items[active] : items[0];
    if (!pick) return "";
    return pick.text.toLowerCase().startsWith(value.toLowerCase()) && pick.text.length > value.length
      ? pick.text.slice(value.length)
      : "";
  })();

  const accept = useCallback(
    (text: string) => {
      setText(nodeId, text);
      setAcceptedFor(text);
      setCaretAtEnd(true);
      requestAnimationFrame(() => {
        const el = ref.current;
        if (el) el.setSelectionRange(text.length, text.length);
      });
    },
    [nodeId, setText],
  );

  const syncCaret = (el: HTMLTextAreaElement) =>
    setCaretAtEnd(el.selectionStart === el.value.length && el.selectionEnd === el.value.length);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (composing || e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
    const listOpen = open && items.length > 0;
    switch (e.key) {
      case "Tab":
        if (e.shiftKey) {
          e.preventDefault();
          onAction("outdent", e);
          return;
        }
        e.preventDefault();
        if (ghost && settings.tabAccepts !== false) return accept(value + ghost);
        if (listOpen && active >= 0) return accept(items[active].text);
        onAction("child", e);
        return;
      case "ArrowRight":
        if (ghost && atEnd) {
          e.preventDefault();
          accept(value + ghost);
        }
        return;
      case "ArrowDown":
        if (listOpen) {
          e.preventDefault();
          setActive((i) => (i + 1) % items.length);
          return;
        }
        if (!el.value.slice(el.selectionEnd).includes("\n")) onAction("down", e);
        return;
      case "ArrowUp":
        if (listOpen) {
          e.preventDefault();
          setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
          return;
        }
        if (!el.value.slice(0, el.selectionStart).includes("\n")) onAction("up", e);
        return;
      case "Enter":
        if (e.shiftKey) return; // newline
        e.preventDefault();
        if (listOpen && active >= 0) return accept(items[active].text);
        onAction("sibling", e);
        return;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        if (listOpen) {
          setDismissedFor(value);
          return;
        }
        onAction("exit", e);
        return;
      case "Backspace":
        if (!el.value) {
          e.preventDefault();
          onAction("deleteEmpty", e);
        }
        return;
    }
  };

  const status = loading ? "loading" : !useAI ? "local" : aiStatus === "rate-limited" || aiStatus === "offline" ? aiStatus : "ai";

  return (
    <>
    {phone && focused && (
      <AccessoryBar
        items={items}
        loading={loading}
        onPick={accept}
        onAction={(a) => onAction(a)}
        canOutdent={!!context && context.path.length > 1}
      />
    )}
    <P.Root open={open && !phone}>
      <P.Anchor asChild>
        <div className={cn("relative grid w-full", className)} data-node-input>
          {/* Ghost layer — mirrors the textarea's text so the completion lines up. */}
          <div
            aria-hidden
            className="pointer-events-none col-start-1 row-start-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
          >
            <span className="invisible">{value}</span>
            <span className="text-(--ghost-text) motion-safe:animate-in motion-safe:fade-in-0">{ghost}</span>
            {ghost && <span className="kbd-ai ml-1.5 select-none">Tab</span>}
            {loading && !ghost && <span className="ai-shimmer ml-1 inline-block h-[0.9em] w-10 rounded-sm align-middle" />}
          </div>
          <textarea
            ref={ref}
            rows={1}
            value={value}
            spellCheck
            placeholder={placeholder}
            aria-label={ariaLabel ?? "Node text"}
            role="combobox"
            aria-autocomplete="both"
            aria-expanded={open && items.length > 0}
            aria-controls={listId}
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            className="col-start-1 row-start-1 m-0 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-inherit outline-none [field-sizing:content] [font:inherit] [letter-spacing:inherit] [line-height:inherit] placeholder:text-muted-foreground/70"
            onChange={(e) => setText(nodeId, e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={(e) => {
              setFocused(true);
              syncCaret(e.currentTarget);
              onFocus?.();
            }}
            onBlur={() => setFocused(false)}
            onSelect={(e) => syncCaret(e.currentTarget)}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          />
        </div>
      </P.Anchor>
      <P.Portal>
        <P.Content
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          className="z-50 w-[min(320px,calc(100vw-24px))] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none"
        >
          <ul id={listId} role="listbox" aria-label="Suggestions" className="max-h-72 overflow-auto p-1">
            {items.map((s, i) => (
              <li
                key={s.text}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onPointerDown={(e) => {
                  e.preventDefault();
                  accept(s.text);
                }}
                onPointerEnter={() => setSel({ v: value, i })}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 text-sm leading-snug",
                  i === active && "bg-accent text-accent-foreground",
                )}
              >
                {s.source === "ai" ? (
                  <Sparkles aria-label="AI suggestion" className="mt-0.5 size-3.5 shrink-0 text-(--ai)" />
                ) : (
                  <History aria-label="From your notes" className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 break-words">
                  {value && s.text.toLowerCase().startsWith(value.toLowerCase()) ? (
                    <>
                      <span className="text-muted-foreground">{s.text.slice(0, value.length)}</span>
                      <span className="font-medium">{s.text.slice(value.length)}</span>
                    </>
                  ) : (
                    s.text
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t px-3 py-1.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {status === "loading" && (
                <>
                  <Loader2 className="size-3 animate-spin" /> Thinking…
                </>
              )}
              {status === "ai" && (
                <>
                  <Sparkles className="size-3 text-(--ai)" /> AI suggestions
                </>
              )}
              {status === "local" && (
                <>
                  <History className="size-3" /> From your notes
                </>
              )}
              {status === "rate-limited" && (
                <>
                  <History className="size-3" /> AI paused for a minute · local
                </>
              )}
              {status === "offline" && (
                <>
                  <WifiOff className="size-3" /> Offline · local
                </>
              )}
            </span>
            <span className="hidden sm:inline">
              <kbd className="font-sans">Tab</kbd> accept · <kbd className="font-sans">↑↓</kbd> choose
            </span>
          </div>
        </P.Content>
      </P.Portal>
    </P.Root>
    </>
  );
}

// ---------------------------------------------------------------------------
// Phones: suggestions become chips in a bar that sits on top of the keyboard,
// with buttons for the keys a touch keyboard doesn't have (DESIGN.md §8).
// ---------------------------------------------------------------------------
const PHONE_QUERY = "(max-width: 640px) and (pointer: coarse)";
function usePhone() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(PHONE_QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

function useKeyboardInset() {
  return useSyncExternalStore(
    (cb) => {
      const vv = window.visualViewport;
      vv?.addEventListener("resize", cb);
      vv?.addEventListener("scroll", cb);
      return () => {
        vv?.removeEventListener("resize", cb);
        vv?.removeEventListener("scroll", cb);
      };
    },
    () => {
      const vv = window.visualViewport;
      return vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
    },
    () => 0,
  );
}

function AccessoryBar({
  items,
  loading,
  onPick,
  onAction,
  canOutdent,
}: {
  items: Suggestion[];
  loading: boolean;
  onPick: (t: string) => void;
  onAction: (a: NodeAction) => void;
  canOutdent: boolean;
}) {
  const inset = useKeyboardInset();
  const keep = (e: React.PointerEvent) => e.preventDefault(); // keep focus (and the keyboard) in the node
  const btn = "grid h-10 min-w-11 place-items-center rounded-lg px-2 text-sm font-medium active:bg-accent disabled:opacity-40";
  return createPortal(
    <div
      data-accessory-bar
      className="fixed inset-x-0 z-50 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      style={{ bottom: inset }}
      onPointerDown={keep}
    >
      {(items.length > 0 || loading) && (
        <div className="flex gap-1.5 overflow-x-auto px-2 pt-2" role="listbox" aria-label="Suggestions">
          {loading && !items.length && <span className="ai-shimmer h-8 w-28 shrink-0 rounded-full" />}
          {items.map((s, i) => (
            <button
              key={s.text}
              type="button"
              role="option"
              aria-selected={i === 0}
              onPointerDown={keep}
              onClick={() => onPick(s.text)}
              className={cn(
                "flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-sm whitespace-nowrap",
                i === 0 && "border-(--ai) bg-(--ai-soft) text-(--ai-strong)",
              )}
            >
              {s.source === "ai" ? <Sparkles className="size-3 text-(--ai)" aria-hidden /> : <History className="size-3 text-muted-foreground" aria-hidden />}
              {s.text}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button type="button" className={btn} onPointerDown={keep} onClick={() => onAction("outdent")} disabled={!canOutdent} aria-label="Outdent">
          <IndentDecrease className="size-5" />
        </button>
        <button type="button" className={btn} onPointerDown={keep} onClick={() => onAction("child")} aria-label="Add child (indent)">
          <IndentIncrease className="size-5" />
        </button>
        <button type="button" className={btn} onPointerDown={keep} onClick={() => onAction("sibling")} aria-label="New sibling">
          <CornerDownLeft className="size-5" />
        </button>
        <span className="flex-1" />
        <button type="button" className={cn(btn, "px-4 text-primary")} onPointerDown={keep} onClick={() => onAction("exit")}>
          Done
        </button>
      </div>
    </div>,
    document.body,
  );
}
