/**
 * 设置页：语义索引管理——antd Table（筛选 / 排序 / 分页）+ 勾选重建。
 * antd 单独 ConfigProvider，对齐 mdocs 绿色主题（勿吃 lobe 默认黑/蓝）。
 */
import { useEffect, useMemo, useState } from "react";
import { Button, ConfigProvider, Input, InputNumber, Space, Table, Tag, theme as antdTheme } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { useI18n } from "../i18n";
import {
  fetchEmbeddingIndexApi,
  rebuildEmbeddingIndexApi,
  type EmbeddingIndexRow,
} from "../services/endpoints";
import { localizeDomainName, translateError } from "./utils";

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

  /** 文章查询：按标题 / 路径即时过滤（与列筛选同在客户端，叠加生效） */
  const visibleItems = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) =>
      (row.displayName || "").toLowerCase().includes(q) ||
      (row.relativePath || "").toLowerCase().includes(q) ||
      row.documentId.toLowerCase().includes(q),
    );
  }, [items, searchText]);

  // 搜索词变化 → 计数同步 + 回到第一页（列筛选的总数仍由 Table onChange 回写）
  useEffect(() => {
    setFilteredTotal(visibleItems.length);
    setPagination((p) => ({ ...p, current: 1 }));
  }, [visibleItems.length]);

  const columns: ColumnsType<EmbeddingIndexRow> = useMemo(
    () => [
      {
        title: t("myDocumentsColTitle"),
        dataIndex: "displayName",
        key: "displayName",
        ellipsis: true,
        sorter: (a, b) =>
          (a.displayName || a.relativePath).localeCompare(b.displayName || b.relativePath, lang === "zh" ? "zh" : "en"),
        render: (_v, row) => (
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
        render: (count: number) =>
          count > 0 ? (
            <Tag color="success">{t("embeddingIndexStatusReady", { chunks: String(count) })}</Tag>
          ) : (
            <Tag>{t("embeddingIndexStatusMissing")}</Tag>
          ),
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
            <Input.Search
              allowClear
              placeholder={t("embeddingIndexSearchPlaceholder")}
              aria-label={t("embeddingIndexSearchPlaceholder")}
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

          {(() => {
            const pageSize = Number(pagination.pageSize) || 20;
            const current = Number(pagination.current) || 1;
            const total = filteredTotal;
            const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

            return (
              <Table<EmbeddingIndexRow>
                size="small"
                rowKey="documentId"
                loading={loading}
                columns={columns}
                dataSource={visibleItems}
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
