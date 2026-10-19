/**
 * Offline / rate-limited fallback for the node typeahead: suggests phrases the
 * user has already written (in any note) that start with what they're typing,
 * then single-word completions. Zero network, zero cost.
 */
const MAX_PHRASES = 5000;

class LocalIndex {
  private phrases = new Map<string, { text: string; count: number }>();
  private words = new Map<string, number>();

  add(text: string) {
    const t = text.trim();
    if (!t || t.length > 120) return;
    const key = t.toLowerCase();
    const cur = this.phrases.get(key);
    if (cur) cur.count++;
    else if (this.phrases.size < MAX_PHRASES) this.phrases.set(key, { text: t, count: 1 });
    for (const w of t.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]{2,}/gu) ?? []) {
      this.words.set(w, (this.words.get(w) ?? 0) + 1);
    }
  }

  clear() {
    this.phrases.clear();
    this.words.clear();
  }

  suggest(input: string, exclude: Set<string> = new Set(), limit = 5): string[] {
    const q = input.trim().toLowerCase();
    if (q.length < 1) return [];
    const out: string[] = [];
    const seen = new Set<string>([q, ...[...exclude].map((e) => e.toLowerCase())]);
    const phraseHits = [...this.phrases.entries()]
      .filter(([k]) => k.startsWith(q) && !seen.has(k))
      .sort((a, b) => b[1].count - a[1].count || a[0].length - b[0].length)
      .slice(0, limit);
    for (const [k, v] of phraseHits) {
      seen.add(k);
      // Keep the user's typed casing for the part they've typed.
      out.push(input + v.text.slice(input.length));
    }
    if (out.length < limit) {
      const m = input.match(/([\p{L}\p{N}'-]+)$/u);
      const last = m?.[1].toLowerCase();
      if (last && last.length >= 2) {
        const words = [...this.words.entries()]
          .filter(([w]) => w.startsWith(last) && w !== last)
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit - out.length);
        for (const [w] of words) {
          const s = input + w.slice(last.length);
          if (!seen.has(s.toLowerCase())) {
            seen.add(s.toLowerCase());
            out.push(s);
          }
        }
      }
    }
    return out;
  }
}

export const localIndex = new LocalIndex();
