import { useEffect, useRef, useState } from "react";
import type { DomainSummary } from "../../shared/types/domain";

interface DomainSelectProps {
  domains: DomainSummary[];
  value: string;
  onChange: (domainId: string) => void;
  ariaLabel: string;
  localizeName: (name: string) => string;
}

export function DomainSelect({ domains, value, onChange, ariaLabel, localizeName }: DomainSelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = domains.find((d) => d.domainId === value);
  const isPrivate = selected?.permission === "private";

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  function handleSelect(domainId: string) {
    onChange(domainId);
    setOpen(false);
  }

  return (
    <div className="mdocs-domain-select-wrapper">
      <button
        ref={triggerRef}
        type="button"
        className="mdocs-domain-select-trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="mdocs-domain-select-text">
          {selected ? localizeName(selected.domainName) : ""}
        </span>
        {isPrivate && (
          <svg className="mdocs-domain-lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mdocs-text-muted)" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        )}
        <svg className={"mdocs-domain-select-chevron" + (open ? " open" : "")} width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="var(--mdocs-text-muted)" strokeWidth="1.5">
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div ref={menuRef} className="mdocs-domain-select-menu card" role="listbox" aria-label={ariaLabel}>
          {domains.map((d) => (
            <button
              key={d.domainId}
              type="button"
              className={"mdocs-domain-select-option" + (d.domainId === value ? " active" : "")}
              role="option"
              aria-selected={d.domainId === value}
              onClick={() => handleSelect(d.domainId)}
            >
              <span>{localizeName(d.domainName)}</span>
              {d.permission === "private" && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--mdocs-text-muted)" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
