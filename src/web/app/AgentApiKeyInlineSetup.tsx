import { useRef, useState } from "react";
import { useI18n } from "../i18n";
import { saveAgentConfigApi, type AgentApiType, type AgentConfigKind } from "../services/endpoints";

const API_TYPES = [
  { value: "openai-completions", label: "OpenAI 兼容" },
  { value: "anthropic-messages", label: "Anthropic 兼容" },
] as const;

/**
 * 智能助手 / 帮写内嵌 API Key 配置，避免跳转设置页。
 * 支持 DeepSeek 预设和自定义供应商两种模式。
 */
export function AgentApiKeyInlineSetup(props: {
  onConfigured?: () => void | Promise<void>;
}) {
  const { t } = useI18n();
  const [kind, setKind] = useState<AgentConfigKind>("deepseek");
  const [baseUrl, setBaseUrl] = useState("");
  const [modelId, setModelId] = useState("");
  const [apiType, setApiType] = useState<AgentApiType>("openai-completions");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 用户是否手动改过协议（手动改过后，URL 变化不再自动切换）
  const apiTypeManuallyTouchedRef = useRef(false);

  function onBaseUrlChange(value: string) {
    setBaseUrl(value);
    // 手动改过就不再自动切
    if (apiTypeManuallyTouchedRef.current) return;
    const lower = value.toLowerCase();
    if (lower.includes("anthropic")) {
      setApiType("anthropic-messages");
    } else {
      setApiType("openai-completions");
    }
  }

  function onApiTypeChange(value: AgentApiType) {
    apiTypeManuallyTouchedRef.current = true;
    setApiType(value);
  }

  async function onSave() {
    const keyTrimmed = apiKey.trim();
    if (!keyTrimmed) {
      setError("请输入 API Key");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (kind === "deepseek") {
        await saveAgentConfigApi({
          kind: "deepseek",
          modelId: "deepseek-v4-flash",
          apiKey: keyTrimmed,
        });
      } else {
        const urlTrimmed = baseUrl.trim();
        if (!urlTrimmed) {
          setError("请输入 API 地址");
          return;
        }
        const modelTrimmed = modelId.trim();
        if (!modelTrimmed) {
          setError("请输入 Model ID");
          return;
        }
        await saveAgentConfigApi({
          kind: "custom",
          baseUrl: urlTrimmed,
          modelId: modelTrimmed,
          apiType,
          apiKey: keyTrimmed,
        });
      }
      setApiKey("");
      setBaseUrl("");
      setModelId("");
      await props.onConfigured?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const canSave =
    apiKey.trim() &&
    (kind === "deepseek" || (baseUrl.trim() && modelId.trim()));

  return (
    <div className="mdocs-agent-apikey-inline">
      <p className="mdocs-agent-apikey-inline-lead">
        配置 AI 供应商后即可使用（仅本人可见，不会分享给其他访客）
      </p>

      <div className="mdocs-agent-kind-tabs mdocs-agent-apikey-inline-tabs" role="tablist" aria-label="配置方式">
        <button
          type="button"
          role="tab"
          aria-selected={kind === "deepseek"}
          className={kind === "deepseek" ? "active" : ""}
          onClick={() => setKind("deepseek")}
          disabled={saving}
        >
          Deepseek
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={kind === "custom"}
          className={kind === "custom" ? "active" : ""}
          onClick={() => setKind("custom")}
          disabled={saving}
        >
          自定义
        </button>
      </div>

      {kind === "custom" ? (
        <>
          <label className="mdocs-agent-field mdocs-agent-apikey-inline-field">
            <span>API 地址</span>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => onBaseUrlChange(e.target.value)}
              placeholder="https://api.example.com/v1"
              className="mdocs-agent-mono"
              disabled={saving}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void onSave();
                }
              }}
            />
          </label>
          <label className="mdocs-agent-field mdocs-agent-apikey-inline-field">
            <span>API 协议</span>
            <div className="mdocs-agent-apikey-inline-protocol">
              {API_TYPES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={apiType === opt.value ? "active" : ""}
                  onClick={() => onApiTypeChange(opt.value as AgentApiType)}
                  disabled={saving}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </label>
          <label className="mdocs-agent-field mdocs-agent-apikey-inline-field">
            <span>Model ID</span>
            <input
              type="text"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="模型名称，如 gpt-4o / claude-3-5-sonnet"
              className="mdocs-agent-mono"
              disabled={saving}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void onSave();
                }
              }}
            />
          </label>
        </>
      ) : null}

      <div className="mdocs-agent-config-apikey mdocs-agent-apikey-inline-field">
        <input
          type={showApiKey ? "text" : "password"}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={t("agentConfigApiKeyPlaceholder")}
          autoComplete="off"
          disabled={saving}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void onSave();
            }
          }}
        />
        <button
          type="button"
          className="mdocs-agent-config-eye"
          aria-label={showApiKey ? t("agentConfigHideKey") : t("agentConfigShowKey")}
          onClick={() => setShowApiKey((v) => !v)}
          disabled={saving}
        >
          {showApiKey ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M3 3l18 18" />
              <path d="M10.6 10.6a2 2 0 002.8 2.8" />
              <path d="M9.9 5.1A10.5 0 0121 12c-.6 1.1-1.4 2.1-2.4 2.9" />
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

      {error ? <p className="mdocs-agent-apikey-inline-error">{error}</p> : null}

      <button
        type="button"
        className="mdocs-agent-apikey-inline-save"
        onClick={() => void onSave()}
        disabled={saving || !canSave}
      >
        {saving ? t("saving") : "保存并启用"}
      </button>
    </div>
  );
}
