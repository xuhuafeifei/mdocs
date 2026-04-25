import { useState } from "react";

export function VisitorRegisterDialog(props: {
  onSubmit: (visitorName: string) => Promise<void>;
  error: string | null;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setLocalError("please enter a name");
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      await props.onSubmit(trimmed);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const error = localError ?? props.error;

  return (
    <div className="mdocs-dialog-backdrop">
      <div className="mdocs-dialog card">
        <h1>Welcome to mdocs</h1>
        <p>
          Enter a display name to create a visitor identity. A secure token will
          be stored in this browser to identify you on future visits.
        </p>
        <form onSubmit={submit}>
          <input
            autoFocus
            placeholder="fgbg"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
          {error && <div className="mdocs-dialog-error">{error}</div>}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "creating..." : "Create visitor"}
          </button>
        </form>
      </div>
    </div>
  );
}
