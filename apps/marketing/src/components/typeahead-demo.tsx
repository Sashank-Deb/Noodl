import { FileIcon, SparkleIcon, WifiOffIcon } from "./icons";

/**
 * Static rendering of the typeahead dropdown (DESIGN.md §8): online with AI
 * suggestions, and offline with matches from the user's own notes.
 * Decorative; the surrounding section explains it in text.
 */
function Foot() {
  return (
    <div className="ta-foot">
      <span>
        <span className="kbd">↑</span>
        <span className="kbd">↓</span>choose
      </span>
      <span>
        <span className="kbd">⏎</span>insert
      </span>
      <span>
        <span className="kbd kbd-ai">Tab</span>accept
      </span>
      <span>
        <span className="kbd">Esc</span>close
      </span>
    </div>
  );
}

function Node() {
  return (
    <div className="ta-node">
      <span>Pocket par</span>
      <span className="caret" />
      <span className="ghost">ks</span>
      <span className="kbd kbd-ai">Tab</span>
    </div>
  );
}

export function TypeaheadDemo() {
  return (
    <div className="stage canvas-surface ta-stage" aria-hidden="true">
      <div className="ta-col">
        <p className="ta-label">Online, AI on</p>
        <Node />
        <div className="ta-pop">
          <div className="ta-head ai">
            <SparkleIcon size={14} />
            Suggestions from Fixes and 2 siblings
          </div>
          <div className="ta-item on">
            <span>
              Pocket par<b>ks</b>
            </span>
          </div>
          <div className="ta-item">
            <span>
              Pocket par<b>ks on vacant lots</b>
            </span>
          </div>
          <div className="ta-item">
            <span>
              Pocket par<b>k shade targets</b>
            </span>
          </div>
          <div className="ta-item">
            <FileIcon size={14} />
            <span>Park cooling study</span>
            <span className="ta-src">Geography 2</span>
          </div>
          <Foot />
        </div>
      </div>
      <div className="ta-col">
        <p className="ta-label">Offline, or AI off</p>
        <Node />
        <div className="ta-pop">
          <div className="ta-head">
            <WifiOffIcon size={14} />
            Offline. Showing matches from your notes
          </div>
          <div className="ta-item on">
            <FileIcon size={14} />
            <span>
              Pocket par<b>ks</b>
            </span>
            <span className="ta-src">City trip</span>
          </div>
          <div className="ta-item">
            <FileIcon size={14} />
            <span>
              Pocket par<b>k survey</b>
            </span>
            <span className="ta-src">Geography 2</span>
          </div>
          <Foot />
        </div>
      </div>
    </div>
  );
}
