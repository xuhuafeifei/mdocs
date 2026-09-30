/**
 * 当前文档搜索浮层：⌘K / 侧栏按钮打开。
 * 工作空间默认「全部」（不传 domainId）；下拉列出当前访客可见的全部域。
 * 检索模式可选：默认（关键词+语义混合）/ 关键词 / 语义。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { useI18n } from "../i18n";
import { fetchDomainsSafe } from "../services/domainsBootstrap";
import { searchDocumentsApi, type SearchMode, type SearchResult } from "../services/endpoints";
import { localizeDomainName, translateError } from "./utils";
import type { DomainSummary } from "../../shared/types/domain";

const DEBOUNCE_MS = 280;
const ALL_DOMAINS = "";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 用服务端分词（tokens）把 text 中的命中片段包上 <mark>。
 * 长词优先，避免"密码找回"被"密码"提前吃掉后"找回"漏标。
 */
function highlight(text: string, tokens: string[]): React.ReactNode {
  const valid = Array.from(new Set(tokens.filter((w) => w.length > 0)))
    .sort((a, b) => b.length - a.length);
  if (valid.length === 0) return text;
  const re = new RegExp(valid.map(escapeRegExp).join("|"), "gi");
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<mark key={key++}>{m[0]}</mark>);
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function formatSearchUpdatedAt(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(lang === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DocSearchOverlay(props: {
  open: boolean;
  domains: DomainSummary[];
  /** 打开浮层 / 下拉时刷新域列表后回写 App */
  onDomainsChange?: (domains: DomainSummary[]) => void;
  onClose: () => void;
  onOpenDocument: (documentId: string) => void;
}) {
  const { t, lang } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const domainWrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [domainId, setDomainId] = useState(ALL_DOMAINS);
  const [mode, setMode] = useState<SearchMode>("auto");
  const [modelReady, setModelReady] = useState(true);
  const [domainOpen, setDomainOpen] = useState(false);
  const [domainFilter, setDomainFilter] = useState("");
  /** 展示用列表：打开浮层/下拉时刷新，平时跟随 props */
  const [domainList, setDomainList] = useState(props.domains);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [tokens, setTokens] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqSeq = useRef(0);

  useEffect(() => {
    setDomainList(props.domains);
  }, [props.domains]);

  const domainNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of domainList) {
      map.set(d.domainId, localizeDomainName(d.domainName, lang, t));
    }
    return map;
  }, [domainList, lang, t]);

  const filteredDomains = useMemo(() => {
    const q = domainFilter.trim().toLowerCase();
    if (!q) return domainList;
    return domainList.filter((d) => {
      const shown = localizeDomainName(d.domainName, lang, t).toLowerCase();
      return shown.includes(q) || d.domainName.toLowerCase().includes(q) || d.domainId.toLowerCase().includes(q);
    });
  }, [domainList, domainFilter, lang, t]);

  const selectedDomainLabel =
    domainId === ALL_DOMAINS
      ? t("docSearchAllDomains")
      : (domainNameById.get(domainId) ?? t("docSearchAllDomains"));

  function refreshDomains() {
    void fetchDomainsSafe().then((fresh) => {
      setDomainList(fresh);
      props.onDomainsChange?.(fresh);
    });
  }

  useEffect(() => {
    if (!props.open) return;
    setQuery("");
    setDomainId(ALL_DOMAINS);
    setDomainOpen(false);
    setDomainFilter("");
    setResults([]);
    setError(null);
    setLoading(false);
    refreshDomains();
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在打开时刷新域列表
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        if (domainOpen) {
          setDomainOpen(false);
          return;
        }
        props.onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.onClose, domainOpen]);

  useEffect(() => {
    if (!domainOpen) return;
    const onDown = (ev: MouseEvent) => {
      if (!domainWrapRef.current?.contains(ev.target as Node)) {
        setDomainOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [domainOpen]);

  useEffect(() => {
    if (!props.open) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const seq = ++reqSeq.current;
    const timer = window.setTimeout(() => {
      void searchDocumentsApi({
        query: q,
        mode,
        domainId: domainId || undefined,
        topN: 20,
      })
        .then((res) => {
          if (seq !== reqSeq.current) return;
          setResults(res.results);
          setModelReady(res.modelReady);
          setTokens(res.tokens ?? []);
          setLoading(false);
        })
        .catch((err) => {
          if (seq !== reqSeq.current) return;
          setResults([]);
          setModelReady(true);
          setTokens([]);
          setLoading(false);
          setError(translateError(t, err) || t("docSearchFailed"));
        });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query, props.open, domainId, mode, t]);

  if (!props.open) return null;

  return (
    <div
      className="mdocs-doc-search-backdrop"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) props.onClose();
      }}
    >
      <div
        className="mdocs-doc-search-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t("docSearchTitle")}
      >
        <div className="mdocs-doc-search-bar">
          <Search size={18} strokeWidth={1.75} aria-hidden />
          <input
            ref={inputRef}
            className="mdocs-doc-search-input"
            type="search"
            value={query}
            placeholder={t("docSearchPlaceholder")}
            aria-label={t("docSearchPlaceholder")}
            onChange={(ev) => setQuery(ev.target.value)}
          />
          <select
            className="mdocs-doc-search-mode"
            value={mode}
            aria-label={t("myDocumentsSearchMode")}
            onChange={(ev) => setMode(ev.target.value as SearchMode)}
          >
            <option value="auto">{t("myDocumentsModeAuto")}</option>
            <option value="keyword">{t("myDocumentsModeKeyword")}</option>
            <option value="semantic">{t("myDocumentsModeSemantic")}</option>
          </select>
          <div className="mdocs-doc-search-domain" ref={domainWrapRef}>
            <button
              type="button"
              className="mdocs-doc-search-domain-trigger"
              aria-label={t("docSearchDomainAria")}
              aria-expanded={domainOpen}
              aria-haspopup="listbox"
              onClick={() => {
                if (domainOpen) {
                  setDomainOpen(false);
                  return;
                }
                setDomainOpen(true);
                setDomainFilter("");
                refreshDomains();
              }}
            >
              <span className="mdocs-doc-search-domain-label">{selectedDomainLabel}</span>
              <ChevronDown size={14} strokeWidth={1.75} />
            </button>
            {domainOpen && (
              <div className="mdocs-doc-search-domain-menu" role="listbox" aria-label={t("docSearchDomainAria")}>
                <input
                  className="mdocs-doc-search-domain-filter"
                  type="search"
                  value={domainFilter}
                  placeholder={t("docSearchDomainFilter")}
                  aria-label={t("docSearchDomainFilter")}
                  autoFocus
                  onChange={(ev) => setDomainFilter(ev.target.value)}
                  onClick={(ev) => ev.stopPropagation()}
                />
                <button
                  type="button"
                  className={
                    "mdocs-doc-search-domain-option" + (domainId === ALL_DOMAINS ? " active" : "")
                  }
                  role="option"
                  aria-selected={domainId === ALL_DOMAINS}
                  onClick={() => {
                    setDomainId(ALL_DOMAINS);
                    setDomainOpen(false);
                  }}
                >
                  <span className="mdocs-doc-search-domain-option-name">{t("docSearchAllDomains")}</span>
                </button>
                {filteredDomains.map((d) => {
                  const name = localizeDomainName(d.domainName, lang, t);
                  const isPrivate = d.permission === "private";
                  return (
                    <button
                      key={d.domainId}
                      type="button"
                      className={
                        "mdocs-doc-search-domain-option" + (d.domainId === domainId ? " active" : "")
                      }
                      role="option"
                      aria-selected={d.domainId === domainId}
                      onClick={() => {
                        setDomainId(d.domainId);
                        setDomainOpen(false);
                      }}
                    >
                      <span className="mdocs-doc-search-domain-option-name">{name}</span>
                      {isPrivate ? (
                        <span className="mdocs-doc-search-domain-option-tag" aria-hidden>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                {filteredDomains.length === 0 && (
                  <p className="mdocs-doc-search-domain-empty">{t("docSearchDomainNoMatch")}</p>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            className="mdocs-doc-search-close"
            aria-label={t("close")}
            onClick={props.onClose}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="mdocs-doc-search-results">
          {!query.trim() && (
            <p className="mdocs-doc-search-hint">{t("docSearchEmptyHint")}</p>
          )}
          {loading && <p className="mdocs-doc-search-hint">{t("loading")}</p>}
          {error && <p className="mdocs-doc-search-error">{error}</p>}
          {!loading && !error && query.trim() && results.length === 0 && (
            <p className="mdocs-doc-search-hint">
              {mode === "semantic" && !modelReady ? t("myDocumentsSemanticNotReady") : t("docSearchNoResults")}
            </p>
          )}
          {results.map((row) => {
            const updated = formatSearchUpdatedAt(row.updatedAt, lang);
            const domainName = domainNameById.get(row.domainId);
            const metaParts = [
              domainName,
              row.ownerVisitorName?.trim(),
              updated,
            ].filter(Boolean);
            // 命中来源：回答"凭什么定位到这篇"——标题 / 正文 / 语义
            const sources: string[] = [];
            if (row.titleHit) sources.push(t("docSearchHitTitle"));
            if (row.bodyHit) sources.push(t("docSearchHitBody"));
            if (row.semanticHit) sources.push(t("docSearchHitSemantic"));
            return (
              <button
                key={row.documentId}
                type="button"
                className="mdocs-doc-search-row"
                onClick={() => {
                  props.onOpenDocument(row.documentId);
                  props.onClose();
                }}
              >
                <span className="mdocs-doc-search-row-head">
                  <span className="mdocs-doc-search-row-title">{highlight(row.displayName, tokens)}</span>
                  {sources.length > 0 && (
                    <span className="mdocs-doc-search-row-sources">
                      {sources.map((s) => (
                        <span key={s} className="mdocs-doc-search-row-source">{s}</span>
                      ))}
                    </span>
                  )}
                </span>
                {metaParts.length > 0 && (
                  <span className="mdocs-doc-search-row-meta">{metaParts.join(" · ")}</span>
                )}
                {row.relativePath && (
                  <span className="mdocs-doc-search-row-path">{highlight(row.relativePath, tokens)}</span>
                )}
                {row.snippet && (
                  <span className="mdocs-doc-search-row-snippet">{highlight(row.snippet, tokens)}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
