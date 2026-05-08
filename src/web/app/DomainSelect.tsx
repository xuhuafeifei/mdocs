/**
 * 域选择器（自定义下拉组件）
 * 替代原生 select，支持展示域名称本地化、私有域锁图标、无障碍属性。
 * 点击外部或按 Escape 自动关闭下拉菜单。
 */
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
  // ---- 下拉菜单是否打开 ----
  const [open, setOpen] = useState(false);

  // ---- 触发按钮引用（用于定位和焦点管理） ----
  const triggerRef = useRef<HTMLButtonElement>(null);

  // ---- 下拉菜单引用（用于点击外部关闭） ----
  const menuRef = useRef<HTMLDivElement>(null);

  // ---- 当前选中的域 ----
  const selected = domains.find((d) => d.domainId === value);

  // ---- 当前选中的是否是私有域（用于显示锁图标） ----
  const isPrivate = selected?.permission === "private";

  /**
   * 点击下拉外部时关闭菜单。
   */
  useEffect(() => {
    // 菜单未打开时不处理
    if (!open) return;
    const handler = (e: MouseEvent) => {
      // 如果点击位置既不在触发按钮内，也不在下拉菜单内，则关闭菜单
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    // 清理函数：移除监听
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  /**
   * 按 Escape 关闭菜单并将焦点移回触发按钮。
   */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        // 焦点移回触发按钮，方便键盘用户继续操作
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  /**
   * 选中域后回调并关闭下拉。
   */
  function handleSelect(domainId: string) {
    onChange(domainId);
    setOpen(false);
  }

  return (
    <div className="mdocs-domain-select-wrapper">
      {/* 触发按钮 */}
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
          {/* 显示本地化后的域名称 */}
          {selected ? localizeName(selected.domainName) : ""}
        </span>
        {/* 私有域显示锁图标 */}
        {isPrivate && (
          <svg className="mdocs-domain-lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mdocs-text-muted)" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        )}
        {/* 下拉箭头图标 */}
        <svg className={"mdocs-domain-select-chevron" + (open ? " open" : "")} width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="var(--mdocs-text-muted)" strokeWidth="1.5">
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>
      {/* 下拉菜单 */}
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
              {/* 选项中的私有域也显示锁图标 */}
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
