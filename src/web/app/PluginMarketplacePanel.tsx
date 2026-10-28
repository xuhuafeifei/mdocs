/**
 * 设置页：插件市场。Memorix 安装在服务端后台进行，页面按步骤显示进度，成功后明确标出。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import type { TranslationKey } from "../i18n/types";
import {
  fetchPluginsApi,
  installPluginApi,
  uninstallPluginApi,
  type PluginInstallJob,
  type PluginInstallLog,
  type PluginListItem,
} from "../services/endpoints";
import { ApiRequestError } from "../services/api-request-error";

function phaseLabel(
  phase: PluginInstallJob["phase"],
  t: (key: TranslationKey, vars?: Record<string, string>) => string,
): string {
  if (phase === "npm") return t("pluginPhaseNpm");
  if (phase === "init") return t("pluginPhaseInit");
  if (phase === "start") return t("pluginPhaseStart");
  if (phase === "health") return t("pluginPhaseHealth");
  if (phase === "saving") return t("pluginPhaseSaving");
  if (phase === "done") return t("pluginInstallOk");
  return "";
}

function formatInstallLog(
  log: PluginInstallLog,
  t: (key: TranslationKey, vars?: Record<string, string>) => string,
): string {
  const line = log.data?.line?.trim();
  if (line) return line;
  const phase = log.data?.phase;
  if (
    phase === "npm" ||
    phase === "init" ||
    phase === "start" ||
    phase === "health" ||
    phase === "saving" ||
    phase === "done" ||
    phase === "error"
  ) {
    return phaseLabel(phase, t);
  }
  return log.event;
}

function InstallLogBox(props: { logs: PluginInstallLog[] }) {
  const { t } = useI18n();
  const ref = useRef<HTMLPreElement>(null);
  const count = props.logs.length;
  const lastTs = props.logs[count - 1]?.ts ?? "";

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count, lastTs]);

  if (count === 0) return null;
  return (
    <pre ref={ref} className="mdocs-plugin-install-logs">
      {props.logs.map((log) => formatInstallLog(log, t)).join("\n")}
    </pre>
  );
}

export function PluginMarketplacePanel() {
  const { t } = useI18n();
  const mountedRef = useRef(true);
  const [plugins, setPlugins] = useState<PluginListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, string>>({});

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const data = await fetchPluginsApi();
    if (!mountedRef.current) return;
    setPlugins(data.plugins);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await refresh();
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    void load();
  }, [load]);

  const installPending = plugins.some(
    (p) => p.installJob && !p.installJob.finishedAt,
  );

  useEffect(() => {
    if (!installPending) return;
    const timer = window.setInterval(() => {
      void refresh().catch(() => {
        /* 轮询失败时保留上一帧进度 */
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [installPending, refresh]);

  async function install(id: string) {
    setStartingId(id);
    setMsg((prev) => ({ ...prev, [id]: "" }));
    setError(null);
    try {
      await installPluginApi(id);
      await refresh();
    } catch (err) {
      if (!mountedRef.current) return;
      const text =
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      setMsg((prev) => ({
        ...prev,
        [id]: t("pluginInstallFail", { error: text }),
      }));
    } finally {
      if (mountedRef.current) setStartingId(null);
    }
  }

  async function uninstall(id: string) {
    setBusyId(id);
    setMsg((prev) => ({ ...prev, [id]: "" }));
    try {
      const { plugin } = await uninstallPluginApi(id);
      if (!mountedRef.current) return;
      setPlugins((prev) => prev.map((p) => (p.id === id ? { ...plugin, installJob: null } : p)));
      setMsg((prev) => ({ ...prev, [id]: t("pluginUninstallOk") }));
    } catch (err) {
      if (!mountedRef.current) return;
      const text =
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      setMsg((prev) => ({
        ...prev,
        [id]: t("pluginUninstallFail", { error: text }),
      }));
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="mdocs-settings-card">
        <p className="mdocs-settings-item-desc">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="mdocs-settings">
      <div className="mdocs-settings-header">
        <h2 className="mdocs-settings-title">{t("pluginMarketTitle")}</h2>
      </div>
      <div className="mdocs-settings-cards">
        <div className="mdocs-settings-card">
          <p className="mdocs-settings-item-desc">{t("pluginMarketDesc")}</p>
          {error ? (
            <p
              className="mdocs-settings-item-desc"
              style={{ color: "var(--mdocs-danger, #c00)" }}
            >
              {error}
            </p>
          ) : null}

          {plugins.length === 0 ? (
            <p className="mdocs-settings-item-desc">{t("pluginMarketEmpty")}</p>
          ) : (
            plugins.map((p) => {
              const job = p.installJob ?? null;
              const installing =
                startingId === p.id || Boolean(job && !job.finishedAt);
              const succeeded = job?.phase === "done" && p.installed;
              const failed = job?.phase === "error";
              return (
                <div
                  key={p.id}
                  style={{
                    border:
                      "1px solid color-mix(in srgb, var(--mdocs-border, #ddd) 80%, transparent)",
                    borderRadius: 8,
                    padding: 12,
                    marginTop: 12,
                  }}
                >
                  <div className="mdocs-settings-card-title">{p.name}</div>
                  <p className="mdocs-settings-item-desc">{p.description}</p>
                  <p className="mdocs-settings-item-desc">
                    {p.installed
                      ? t("pluginStatusInstalled", {
                          at: p.installedAt ?? "—",
                        })
                      : t("pluginStatusNotInstalled")}
                    {p.installed
                      ? p.runtimeRunning
                        ? ` · ${t("pluginRuntimeRunning")}`
                        : ` · ${t("pluginRuntimeStopped")}`
                      : ""}
                  </p>
                  {installing && job ? (
                    <p style={{ margin: "8px 0 0", fontSize: 13 }}>
                      {phaseLabel(job.phase, t) || t("pluginInstalling")}
                    </p>
                  ) : null}
                  {succeeded ? (
                    <p
                      style={{
                        margin: "8px 0 0",
                        fontSize: 13,
                        color: "var(--mdocs-accent, #2e7d32)",
                      }}
                    >
                      {t("pluginInstallOk")}
                    </p>
                  ) : null}
                  {failed && job?.error ? (
                    <p
                      style={{
                        margin: "8px 0 0",
                        fontSize: 13,
                        color: "var(--mdocs-danger, #c00)",
                      }}
                    >
                      {t("pluginInstallFail", { error: job.error })}
                    </p>
                  ) : null}
                  {job?.logs?.length ? <InstallLogBox logs={job.logs} /> : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    {p.installed ? (
                      <button
                        type="button"
                        className="secondary small"
                        disabled={busyId === p.id || installing}
                        onClick={() => void uninstall(p.id)}
                      >
                        {busyId === p.id ? t("pluginBusy") : t("pluginUninstall")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="primary small"
                        disabled={installing}
                        onClick={() => void install(p.id)}
                      >
                        {installing ? t("pluginInstalling") : t("pluginInstall")}
                      </button>
                    )}
                  </div>
                  {msg[p.id] ? (
                    <p className="mdocs-settings-item-desc" style={{ marginTop: 8 }}>
                      {msg[p.id]}
                    </p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
