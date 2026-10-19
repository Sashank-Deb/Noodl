import { OG_CONTENT_TYPE, OG_SIZE, renderOg } from "@/lib/og";

export const dynamic = "force-static";
export const alt = "How AI typeahead works in noodl";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOg({ title: "How AI typeahead works, and what it sends", eyebrow: "Blog" });
}
