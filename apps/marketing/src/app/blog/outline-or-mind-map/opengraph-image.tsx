import { OG_CONTENT_TYPE, OG_SIZE, renderOg } from "@/lib/og";

export const dynamic = "force-static";
export const alt = "Outline or mind map? Use both";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOg({ title: "Outline or mind map? Use both", eyebrow: "Blog" });
}
