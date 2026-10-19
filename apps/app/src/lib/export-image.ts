/** Map → PNG / JPEG / PDF, rendered in the browser (no server). */
import type { Note } from "./types";
import { download, safeFilename } from "./io";

async function renderMap(el: HTMLElement, type: "png" | "jpeg", scale: number, background?: string) {
  const { toPng, toJpeg } = await import("html-to-image");
  const bg = background ?? getComputedStyle(document.querySelector(".map-canvas") ?? document.body).backgroundColor;
  const opts = {
    pixelRatio: scale,
    width: el.offsetWidth,
    height: el.offsetHeight,
    backgroundColor: type === "jpeg" || background !== "transparent" ? bg : undefined,
    cacheBust: true,
    // Collapse toggles / UI chrome aren't part of the picture.
    filter: (node: HTMLElement) => !(node instanceof HTMLElement && node.dataset?.mapUi !== undefined),
  };
  return type === "png" ? toPng(el, opts) : toJpeg(el, { ...opts, quality: 0.92 });
}

export async function exportImage(el: HTMLElement, note: Note, type: "png" | "jpeg", scale = 2, transparent = false) {
  const url = await renderMap(el, type, scale, transparent ? "transparent" : undefined);
  const blob = await (await fetch(url)).blob();
  download(`${safeFilename(note.title)}.${type === "png" ? "png" : "jpg"}`, blob);
}

/** One-page PDF; the map is scaled to fit an A4 page in the best orientation. */
export async function exportPDF(el: HTMLElement, note: Note) {
  const url = await renderMap(el, "jpeg", 2, "#ffffff");
  const { jsPDF } = await import("jspdf");
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
  const landscape = img.width >= img.height;
  const pdf = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "pt", format: "a4" });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const margin = 28;
  pdf.setFontSize(14);
  pdf.text(note.title, margin, margin + 6);
  const top = margin + 20;
  const k = Math.min((pw - margin * 2) / img.width, (ph - top - margin) / img.height);
  const w = img.width * k;
  const h = img.height * k;
  pdf.addImage(url, "JPEG", (pw - w) / 2, top + (ph - top - margin - h) / 2, w, h);
  pdf.save(`${safeFilename(note.title)}.pdf`);
}
