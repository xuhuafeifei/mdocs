/**
 * 域选择器（自定义下拉组件）
 * 替代原生 select，支持展示域名称本地化、私有域锁图标、无障碍属性。
 * 打开后可输入关键字过滤列表；点击外部或按 Escape 关闭。
 * 每次打开下拉时临时拉取最新域列表，避免设置页新建域后主页仍显示旧数据。
 *
 * 菜单 portal 到 body：DocChrome 顶栏 header-scroll 的 overflow-x 会裁 absolute 下拉。
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { DomainSummary } from "../../shared/types/domain";
import { useI18n } from "../i18n";
import { fetchDomainsSafe } from "../services/domainsBootstrap";

interface DomainSelectProps {
  domains: DomainSummary[];
  value: string;
  onChange: (domainId: string) => void;
  ariaLabel: string;
  localizeName: (name: string) => string;
  /** 拉取到最新域列表后回传给父组件（可选，用于同步 App 等上层状态） */
  onDomainsChange?: (domains: DomainSummary[]) => void;
}

export function DomainSelect({ domains, value, onChange, ariaLabel, localizeName, onDomainsChange }: DomainSelectProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(domains);
  const [query, setQuery] = useState("");
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setList(domains);
  }, [domains]);

  const selected = list.find((d) => d.domainId === value);
  const isPrivate = selected?.permission === "private";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((d) => {
      const shown = localizeName(d.domainName).toLowerCase();
      return shown.includes(q) || d.domainName.toLowerCase().includes(q);
    });
  }, [list, query, localizeName]);

  function closeMenu() {
    setOpen(false);
    setQuery("");
    setMenuStyle(null);
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const minWidth = Math.max(220, r.width);
      let left = r.left;
      if (left + minWidth > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - minWidth - 8);
      }
      setMenuStyle({
        position: "fixed",
        top: r.bottom + 4,
        left,
        width: minWidth,
        zIndex: 12000,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // 打开后聚焦搜索框，便于直接输入定位
    searchRef.current?.focus();
  }, [open]);

  function handleSelect(domainId: string) {
    onChange(domainId);
    closeMenu();
  }

  function handleTriggerClick() {
    if (open) {
      closeMenu();
      return;
    }
    setOpen(true);
    setQuery("");
    void fetchDomainsSafe().then((fresh) => {
      setList(fresh);
      onDomainsChange?.(fresh);
    });
  }

  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && filtered.length === 1) {
      e.preventDefault();
      handleSelect(filtered[0].domainId);
    }
  }

  const menu =
    open && menuStyle ? (
      <div
        ref={menuRef}
        className="mdocs-domain-select-menu mdocs-domain-select-menu--portal card"
        role="listbox"
        aria-label={ariaLabel}
        style={menuStyle}
      >
        <div className="mdocs-domain-select-search">
          <input
            ref={searchRef}
            type="search"
            className="mdocs-domain-select-search-input"
            value={query}
            placeholder={t("domainSearchPlaceholder")}
            aria-label={t("domainSearchPlaceholder")}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="mdocs-domain-select-options">
          {filtered.length === 0 ? (
            <div className="mdocs-domain-select-empty muted">{t("domainNoMatch")}</div>
          ) : (
            filtered.map((d) => (
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
            ))
          )}
        </div>
      </div>
    ) : null;

  return (
    <div className="mdocs-domain-select-wrapper">
      <button
        ref={triggerRef}
        type="button"
        className="mdocs-domain-select-trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={handleTriggerClick}
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
      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
