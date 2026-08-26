import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import {
  deleteAgentConfigApi,
  fetchAgentConfigsApi,
  fetchMe,
  saveAgentConfigApi,
  setDefaultAgentConfigApi,
  type AgentApiType,
  type AgentConfigKind,
  type AgentModelConfigPublic,
  type AgentModelId,
} from "../services/endpoints";
import { ConfirmDialog } from "./ConfirmDialog";
import { MiniSelect } from "./MiniSelect";

const DS_MODELS = [
  { value: "deepseek-v4-flash", label: "deepseek-v4-flash" },
  { value: "deepseek-v4-pro", label: "deepseek-v4-pro" },
] as const;

const API_TYPES = [
  { value: "openai-completions", label: "OpenAI 兼容" },
  { value: "anthropic-messages", label: "Anthropic 兼容" },
] as const;

function providerLabel(kind: AgentConfigKind, providerId: string | null, fallback: string) {
  if (kind === "deepseek") return "Deepseek";
  return providerId || fallback;
}

function configSummary(cfg: AgentModelConfigPublic) {
  const vendor = providerLabel(cfg.kind, cfg.providerId, cfg.name);
  return `${vendor} · ${cfg.modelId} · ${cfg.name}`;
}

type FormMode = "create" | "edit" | null;

export function AgentConfigPanel() {
  const { t } = useI18n();
  const mountedRef = useRef(true);
  const [visitorName, setVisitorName] = useState("");
  const [configs, setConfigs] = useState<AgentModelConfigPublic[]>([]);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kind, setKind] = useState<AgentConfigKind>("deepseek");
  const [name, setName] = useState("");
  const [providerId, setProviderId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiType, setApiType] = useState<AgentApiType>("openai-completions");
  const [modelId, setModelId] = useState("deepseek-v4-flash");
  const [contextWindow, setContextWindow] = useState(128000);
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyMasked, setApiKeyMasked] = useState<string | null>(null);
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AgentModelConfigPublic | null>(null);
  const [defaultSavingId, setDefaultSavingId] = useState<string | null>(null);
  // 用户是否手动改过协议（手动改过后，URL 变化不再自动切换）
  const apiTypeManuallyTouchedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reloadConfigs = useCallback(async () => {
    const list = await fetchAgentConfigsApi();
    if (!mountedRef.current) return;
    setConfigs(list);
    return list;
  }, []);

  function resetForm() {
    setEditingId(null);
    setKind("deepseek");
    setName("");
    setProviderId("");
    setBaseUrl("");
    setApiType("openai-completions");
    setModelId("deepseek-v4-flash");
    setContextWindow(128000);
    setApiKey("");
    setHasApiKey(false);
    setApiKeyMasked(null);
    setSetAsDefault(false);
    setShowApiKey(false);
    setShowAdvanced(false);
    setError(null);
    setSaved(false);
  }

  function applyCfgToForm(cfg: AgentModelConfigPublic) {
    setEditingId(cfg.id);
    setKind(cfg.kind);
    setName(cfg.name);
    setProviderId(cfg.providerId ?? "");
    setBaseUrl(cfg.baseUrl);
    setApiType(cfg.apiType);
    setModelId(cfg.modelId);
    setContextWindow(cfg.contextWindow || 128000);
    setHasApiKey(cfg.hasApiKey);
    setApiKeyMasked(cfg.apiKeyMasked);
    setApiKey("");
    setSetAsDefault(cfg.isDefault);
  }

  useEffect(() => {
    void (async () => {
      try {
        const me = await fetchMe();
        if (!mountedRef.current) return;
        setVisitorName(me.visitorName);
        const list = await reloadConfigs();
        if (!mountedRef.current || !list) return;
        if (list.length === 0) {
          resetForm();
          setFormMode("create");
        }
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err.message : String(err));
        setFormMode("create");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
  }, [reloadConfigs]);

  function startCreate() {
    resetForm();
    setFormMode("create");
  }

  function startEdit(cfg: AgentModelConfigPublic) {
    applyCfgToForm(cfg);
    setFormMode("edit");
    setSaved(false);
    setError(null);
  }

  function cancelForm() {
    resetForm();
    setFormMode(null);
  }

  async function onSetDefault(cfg: AgentModelConfigPublic) {
    if (cfg.isDefault || defaultSavingId) return;
    setDefaultSavingId(cfg.id);
    setError(null);
    try {
      await setDefaultAgentConfigApi(cfg.id);
      await reloadConfigs();
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mountedRef.current) setDefaultSavingId(null);
    }
  }

  async function onConfirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    setError(null);
    try {
      await deleteAgentConfigApi(deleteTarget.id);
      const list = await reloadConfigs();
      if (!mountedRef.current) return;
      if (formMode === "edit" && editingId === deleteTarget.id) {
        cancelForm();
      }
      if ((list?.length ?? 0) === 0) {
        resetForm();
        setFormMode("create");
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mountedRef.current) {
        setSaving(false);
        setDeleteTarget(null);
      }
    }
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const body =
        kind === "custom"
          ? {
              ...(formMode === "edit" && editingId ? { id: editingId } : {}),
              ...(formMode === "create" && setAsDefault ? { isDefault: true } : {}),
              kind,
              baseUrl,
              modelId,
              providerId: providerId.trim() || undefined,
              apiType,
              name,
              contextWindow,
              ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
            }
          : {
              ...(formMode === "edit" && editingId ? { id: editingId } : {}),
              ...(formMode === "create" && setAsDefault ? { isDefault: true } : {}),
              kind,
              modelId: modelId as AgentModelId,
              name,
              contextWindow,
              ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
            };
      await saveAgentConfigApi(body);
      if (!mountedRef.current) return;
      await reloadConfigs();
      setSaved(true);
      setFormMode(null);
      resetForm();
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  const showForm = formMode !== null;

  return (
    <div className="mdocs-agent-config-panel">
      <div className="mdocs-settings-header">
        <h2 className="mdocs-settings-title">{t("agentConfig")}</h2>
        {!loading && !showForm ? (
          <button type="button" className="secondary" onClick={startCreate}>
            添加配置
          </button>
        ) : null}
      </div>

      <div className="mdocs-settings-cards">
        {!loading && configs.length > 0 && !showForm ? (
          <div className="mdocs-settings-card mdocs-agent-config-card">
            <p className="mdocs-agent-config-lead">选择默认配置后，智能助手与帮写将使用该模型。</p>
            <ul className="mdocs-agent-config-list">
              {configs.map((cfg) => (
                <li key={cfg.id} className="mdocs-agent-config-item">
                  <label className="mdocs-agent-config-item-default">
                    <input
                      type="radio"
                      name="agent-default-config"
                      checked={cfg.isDefault}
                      disabled={defaultSavingId !== null}
                      onChange={() => void onSetDefault(cfg)}
                    />
                    <span>{cfg.isDefault ? "默认" : "设为默认"}</span>
                  </label>
                  <div className="mdocs-agent-config-item-main">
                    <strong>{configSummary(cfg)}</strong>
                    {cfg.kind === "custom" ? (
                      <span className="mdocs-agent-badge">自定义</span>
                    ) : null}
                    <p className="mdocs-agent-config-item-meta">
                      {cfg.hasApiKey ? `Key ${cfg.apiKeyMasked ?? "已配置"}` : "未配置 Key"}
                    </p>
                  </div>
                  <div className="mdocs-agent-config-item-actions">
                    <button type="button" className="secondary small" onClick={() => startEdit(cfg)}>
                      {t("edit")}
                    </button>
                    <button
                      type="button"
                      className="secondary small"
                      onClick={() => setDeleteTarget(cfg)}
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {saved ? <p className="mdocs-agent-config-ok">{t("saved")}</p> : null}
            {error ? <p className="mdocs-agent-config-error">{error}</p> : null}
          </div>
        ) : null}

        {showForm ? (
          <div className="mdocs-settings-card mdocs-agent-config-card">
            <p className="mdocs-agent-config-lead">
              {formMode === "create" ? "新建模型配置" : "编辑模型配置"}
            </p>
            <div className="mdocs-agent-form">
              <div className="mdocs-agent-kind-tabs" role="tablist" aria-label="配置方式">
                <button
                  type="button"
                  role="tab"
                  aria-selected={kind === "deepseek"}
                  className={kind === "deepseek" ? "active" : ""}
                  onClick={() => setKind("deepseek")}
                >
                  Deepseek
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={kind === "custom"}
                  className={kind === "custom" ? "active" : ""}
                  onClick={() => setKind("custom")}
                >
                  自定义
                </button>
              </div>

              {kind === "deepseek" ? (
                <>
                  <label className="mdocs-agent-field">
                    <span>{t("agentConfigModel")}</span>
                    <MiniSelect options={[...DS_MODELS]} value={modelId} onChange={setModelId} />
                  </label>
                  <label className="mdocs-agent-field">
                    <span>{t("agentConfigApiKey")}</span>
                    <div className="mdocs-agent-config-apikey">
                      <input
                        type={showApiKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={
                          hasApiKey
                            ? t("agentConfigApiKeyConfigured").replace(
                                "{{masked}}",
                                apiKeyMasked ?? "…",
                              )
                            : t("agentConfigApiKeyPlaceholder")
                        }
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="mdocs-agent-config-eye"
                        aria-label={showApiKey ? t("agentConfigHideKey") : t("agentConfigShowKey")}
                        onClick={() => setShowApiKey((v) => !v)}
                      >
                        {showApiKey ? "隐藏" : "显示"}
                      </button>
                    </div>
                  </label>
                </>
              ) : (
                <>
                  <label className="mdocs-agent-field">
                    <span>API 地址</span>
                    <input
                      type="url"
                      value={baseUrl}
                      onChange={(e) => {
                        const value = e.target.value;
                        setBaseUrl(value);
                        // 手动改过协议就不再自动切
                        if (apiTypeManuallyTouchedRef.current) return;
                        const lower = value.toLowerCase();
                        if (lower.includes("anthropic")) {
                          setApiType("anthropic-messages");
                        } else {
                          setApiType("openai-completions");
                        }
                      }}
                      placeholder="https://api.example.com/v1"
                      className="mdocs-agent-mono"
                    />
                  </label>
                  <label className="mdocs-agent-field">
                    <span>Model ID</span>
                    <input
                      type="text"
                      value={modelId}
                      onChange={(e) => setModelId(e.target.value)}
                      placeholder="模型名称，如 gpt-4o"
                      className="mdocs-agent-mono"
                    />
                  </label>
                  <label className="mdocs-agent-field">
                    <span>{t("agentConfigApiKey")}</span>
                    <div className="mdocs-agent-config-apikey">
                      <input
                        type={showApiKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={
                          hasApiKey
                            ? t("agentConfigApiKeyConfigured").replace(
                                "{{masked}}",
                                apiKeyMasked ?? "…",
                              )
                            : "粘贴 API Key"
                        }
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="mdocs-agent-config-eye"
                        aria-label={showApiKey ? t("agentConfigHideKey") : t("agentConfigShowKey")}
                        onClick={() => setShowApiKey((v) => !v)}
                      >
                        {showApiKey ? "隐藏" : "显示"}
                      </button>
                    </div>
                  </label>
                </>
              )}

              <details
                className="mdocs-agent-advanced"
                open={showAdvanced}
                onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}
              >
                <summary>高级选项</summary>
                {kind === "custom" ? (
                  <>
                    <label className="mdocs-agent-field">
                      <span>Provider ID（选填）</span>
                      <input
                        type="text"
                        value={providerId}
                        onChange={(e) => setProviderId(e.target.value)}
                        placeholder="不填则自动从 API 地址提取域名"
                      />
                    </label>
                    <label className="mdocs-agent-field">
                      <span>API 协议</span>
                      <MiniSelect
                        options={[...API_TYPES]}
                        value={apiType}
                        onChange={(v) => {
                          apiTypeManuallyTouchedRef.current = true;
                          setApiType(v as AgentApiType);
                        }}
                      />
                    </label>
                  </>
                ) : null}
                <label className="mdocs-agent-field">
                  <span>{t("agentConfigName")}</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("agentConfigNameDefault").replace("{{name}}", visitorName || "…")}
                  />
                </label>
                <label className="mdocs-agent-field">
                  <span>{t("agentConfigContextWindow")}</span>
                  <input
                    type="number"
                    min={1000}
                    max={2000000}
                    step={1000}
                    value={contextWindow}
                    onChange={(e) => setContextWindow(Number(e.target.value) || 128000)}
                  />
                  <p className="mdocs-agent-field-hint">{t("agentConfigContextWindowDesc")}</p>
                </label>
              </details>

              {formMode === "create" && configs.length > 0 ? (
                <label className="mdocs-agent-config-default-check">
                  <input
                    type="checkbox"
                    checked={setAsDefault}
                    onChange={(e) => setSetAsDefault(e.target.checked)}
                  />
                  <span>保存后设为默认配置</span>
                </label>
              ) : null}

              {error ? <p className="mdocs-agent-config-error">{error}</p> : null}

              <div className="mdocs-agent-config-actions">
                <button type="button" onClick={() => void onSave()} disabled={saving}>
                  {saving ? t("saving") : t("save")}
                </button>
                {configs.length > 0 ? (
                  <button type="button" className="secondary" onClick={cancelForm} disabled={saving}>
                    {t("cancel")}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="mdocs-settings-card mdocs-agent-config-card">
            <p className="mdocs-agent-config-muted">{t("loading")}</p>
          </div>
        ) : null}
      </div>

      {deleteTarget ? (
        <ConfirmDialog
          title="删除配置"
          message={`确定删除「${configSummary(deleteTarget)}」？${deleteTarget.isDefault && configs.length > 1 ? " 删除后将自动把另一条设为默认。" : ""}`}
          confirmLabel="删除"
          cancelLabel={t("cancel")}
          onConfirm={() => void onConfirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}
    </div>
  );
}
