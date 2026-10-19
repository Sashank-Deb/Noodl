/** Import / export: Markdown, HTML, JSON, plain text. Image/PDF export lives in export-image.ts. */
import type { Note } from "./types";
import { noteFromOutline, safeUrl, toOutline, type OutlineItem } from "./tree";

function nodeLine(item: OutlineItem): string {
  if (item.type === "link" && item.url) return `[${item.text || item.url}](${item.url})`;
  return item.text.replace(/\n/g, " ");
}

export function toMarkdown(note: Note): string {
  const root = toOutline(note);
  const lines: string[] = [`# ${root.text || "Untitled"}`, ""];
  const walk = (items: OutlineItem[] = [], depth: number) => {
    for (const it of items) {
      if (it.type === "table" && it.table?.length) {
        lines.push(`${"  ".repeat(depth)}- ${it.text || "Table"}`);
        const t = it.table;
        const pad = "  ".repeat(depth + 1);
        lines.push(`${pad}| ${t[0].join(" | ")} |`);
        lines.push(`${pad}| ${t[0].map(() => "---").join(" | ")} |`);
        for (const row of t.slice(1)) lines.push(`${pad}| ${row.join(" | ")} |`);
      } else {
        lines.push(`${"  ".repeat(depth)}- ${nodeLine(it)}`);
      }
      walk(it.children, depth + 1);
    }
  };
  walk(root.children, 0);
  return lines.join("\n") + "\n";
}

export function toPlainText(note: Note): string {
  const root = toOutline(note);
  const lines = [root.text];
  const walk = (items: OutlineItem[] = [], depth: number) => {
    for (const it of items) {
      lines.push(`${"\t".repeat(depth)}${nodeLine(it)}`);
      walk(it.children, depth + 1);
    }
  };
  walk(root.children, 1);
  return lines.join("\n");
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function toHTML(note: Note): string {
  const root = toOutline(note);
  const li = (it: OutlineItem): string => {
    let body = esc(it.text);
    const url = it.type === "link" ? safeUrl(it.url) : undefined;
    if (url) body = `<a href="${esc(url)}" rel="noopener noreferrer">${esc(it.text || url)}</a>`;
    if (it.type === "table" && it.table)
      body += `<table>${it.table.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`;
    const kids = it.children?.length ? `<ul>${it.children.map(li).join("")}</ul>` : "";
    return `<li>${body}${kids}</li>`;
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(root.text)}</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 16px;color:#1f2328}ul{padding-left:1.4em}table{border-collapse:collapse;margin:6px 0}td{border:1px solid #ccc;padding:4px 8px}</style></head>
<body><h1>${esc(root.text)}</h1><ul>${(root.children ?? []).map(li).join("")}</ul></body></html>`;
}

export interface NoteExport {
  app: "noodl";
  kind: "note";
  version: 1;
  outline: OutlineItem;
  mapStyle: Note["mapStyle"];
}

export function toJSON(note: Note): string {
  const data: NoteExport = {
    app: "noodl",
    kind: "note",
    version: 1,
    outline: toOutline(note),
    mapStyle: note.mapStyle,
  };
  return JSON.stringify(data, null, 2);
}

/** Accepts our own export, a bare outline `{text, children}`, or an array of items. */
export function fromJSON(text: string): Note {
  const data = JSON.parse(text);
  if ((data?.app === "noodl" || data?.app === "mindnote-web") && data.kind === "note") {
    return noteFromOutline(data.outline, { mapStyle: data.mapStyle });
  }
  if (Array.isArray(data)) return noteFromOutline({ text: "Imported", children: normalise(data) });
  if (data && typeof data === "object") {
    const text = data.text ?? data.title ?? data.name ?? "Imported";
    return noteFromOutline({ text: String(text), children: normalise(data.children ?? data.nodes ?? []) });
  }
  throw new Error("Unsupported JSON format");
}

function normalise(items: unknown[]): OutlineItem[] {
  return items.map((raw) => {
    if (typeof raw === "string") return { text: raw };
    const o = raw as Record<string, unknown>;
    return {
      text: String(o.text ?? o.title ?? o.name ?? ""),
      children: normalise((o.children as unknown[]) ?? []),
    };
  });
}

/**
 * Markdown → note. Headings define structure (#, ##, ...); bullet / numbered
 * lists nest under the nearest heading by indentation. The first H1 (or the
 * first line) becomes the root.
 */
export function fromMarkdown(md: string, fallbackTitle = "Imported"): Note {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const root: OutlineItem = { text: "", children: [] };
  // Stack of [level, item]; headings use level = hashes*100, lists = 1000 + indent.
  const stack: { level: number; item: OutlineItem }[] = [{ level: 0, item: root }];
  const push = (level: number, text: string) => {
    while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
    const item: OutlineItem = { text, children: [] };
    const linkMatch = text.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
    if (linkMatch) {
      item.text = linkMatch[1];
      item.type = "link";
      item.url = linkMatch[2];
    }
    stack[stack.length - 1].item.children!.push(item);
    stack.push({ level, item });
  };
  let sawTitle = false;
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const h = raw.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      if (h[1].length === 1 && !sawTitle && !root.text) {
        root.text = h[2].trim();
        sawTitle = true;
        stack.length = 1;
        continue;
      }
      push(h[1].length * 100, h[2].trim());
      continue;
    }
    const li = raw.match(/^(\s*)(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/);
    if (li) {
      const indent = li[1].replace(/\t/g, "    ").length;
      push(1000 + indent, li[2].trim());
      continue;
    }
    if (/^\s*\|/.test(raw)) continue; // tables inside lists are skipped on import
    // Plain paragraph: attach under current context.
    const text = raw.trim();
    if (!root.text && !sawTitle) {
      root.text = text;
      sawTitle = true;
      continue;
    }
    push(5000, text);
    stack.pop(); // paragraphs never become parents
  }
  if (!root.text) root.text = fallbackTitle;
  return noteFromOutline(root);
}

/** Indented plain text (tabs or 2+ spaces) → note. Used for paste. */
export function fromIndentedText(text: string): OutlineItem[] {
  const out: OutlineItem[] = [];
  const stack: { indent: number; item: OutlineItem }[] = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (!raw.trim()) continue;
    const indent = raw.match(/^\s*/)![0].replace(/\t/g, "  ").length;
    const clean = raw.trim().replace(/^(?:[-*+•]|\d+[.)])\s+/, "");
    const item: OutlineItem = { text: clean, children: [] };
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    if (stack.length) stack[stack.length - 1].item.children!.push(item);
    else out.push(item);
    stack.push({ indent, item });
  }
  return out;
}

export function download(filename: string, data: Blob | string, type = "text/plain") {
  const blob = typeof data === "string" ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(s: string) {
  return (s || "noodl").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80).trim() || "noodl";
}
