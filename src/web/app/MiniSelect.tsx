/**
 * 通用小尺寸选择器（自定义下拉组件）
 * 适用于表格单元格等紧凑场景，如邀请权限下拉。
 */
import { useEffect, useRef, useState } from "react";

export interface MiniSelectOption {
  value: string;
  label: string;
}

interface MiniSelectProps {
  options: MiniSelectOption[];
  value: string;
  onChange: (value: string) => void;
}

export function MiniSelect({ options, value, onChange }: MiniSelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  /**
   * 点击下拉外部时关闭菜单。
   */
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

  /**
   * 按 Escape 关闭菜单。
   */
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

  function handleSelect(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div className="mdocs-mini-select" style={{ position: "relative" }}>
      {/* 触发按钮 */}
      <button
        ref={triggerRef}
        type="button"
        className="mdocs-mini-select-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{selected?.label}</span>
        <svg className={"mdocs-mini-select-chevron" + (open ? " open" : "")} width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>
      {/* 下拉菜单 */}
      {open && (
        <div ref={menuRef} className="mdocs-mini-select-menu card" role="listbox">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={"mdocs-mini-select-option" + (o.value === value ? " active" : "")}
              role="option"
              aria-selected={o.value === value}
              onClick={() => handleSelect(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
