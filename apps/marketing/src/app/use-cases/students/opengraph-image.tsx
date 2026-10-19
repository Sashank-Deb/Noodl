import { OG_CONTENT_TYPE, OG_SIZE, renderOg } from "@/lib/og";

export const dynamic = "force-static";
export const alt = "noodl for students";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOg({ title: "Take notes as a list. Revise them as a map.", eyebrow: "For students" });
}
