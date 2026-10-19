import { OG_CONTENT_TYPE, OG_SIZE, renderOg } from "@/lib/og";

export const dynamic = "force-static";
export const alt = "noodl for writers";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOg({ title: "Plot, characters and scenes in one tree.", eyebrow: "For writers" });
}
