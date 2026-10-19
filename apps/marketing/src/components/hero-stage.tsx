import type { CSSProperties } from "react";
import { MapIcon, OutlineIcon } from "./icons";

/**
 * Hero product visual, pure HTML/CSS/SVG: the same note as an outline card and
 * as a mind map (DESIGN.md §6 node anatomy, §7 layout), with an editing node
 * showing ghost text and the grape Tab chip. Mobile: swipeable pair.
 */

const b = (n: number) => ({ "--b": `var(--branch-${n})` }) as CSSProperties;

const WIRES: { d: string; branch: number; w: number }[] = [
  { d: "M162 154C190 154 190 48 218 48", branch: 1, w: 3 },
  { d: "M162 154C190 154 190 144 218 144", branch: 2, w: 3 },
  { d: "M162 154C190 154 190 261 218 261", branch: 3, w: 3 },
  { d: "M296 48C318 48 318 42 340 42", branch: 1, w: 2 },
  { d: "M296 48C318 48 318 82 340 82", branch: 1, w: 2 },
  { d: "M304 144C326 144 326 138 348 138", branch: 2, w: 2 },
  { d: "M304 144C326 144 326 178 348 178", branch: 2, w: 2 },
  { d: "M288 261C310 261 310 234 332 234", branch: 3, w: 2 },
  { d: "M288 261C310 261 310 274 332 274", branch: 3, w: 2 },
  { d: "M288 261C310 261 310 302 332 302", branch: 3, w: 2 },
];

export function MapWorld() {
  return (
    <div className="map-frame">
      <div className="map-world">
        <svg className="wires" width="530" height="330" viewBox="0 0 530 330" aria-hidden="true">
          {WIRES.map((w) => (
            <path key={w.d} d={w.d} style={{ stroke: `var(--branch-${w.branch})`, strokeWidth: w.w }} />
          ))}
        </svg>
        <div className="n n-root" style={{ left: 0, top: 130, width: 162 }}>
          Heat islands
        </div>
        <div className="n n-l1" style={{ left: 218, top: 30, width: 78, ...b(1) }}>
          Causes
        </div>
        <div className="n n-leaf" style={{ left: 340, top: 13, ...b(1) }}>
          Asphalt and dark roofs
        </div>
        <div className="n n-leaf" style={{ left: 340, top: 53, ...b(1) }}>
          Lost tree cover
        </div>
        <div className="n n-l1" style={{ left: 218, top: 126, width: 86, ...b(2) }}>
          Effects
        </div>
        <div className="n n-leaf" style={{ left: 348, top: 109, ...b(2) }}>
          Hotter nights
        </div>
        <div className="n n-leaf" style={{ left: 348, top: 149, ...b(2) }}>
          Heat-related illness
        </div>
        <div className="n n-l1" style={{ left: 218, top: 243, width: 70, ...b(3) }}>
          Fixes
        </div>
        <div className="n n-leaf" style={{ left: 332, top: 205, ...b(3) }}>
          Cool roofs
        </div>
        <div className="n n-leaf" style={{ left: 332, top: 245, ...b(3) }}>
          Street trees
        </div>
        <div className="n n-edit" style={{ left: 332, top: 285, ...b(3) }}>
          <span>Pocket par</span>
          <span className="caret" />
          <span className="ghost">ks</span>
          <span className="kbd kbd-ai">Tab</span>
        </div>
      </div>
    </div>
  );
}

export function OutlineCard({ editing = false }: { editing?: boolean }) {
  return (
    <div className="outline-card">
      <div className="ho-title">Heat islands</div>
      <div className="ho-row">
        <i className="dot" style={{ background: "var(--branch-1)" }} />
        Causes
      </div>
      <div className="ho-row ho-2">Asphalt and dark roofs</div>
      <div className="ho-row ho-2">Lost tree cover</div>
      <div className="ho-row">
        <i className="dot" style={{ background: "var(--branch-2)" }} />
        Effects
      </div>
      <div className="ho-row ho-2">Hotter nights</div>
      <div className="ho-row ho-2">Heat-related illness</div>
      <div className="ho-row">
        <i className="dot" style={{ background: "var(--branch-3)" }} />
        Fixes
      </div>
      <div className="ho-row ho-2">Cool roofs</div>
      <div className="ho-row ho-2">Street trees</div>
      {editing ? (
        <div className="ho-row ho-2">
          <span className="text-foreground">Pocket par</span>
          <span className="ghost -ml-2">ks</span>
        </div>
      ) : null}
    </div>
  );
}

export function StageToggle({ active }: { active: "outline" | "map" }) {
  return (
    <div className="seg stage-toggle" aria-hidden="true">
      <span className={`seg-item${active === "outline" ? " on" : ""}`}>
        <OutlineIcon size={15} />
        Outline
      </span>
      <span className={`seg-item${active === "map" ? " on" : ""}`}>
        <MapIcon size={15} />
        Mind map
      </span>
    </div>
  );
}

export function HeroStage() {
  return (
    <figure className="stage-hero">
      <div
        className="stage canvas-surface hero-stage"
        role="region"
        aria-label="Product preview"
        tabIndex={0}
      >
        <p className="sr-only">
          A note called Heat islands shown twice: as an outline with the branches Causes, Effects and Fixes, and as
          a mind map of the same nodes. The node being typed reads “Pocket par”, with the suggested ending “ks” shown
          as grey ghost text and a Tab key hint to accept it.
        </p>
        <StageToggle active="map" />
        <div className="panel" aria-hidden="true">
          <OutlineCard />
        </div>
        <svg
          className="hero-arrow"
          width="120"
          height="80"
          viewBox="0 0 120 80"
          aria-hidden="true"
        >
          <path
            d="M6 14c34-10 70 0 92 40"
            fill="none"
            style={{ stroke: "var(--muted-foreground)" }}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray="2 6"
          />
          <path
            d="M90 50l9 6 2-11"
            fill="none"
            style={{ stroke: "var(--muted-foreground)" }}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="panel" aria-hidden="true">
          <MapWorld />
        </div>
      </div>
      <figcaption className="swipe-hint" aria-hidden="true">
        Swipe to see the same note as a map
      </figcaption>
    </figure>
  );
}
