/**
 * 设置页：语义索引管理——antd Table（文章查询 / 筛选 / 排序 / 分页）+ 勾选重建。
 * 搜索两档：关键词（标题/路径/ID 字面过滤）、语义（/search semantic 模式向量召回，可读权限内）。
 * antd 单独 ConfigProvider，对齐 mdocs 绿色主题（勿吃 lobe 默认黑/蓝）。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, ConfigProvider, Input, InputNumber, Segmented, Space, Table, Tag, theme as antdTheme } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { useI18n } from "../i18n";
import {
  fetchEmbeddingIndexApi,
  rebuildEmbeddingIndexApi,
  searchDocumentsApi,
  type EmbeddingIndexRow,
} from "../services/endpoints";
import { localizeDomainName, translateError } from "./utils";

/** 表格行 = 索引状态行 + 语义命中附带的摘要；语义命中可能不在已加载列表内（超出 500 上限） */
type PanelRow = EmbeddingIndexRow & { snippet?: string; chunkUnknown?: boolean };

/** 与 `src/web/styles/global.css` 中 --mdocs-accent 等一致 */
const MDOCS_ANTD_THEME = {
  algorithm: antdTheme.defaultAlgorithm,
  token: {
    colorPrimary: "#4CAF50",
    colorLink: "#4CAF50",
    colorInfo: "#4CAF50",
    colorSuccess: "#66BB6A",
    colorBgBase: "#ffffff",
    colorBgContainer: "#ffffff",
    colorText: "#212121",
    colorTextSecondary: "#616161",
    colorBorder: "#E0E0E0",
    colorFillSecondary: "#E8F5E9",
    borderRadius: 8,
    fontFamily: "inherit",
  },
  components: {
    Table: {
      headerBg: "#F5F5F5",
      headerColor: "#212121",
      rowHoverBg: "#E8F5E9",
      borderColor: "#E0E0E0",
    },
    Button: {
      primaryShadow: "none",
    },
    Tag: {
      defaultBg: "#F5F5F5",
      defaultColor: "#616161",
    },
  },
};

function formatTs(iso: string | null, lang: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(lang === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EmbeddingIndexPanel(props: {
  onOpenDocument: (documentId: string) => void;
}) {
  const { t, lang } = useI18n();
  const [loading, setLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [items, setItems] = useState<EmbeddingIndexRow[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [searchMode, setSearchMode] = useState<"keyword" | "semantic">("keyword");
  const [semanticRows, setSemanticRows] = useState<PanelRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchSeq = useRef(0);
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 20,
  });
  /** 筛选/排序后的行数（分页 total） */
  const [filteredTotal, setFilteredTotal] = useState(0);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEmbeddingIndexApi();
      setModelReady(data.modelReady);
      setItems(data.items);
      setSelectedKeys([]);
      setFilteredTotal(data.items.length);
      setPagination((p) => ({ ...p, current: 1 }));
    } catch (err) {
      setError(translateError(t, err) || t("embeddingIndexLoadFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 初次挂载
  }, []);

  const domainFilters = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of items) {
      if (!map.has(row.domainId)) {
        map.set(row.domainId, localizeDomainName(row.domainName, lang, t));
      }
    }
    return Array.from(map.entries()).map(([value, text]) => ({ text, value }));
  }, [items, lang, t]);

  /** 文章查询（关键词档）：按标题 / 路径 / ID 即时过滤（与列筛选叠加） */
  const visibleItems = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) =>
      (row.displayName || "").toLowerCase().includes(q) ||
      (row.relativePath || "").toLowerCase().includes(q) ||
      row.documentId.toLowerCase().includes(q),
    );
  }, [items, searchText]);

  /** 语义档是否生效：语义模式 + 有搜索词 */
  const semanticActive = searchMode === "semantic" && !!searchText.trim();

  /** 语义档查询：防抖 300ms 走 /search（mode=semantic，权限与读取一致） */
  useEffect(() => {
    if (searchMode !== "semantic") return;
    const q = searchText.trim();
    if (!q) {
      searchSeq.current += 1;
      setSemanticRows(null);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await searchDocumentsApi({ query: q, mode: "semantic", topN: 50 });
          if (seq !== searchSeq.current) return;
          const byId = new Map(items.map((r) => [r.documentId, r]));
          setSemanticRows(
            res.results.map((r): PanelRow => {
              const base = byId.get(r.documentId);
              // 已在状态列表里：沿用精确 chunk 统计；不在（超出 500 上限）也必然已建索引（向量命中即有 chunk）
              if (base) return { ...base, snippet: r.snippet };
              return {
                documentId: r.documentId,
                displayName: r.displayName,
                relativePath: r.relativePath,
                domainId: r.domainId,
                domainName: r.domainId,
                documentUpdatedAt: r.updatedAt,
                chunkCount: 0,
                chunkUnknown: true,
                embeddingUpdatedAt: null,
                snippet: r.snippet,
              };
            }),
          );
        } catch {
          if (seq === searchSeq.current) setSemanticRows([]);
        } finally {
          if (seq === searchSeq.current) setSearching(false);
        }
      })();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchMode, searchText, items]);

  /** 表格数据：语义档显示命中行，否则显示关键词过滤后的状态列表 */
  const tableRows: PanelRow[] = semanticActive ? (semanticRows ?? []) : visibleItems;

  // 数据集变化 / 模式切换 → 计数同步 + 回到第一页（列筛选的总数仍由 Table onChange 回写）
  useEffect(() => {
    setFilteredTotal(tableRows.length);
    setPagination((p) => ({ ...p, current: 1 }));
  }, [tableRows.length, searchMode]);

  const columns: ColumnsType<PanelRow> = useMemo(
    () => [
      {
        title: t("myDocumentsColTitle"),
        dataIndex: "displayName",
        key: "displayName",
        ellipsis: true,
        sorter: (a, b) =>
          (a.displayName || a.relativePath).localeCompare(b.displayName || b.relativePath, lang === "zh" ? "zh" : "en"),
        render: (_v, row) => (
          <div style={{ minWidth: 0 }}>
            <button
              type="button"
              className="mdocs-linkish"
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontWeight: 500,
                color: "inherit",
                textAlign: "left",
              }}
              onClick={() => props.onOpenDocument(row.documentId)}
            >
              {row.displayName || row.relativePath || "Untitled"}
            </button>
            {row.snippet && (
              <div className="mdocs-embedding-index-snippet" title={row.snippet}>
                {row.snippet}
              </div>
            )}
          </div>
        ),
      },
      {
        title: t("myDocumentsColDomain"),
        dataIndex: "domainId",
        key: "domainId",
        width: 160,
        ellipsis: true,
        filters: domainFilters,
        onFilter: (value, row) => row.domainId === value,
        sorter: (a, b) =>
          localizeDomainName(a.domainName, lang, t).localeCompare(
            localizeDomainName(b.domainName, lang, t),
            lang === "zh" ? "zh" : "en",
          ),
        render: (_v, row) => localizeDomainName(row.domainName, lang, t),
      },
      {
        title: t("embeddingIndexColDocUpdated"),
        dataIndex: "documentUpdatedAt",
        key: "documentUpdatedAt",
        width: 160,
        sorter: (a, b) =>
          new Date(a.documentUpdatedAt).getTime() - new Date(b.documentUpdatedAt).getTime(),
        defaultSortOrder: "descend",
        render: (v: string) => formatTs(v, lang),
      },
      {
        title: t("embeddingIndexColStatus"),
        dataIndex: "chunkCount",
        key: "buildStatus",
        width: 140,
        filters: [
          { text: t("embeddingIndexFilterBuilt"), value: "built" },
          { text: t("embeddingIndexFilterMissing"), value: "missing" },
        ],
        onFilter: (value, row) =>
          value === "built" ? row.chunkCount > 0 : row.chunkCount === 0,
        sorter: (a, b) => a.chunkCount - b.chunkCount,
        render: (count: number, row) => {
          if (row.chunkUnknown) {
            // 语义命中但不在已加载状态列表内：必然已建索引，仅无精确块数
            return <Tag color="success">{t("embeddingIndexStatusBuiltUnknown")}</Tag>;
          }
          return count > 0 ? (
            <Tag color="success">{t("embeddingIndexStatusReady", { chunks: String(count) })}</Tag>
          ) : (
            <Tag>{t("embeddingIndexStatusMissing")}</Tag>
          );
        },
      },
      {
        title: t("embeddingIndexColBuiltAt"),
        dataIndex: "embeddingUpdatedAt",
        key: "embeddingUpdatedAt",
        width: 160,
        sorter: (a, b) => {
          const ta = a.embeddingUpdatedAt ? new Date(a.embeddingUpdatedAt).getTime() : 0;
          const tb = b.embeddingUpdatedAt ? new Date(b.embeddingUpdatedAt).getTime() : 0;
          return ta - tb;
        },
        render: (v: string | null) => formatTs(v, lang),
      },
    ],
    [domainFilters, lang, props, t],
  );

  async function handleRebuild() {
    const ids = selectedKeys.map(String);
    if (ids.length === 0) return;
    setRebuilding(true);
    setMessage(null);
    setError(null);
    try {
      const data = await rebuildEmbeddingIndexApi(ids);
      setModelReady(data.modelReady);
      setMessage(
        t("embeddingIndexRebuildResult", {
          ok: String(data.ok.length),
          skipped: String(data.skipped.length),
          failed: String(data.failed.length),
        }),
      );
      await load();
    } catch (err) {
      setError(translateError(t, err) || t("embeddingIndexRebuildFailed"));
    } finally {
      setRebuilding(false);
    }
  }

  return (
    <ConfigProvider theme={MDOCS_ANTD_THEME}>
      <div className="mdocs-settings mdocs-embedding-index">
        <div className="mdocs-settings-header">
          <h2 className="mdocs-settings-title">{t("embeddingIndex")}</h2>
        </div>
        <div className="mdocs-settings-card">
          <p className="muted" style={{ marginTop: 0 }}>
            {t("embeddingIndexDesc")}
          </p>
          <p style={{ margin: "0 0 12px", fontSize: 13 }}>
            {t("embeddingIndexModel")}:{" "}
            <strong>{modelReady ? t("embeddingIndexModelReady") : t("embeddingIndexModelPending")}</strong>
          </p>

          <Space wrap style={{ marginBottom: 12 }}>
            <Segmented
              value={searchMode}
              aria-label={t("myDocumentsSearchMode")}
              onChange={(v) => setSearchMode(v as "keyword" | "semantic")}
              options={[
                { label: t("myDocumentsModeKeyword"), value: "keyword" },
                { label: t("myDocumentsModeSemantic"), value: "semantic" },
              ]}
            />
            <Input.Search
              allowClear
              placeholder={
                searchMode === "semantic"
                  ? t("embeddingIndexSearchSemanticPlaceholder")
                  : t("embeddingIndexSearchPlaceholder")
              }
              aria-label={
                searchMode === "semantic"
                  ? t("embeddingIndexSearchSemanticPlaceholder")
                  : t("embeddingIndexSearchPlaceholder")
              }
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 240 }}
              disabled={loading || rebuilding}
            />
            <Button onClick={() => void load()} disabled={loading || rebuilding}>
              {t("embeddingIndexRefresh")}
            </Button>
            <Button
              type="primary"
              onClick={() => void handleRebuild()}
              disabled={rebuilding || selectedKeys.length === 0}
              loading={rebuilding}
            >
              {t("embeddingIndexRebuildSelected", { count: String(selectedKeys.length) })}
            </Button>
          </Space>

          {message && <p style={{ fontSize: 13, color: "var(--mdocs-text-muted)" }}>{message}</p>}
          {error && <p className="mdocs-doc-search-error" style={{ marginBottom: 8 }}>{error}</p>}
          {semanticActive && !modelReady && (
            <p className="muted" style={{ margin: "0 0 8px", fontSize: 13 }}>
              {t("myDocumentsSemanticNotReady")}
            </p>
          )}

          {(() => {
            const pageSize = Number(pagination.pageSize) || 20;
            const current = Number(pagination.current) || 1;
            const total = filteredTotal;
            const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

            return (
              <Table<PanelRow>
                size="small"
                rowKey="documentId"
                loading={loading || (semanticActive && searching)}
                columns={columns}
                dataSource={tableRows}
                rowSelection={{
                  selectedRowKeys: selectedKeys,
                  onChange: (keys) => setSelectedKeys(keys),
                }}
                pagination={{
                  current,
                  pageSize,
                  total,
                  showSizeChanger: false,
                  showQuickJumper: false,
                  showTotal: (tot, range) =>
                    t("embeddingIndexPageTotal", {
                      from: String(range[0] ?? 0),
                      to: String(range[1] ?? 0),
                      total: String(tot),
                    }),
                }}
                onChange={(pag, _filters, _sorter, extra) => {
                  const nextSize = pag.pageSize ?? pageSize;
                  const nextTotal = extra.currentDataSource.length;
                  const nextPages = Math.max(1, Math.ceil(nextTotal / nextSize) || 1);
                  let nextCurrent = pag.current ?? 1;
                  if (nextCurrent > nextPages) nextCurrent = nextPages;
                  setFilteredTotal(nextTotal);
                  setPagination({
                    current: nextCurrent,
                    pageSize: nextSize,
                  });
                }}
                locale={{
                  emptyText: searchText.trim()
                    ? t("myDocumentsNoMatch")
                    : t("embeddingIndexEmpty"),
                  filterReset: t("embeddingIndexFilterReset"),
                  filterConfirm: t("embeddingIndexFilterOk"),
                }}
                scroll={{ x: 900 }}
                footer={() => (
                  <div
                    className="mdocs-embedding-index-pager"
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 13 }}>{t("embeddingIndexPageSize")}</span>
                    <InputNumber
                      size="small"
                      min={5}
                      max={200}
                      step={5}
                      value={pageSize}
                      controls
                      changeOnWheel
                      disabled={loading || rebuilding}
                      aria-label={t("embeddingIndexPageSize")}
                      onChange={(v) => {
                        if (v == null || !Number.isFinite(Number(v))) return;
                        const size = Math.min(200, Math.max(5, Math.floor(Number(v))));
                        setPagination({ current: 1, pageSize: size });
                      }}
                    />
                    <span style={{ fontSize: 13 }}>{t("embeddingIndexGoPage")}</span>
                    <InputNumber
                      size="small"
                      min={1}
                      max={totalPages}
                      step={1}
                      value={Math.min(current, totalPages)}
                      controls
                      changeOnWheel
                      disabled={loading || rebuilding || total === 0}
                      aria-label={t("embeddingIndexGoPage")}
                      onChange={(v) => {
                        if (v == null || !Number.isFinite(Number(v))) return;
                        const page = Math.min(totalPages, Math.max(1, Math.floor(Number(v))));
                        setPagination((p) => ({ ...p, current: page }));
                      }}
                    />
                    <span style={{ fontSize: 13, color: "var(--mdocs-text-muted)" }}>
                      / {totalPages}
                    </span>
                  </div>
                )}
              />
            );
          })()}
        </div>
      </div>
    </ConfigProvider>
  );
}
