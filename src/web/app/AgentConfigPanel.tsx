import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import {
  fetchAgentConfigApi,
  fetchMe,
  saveAgentConfigApi,
  type AgentModelId,
} from "../services/endpoints";
import { MiniSelect } from "./MiniSelect";
import deepseekLogo from "../assets/deepseek.svg";

const MODEL_OPTIONS: { value: AgentModelId; label: string }[] = [
  { value: "deepseek-v4-flash", label: "deepseek-v4-flash" },
  { value: "deepseek-v4-pro", label: "deepseek-v4-pro" },
];

type Draft = {
  name: string;
  modelId: AgentModelId;
  contextWindow: number;
};

export function AgentConfigPanel() {
  const { t } = useI18n();
  const mountedRef = useRef(true);
  const [visitorName, setVisitorName] = useState("");
  const [configId, setConfigId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [modelId, setModelId] = useState<AgentModelId>("deepseek-v4-flash");
  const [contextWindow, setContextWindow] = useState(128000);
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyMasked, setApiKeyMasked] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [me, cfg] = await Promise.all([fetchMe(), fetchAgentConfigApi()]);
        if (!mountedRef.current) return;
        setVisitorName(me.visitorName);
        if (cfg) {
          setConfigId(cfg.id);
          setName(cfg.name);
          setModelId(cfg.modelId);
          setContextWindow(cfg.contextWindow || 128000);
          setHasApiKey(cfg.hasApiKey);
          setApiKeyMasked(cfg.apiKeyMasked);
          setEditing(false);
        } else {
          setEditing(true);
        }
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err.message : String(err));
        setEditing(true);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
  }, []);

  function startEdit() {
    setDraft({ name, modelId, contextWindow });
    setApiKey("");
    setShowApiKey(false);
    setSaved(false);
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    if (draft) {
      setName(draft.name);
      setModelId(draft.modelId);
      setContextWindow(draft.contextWindow);
    }
    setApiKey("");
    setShowApiKey(false);
    setError(null);
    setSaved(false);
    setEditing(false);
    setDraft(null);
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const body: {
        modelId: AgentModelId;
        name?: string;
        apiKey?: string;
        contextWindow: number;
      } = {
        modelId,
        name,
        contextWindow,
      };
      if (apiKey.trim()) body.apiKey = apiKey.trim();
      const cfg = await saveAgentConfigApi(body);
      if (!mountedRef.current) return;
      setConfigId(cfg.id);
      setName(cfg.name);
      setModelId(cfg.modelId);
      setContextWindow(cfg.contextWindow || 128000);
      setHasApiKey(cfg.hasApiKey);
      setApiKeyMasked(cfg.apiKeyMasked);
      setApiKey("");
      setShowApiKey(false);
      setSaved(true);
      setEditing(false);
      setDraft(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  const namePlaceholder = t("agentConfigNameDefault").replace(
    "{{name}}",
    visitorName || "…",
  );

  return (
    <div className="mdocs-settings">
      <div className="mdocs-settings-header">
        <h2 className="mdocs-settings-title mdocs-agent-config-title">
          <img src={deepseekLogo} alt="DeepSeek" className="mdocs-agent-config-logo" />
          {t("agentConfig")}
        </h2>
        {!loading && configId && !editing ? (
          <button type="button" className="secondary" onClick={startEdit}>
            {t("edit")}
          </button>
        ) : null}
      </div>
      <div className="mdocs-settings-cards">
        <div className="mdocs-settings-card">
          <p className="mdocs-settings-item-desc" style={{ marginBottom: 12 }}>
            {t("agentConfigDesc")}
          </p>
          {loading ? (
            <p>{t("loading")}</p>
          ) : (
            <>
              <label className="mdocs-settings-item" style={{ display: "block", marginBottom: 12 }}>
                <span className="mdocs-settings-card-title">{t("agentConfigName")}</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={namePlaceholder}
                  disabled={!editing}
                  style={{ width: "100%", marginTop: 6 }}
                />
              </label>
              <div className="mdocs-settings-item mdocs-agent-config-field" style={{ marginBottom: 12 }}>
                <span className="mdocs-settings-card-title">{t("agentConfigModel")}</span>
                {editing ? (
                  <div className="mdocs-agent-config-select">
                    <MiniSelect
                      options={MODEL_OPTIONS}
                      value={modelId}
                      onChange={(v) => setModelId(v as AgentModelId)}
                    />
                  </div>
                ) : (
                  <p className="mdocs-agent-config-readonly">{modelId}</p>
                )}
              </div>
              <label className="mdocs-settings-item" style={{ display: "block", marginBottom: 12 }}>
                <span className="mdocs-settings-card-title">{t("agentConfigContextWindow")}</span>
                <p className="mdocs-settings-item-desc" style={{ margin: "4px 0 6px" }}>
                  {t("agentConfigContextWindowDesc")}
                </p>
                {editing ? (
                  <input
                    type="number"
                    min={1000}
                    max={2000000}
                    step={1000}
                    value={contextWindow}
                    onChange={(e) => setContextWindow(Number(e.target.value) || 128000)}
                    style={{ width: "100%" }}
                  />
                ) : (
                  <p className="mdocs-agent-config-readonly">{contextWindow}</p>
                )}
              </label>
              <div className="mdocs-settings-item mdocs-agent-config-field" style={{ marginBottom: 12 }}>
                <span className="mdocs-settings-card-title">{t("agentConfigApiKey")}</span>
                {editing ? (
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
                      {showApiKey ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                          <path d="M3 3l18 18" />
                          <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                          <path d="M9.9 5.1A10.5 10.5 0 0121 12c-.6 1.1-1.4 2.1-2.4 2.9" />
                          <path d="M6.1 6.1C4.5 7.4 3.2 9.1 2.5 12c1.5 3.5 5 7 9.5 7 1.4 0 2.7-.3 3.9-.8" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                          <path d="M2.5 12C4 8.5 7.5 5 12 5s8 3.5 9.5 7c-1.5 3.5-5 7-9.5 7s-8-3.5-9.5-7z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                ) : (
                  <p className="mdocs-agent-config-readonly">
                    {hasApiKey
                      ? (apiKeyMasked ?? "…")
                      : t("agentConfigApiKeyPlaceholder")}
                  </p>
                )}
              </div>
              {configId ? (
                <p className="mdocs-settings-item-desc" style={{ marginBottom: 12 }}>
                  {t("agentConfigId")}: {configId}
                </p>
              ) : null}
              {error ? (
                <p style={{ color: "var(--mdocs-danger, #c00)", marginBottom: 12 }}>{error}</p>
              ) : null}
              {saved && !editing ? (
                <p className="mdocs-settings-item-desc" style={{ marginBottom: 12 }}>
                  {t("saved")}
                </p>
              ) : null}
              {editing ? (
                <div className="mdocs-agent-config-actions">
                  <button type="button" onClick={() => void onSave()} disabled={saving}>
                    {saving ? t("saving") : t("save")}
                  </button>
                  {configId ? (
                    <button
                      type="button"
                      className="secondary"
                      onClick={cancelEdit}
                      disabled={saving}
                    >
                      {t("cancel")}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
