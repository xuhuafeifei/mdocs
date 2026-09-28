/**
 * 当前工作空间文档搜索浮层：⌘K / 侧栏按钮打开，防抖请求 search API，点击结果打开文档。
 */
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useI18n } from "../i18n";
import { searchDocumentsApi, type SearchResult } from "../services/endpoints";

const DEBOUNCE_MS = 280;

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
  domainId: string | null;
  onClose: () => void;
  onOpenDocument: (documentId: string) => void;
}) {
  const { t, lang } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqSeq = useRef(0);

  useEffect(() => {
    if (!props.open) return;
    setQuery("");
    setResults([]);
    setError(null);
    setLoading(false);
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        props.onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.onClose]);

  useEffect(() => {
    if (!props.open) return;
    const q = query.trim();
    if (!q || !props.domainId) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const seq = ++reqSeq.current;
    const timer = window.setTimeout(() => {
      void searchDocumentsApi({ query: q, domainId: props.domainId!, topN: 20 })
        .then((rows) => {
          if (seq !== reqSeq.current) return;
          setResults(rows);
          setLoading(false);
        })
        .catch((err) => {
          if (seq !== reqSeq.current) return;
          setResults([]);
          setLoading(false);
          setError(err instanceof Error ? err.message : t("docSearchFailed"));
        });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query, props.open, props.domainId, t]);

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
          {!props.domainId && (
            <p className="mdocs-doc-search-hint">{t("docSearchNoDomain")}</p>
          )}
          {props.domainId && !query.trim() && (
            <p className="mdocs-doc-search-hint">{t("docSearchEmptyHint")}</p>
          )}
          {loading && <p className="mdocs-doc-search-hint">{t("loading")}</p>}
          {error && <p className="mdocs-doc-search-error">{error}</p>}
          {!loading && !error && query.trim() && results.length === 0 && (
            <p className="mdocs-doc-search-hint">{t("docSearchNoResults")}</p>
          )}
          {results.map((row) => {
            const updated = formatSearchUpdatedAt(row.updatedAt, lang);
            const metaParts = [row.ownerVisitorName?.trim(), updated].filter(Boolean);
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
                <span className="mdocs-doc-search-row-title">{row.displayName}</span>
                {metaParts.length > 0 && (
                  <span className="mdocs-doc-search-row-meta">{metaParts.join(" · ")}</span>
                )}
                {row.relativePath && (
                  <span className="mdocs-doc-search-row-path">{row.relativePath}</span>
                )}
                {row.snippet && (
                  <span className="mdocs-doc-search-row-snippet">{row.snippet}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
