import { Link } from "react-router-dom";

import PlaygroundEditor from "./PlaygroundEditor";

/**
 * Standalone Lobe Editor “Playground” demo (equivalent to lobe-editor docs playground).
 * Open: /playground
 */
export function PlaygroundPage() {
  return (
    <div className="mdocs-playground-page">
      <header className="mdocs-playground-header">
        <Link className="mdocs-playground-back" to="/">
          ← mdocs
        </Link>
      </header>
      <PlaygroundEditor />
    </div>
  );
}
