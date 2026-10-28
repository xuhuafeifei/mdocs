/**
 * 设置页：通用 HTTP MCP 服务器配置。不内置某个具体产品的模板。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import {
  fetchMcpServersApi,
  saveMcpServersApi,
  testMcpServerApi,
  type McpServerConfig,
  type McpToolSummary,
} from "../services/endpoints";
import { ApiRequestError } from "../services/api-request-error";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `mcp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function headersToText(headers?: Record<string, string>): string {
  if (!headers || Object.keys(headers).length === 0) return "";
  return JSON.stringify(headers, null, 2);
}

function parseHeadersJson(raw: string): Record<string, string> | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const parsed = JSON.parse(t) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("headers must be a JSON object");
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v !== "string") {
      throw new Error(`header ${k} must be a string`);
    }
    out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export function McpServersPanel() {
  const { t } = useI18n();
  const mountedRef = useRef(true);
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [headersDraft, setHeadersDraft] = useState<Record<string, string>>({});
  const [testBusyId, setTestBusyId] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<Record<string, string>>({});

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMcpServersApi();
      if (!mountedRef.current) return;
      setServers(data.servers);
      const drafts: Record<string, string> = {};
      for (const s of data.servers) {
        drafts[s.id] = headersToText(s.headers);
      }
      setHeadersDraft(drafts);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updateServer(id: string, patch: Partial<McpServerConfig>) {
    setServers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
    setSaved(false);
  }

  function addServer() {
    const id = newId();
    const base = {
      name: "",
      enabled: true,
      transport: "http" as const,
      url: "",
    };
    setServers((prev) => [...prev, { ...base, id }]);
    setHeadersDraft((prev) => ({
      ...prev,
      [id]: headersToText(base.headers),
    }));
    setSaved(false);
  }

  function removeServer(id: string) {
    setServers((prev) => prev.filter((s) => s.id !== id));
    setHeadersDraft((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setTestMsg((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSaved(false);
  }

  async function save(): Promise<boolean> {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload: McpServerConfig[] = servers.map((s) => {
        const headers = parseHeadersJson(headersDraft[s.id] ?? "");
        return {
          id: s.id,
          name: s.name.trim(),
          enabled: s.enabled,
          transport: "http",
          url: s.url.trim(),
          ...(headers ? { headers } : {}),
        };
      });
      const data = await saveMcpServersApi(payload);
      if (!mountedRef.current) return false;
      setServers(data.servers);
      const drafts: Record<string, string> = {};
      for (const s of data.servers) {
        drafts[s.id] = headersToText(s.headers);
      }
      setHeadersDraft(drafts);
      setSaved(true);
      return true;
    } catch (err) {
      if (!mountedRef.current) return false;
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  async function testOne(id: string) {
    setTestBusyId(id);
    setTestMsg((prev) => ({ ...prev, [id]: "" }));
    try {
      // 先保存当前表，避免测到磁盘旧配置
      const ok = await save();
      if (!ok) return;
      const result = await testMcpServerApi(id);
      if (!mountedRef.current) return;
      const names = result.tools.map((t: McpToolSummary) => t.name).join(", ");
      setTestMsg((prev) => ({
        ...prev,
        [id]: t("mcpTestOk", { count: String(result.tools.length), names: names || "-" }),
      }));
    } catch (err) {
      if (!mountedRef.current) return;
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      setTestMsg((prev) => ({
        ...prev,
        [id]: t("mcpTestFail", { error: msg }),
      }));
    } finally {
      if (mountedRef.current) setTestBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="mdocs-settings">
        <div className="mdocs-settings-header">
          <h2 className="mdocs-settings-title">{t("mcpServersTitle")}</h2>
        </div>
        <p className="mdocs-settings-item-desc">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="mdocs-settings">
      <div className="mdocs-settings-header">
        <h2 className="mdocs-settings-title">{t("mcpServersTitle")}</h2>
      </div>
      <div className="mdocs-settings-cards">
    <div className="mdocs-settings-card">
      <p className="mdocs-settings-item-desc">{t("mcpServersDesc")}</p>

      {error && (
        <p className="mdocs-settings-item-desc" style={{ color: "var(--mdocs-danger, #c00)" }}>
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="mdocs-settings-item-desc">{t("saved")}</p>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        <button type="button" className="secondary small" onClick={() => addServer()}>
          {t("mcpAddServer")}
        </button>
        <button type="button" className="primary small" onClick={() => void save()} disabled={saving}>
          {saving ? t("saving") : t("save")}
        </button>
      </div>

      {servers.length === 0 ? (
        <p className="mdocs-settings-item-desc">{t("mcpEmpty")}</p>
      ) : (
        servers.map((s) => (
          <div
            key={s.id}
            style={{
              border: "1px solid color-mix(in srgb, var(--mdocs-border, #ddd) 80%, transparent)",
              borderRadius: 8,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <label className="mdocs-settings-item" style={{ marginBottom: 8 }}>
              <span className="mdocs-settings-item-info">
                <span>{t("mcpEnabled")}</span>
              </span>
              <input
                type="checkbox"
                checked={s.enabled}
                onChange={(e) => updateServer(s.id, { enabled: e.target.checked })}
              />
            </label>
            <label className="mdocs-settings-item" style={{ display: "block", marginBottom: 8 }}>
              <span className="mdocs-settings-item-desc">{t("mcpName")}</span>
              <input
                type="text"
                value={s.name}
                onChange={(e) => updateServer(s.id, { name: e.target.value })}
                style={{ width: "100%" }}
              />
            </label>
            <label className="mdocs-settings-item" style={{ display: "block", marginBottom: 8 }}>
              <span className="mdocs-settings-item-desc">{t("mcpUrl")}</span>
              <input
                type="url"
                value={s.url}
                onChange={(e) => updateServer(s.id, { url: e.target.value })}
                placeholder="http://host:port/mcp"
                style={{ width: "100%" }}
              />
            </label>
            <label className="mdocs-settings-item" style={{ display: "block", marginBottom: 8 }}>
              <span className="mdocs-settings-item-desc">{t("mcpHeaders")}</span>
              <textarea
                value={headersDraft[s.id] ?? ""}
                onChange={(e) => {
                  setHeadersDraft((prev) => ({ ...prev, [s.id]: e.target.value }));
                  setSaved(false);
                }}
                rows={3}
                placeholder='{ "Authorization": "Bearer …" }'
                style={{ width: "100%", fontFamily: "ui-monospace, monospace", fontSize: 12 }}
              />
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="secondary small"
                disabled={testBusyId === s.id}
                onClick={() => void testOne(s.id)}
              >
                {testBusyId === s.id ? t("mcpTesting") : t("mcpTest")}
              </button>
              <button
                type="button"
                className="secondary small"
                onClick={() => removeServer(s.id)}
              >
                {t("delete")}
              </button>
            </div>
            {testMsg[s.id] ? (
              <p className="mdocs-settings-item-desc" style={{ marginTop: 8 }}>
                {testMsg[s.id]}
              </p>
            ) : null}
          </div>
        ))
      )}
    </div>
      </div>
    </div>
  );
}
