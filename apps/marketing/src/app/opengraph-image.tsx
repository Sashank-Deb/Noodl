import { OG_CONTENT_TYPE, OG_SIZE, renderOg } from "@/lib/og";

export const dynamic = "force-static";
export const alt = "noodl: every note is a list and a map";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOg({ title: "Every note is a list and a map." });
}
