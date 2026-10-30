/**
 * 安装 / 卸载执行窗口：按步骤状态 + 聚合日志。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n";
import {
  fetchPipelineJobApi,
  installPipelineApi,
  uninstallPipelineApi,
  type PipelineJob,
  type PipelineJobStepStatus,
  type PipelineListItem,
} from "../../services/endpoints";
import { stepLabel } from "./pluginMeta";
import "./plugins.css";

type Props = {
  pipe: PipelineListItem;
  action: "install" | "uninstall";
  onClose: () => void;
  onStarted?: () => void;
  onFinished?: () => void;
};

function statusIcon(status: PipelineJobStepStatus): string {
  if (status === "done") return "✓";
  if (status === "running") return "●";
  if (status === "skipped") return "–";
  if (status === "error") return "!";
  return "·";
}

function statusText(
  status: PipelineJobStepStatus,
  t: ReturnType<typeof useI18n>["t"],
): string {
  if (status === "done") return t("plRunnerDone");
  if (status === "running") return t("plRunnerRunning");
  if (status === "skipped") return t("plRunnerSkipped");
  if (status === "error") return t("plRunnerFailed");
  return t("plRunnerPending");
}

export function PipelineInstallRunner(props: Props) {
  const { t } = useI18n();
  const [job, setJob] = useState<PipelineJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const logsRef = useRef<HTMLPreElement>(null);
  const finishedRef = useRef(false);
  // StrictMode 会双跑 effect；同一个执行窗只允许启动一次（重试按钮走 start）。
  const startedRef = useRef(false);
  // 回调用 ref 固定：父组件每次渲染都会传新函数，不能让它触发重新安装。
  const onStartedRef = useRef(props.onStarted);
  const onFinishedRef = useRef(props.onFinished);
  onStartedRef.current = props.onStarted;
  onFinishedRef.current = props.onFinished;

  const start = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      const res =
        props.action === "install"
          ? await installPipelineApi(props.pipe.kind === "system" ? "system" : "tenant", props.pipe.id)
          : await uninstallPipelineApi(props.pipe.kind === "system" ? "system" : "tenant", props.pipe.id);
      setJob(res.job);
      finishedRef.current = false;
      onStartedRef.current?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  }, [props.action, props.pipe.id, props.pipe.kind]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void start();
  }, [start]);

  const running = job?.status === "running";

  useEffect(() => {
    if (!job || job.status === "running" || finishedRef.current) return;
    finishedRef.current = true;
    onFinishedRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      void fetchPipelineJobApi(
        props.pipe.kind === "system" ? "system" : "tenant",
        props.pipe.id,
        props.action,
      )
        .then((res) => {
          if (!res.job) return;
          setJob(res.job);
          if (res.job.status !== "running" && !finishedRef.current) {
            finishedRef.current = true;
            onFinishedRef.current?.();
          }
        })
        .catch(() => {});
    }, 900);
    return () => window.clearInterval(timer);
  }, [running, props.action, props.pipe.id, props.pipe.kind]);

  useEffect(() => {
    const el = logsRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [job?.logs.length]);

  const title =
    job?.status === "done"
      ? t(props.action === "install" ? "plInstallDone" : "plUninstallDone") +
        " · " +
        props.pipe.name
      : props.action === "install"
        ? t("plRunnerInstall", { name: props.pipe.name })
        : t("plRunnerUninstall", { name: props.pipe.name });
  const statusClass = job?.status ?? (error ? "error" : "running");

  return (
    <div className="pl-overlay" role="dialog" aria-modal="true">
      <div className="pl-modal wide">
        <div className="pl-modal-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3>{title}</h3>
            <div className="pl-orch-meta">
              <span className={`pl-runner-status ${statusClass}`}>
                {job?.status === "done"
                  ? t("plRunnerDone")
                  : job?.status === "error" || error
                    ? t("plRunnerFailed")
                    : t("plRunnerRunning")}
              </span>
              <span className="pl-mini-hint">
                {props.pipe.name} · {props.pipe.id}
              </span>
            </div>
          </div>
          <button type="button" className="pl-x" onClick={props.onClose} aria-label={t("close")}>
            ×
          </button>
        </div>

        <div className="pl-modal-body">
          <div className="pl-risk">
            <span>⚠</span>
            <span>{t("plRiskNote")}</span>
          </div>

          {error ? <p className="pl-error">{error}</p> : null}

          {job?.probe && job.probe.results.length > 0 ? (
            <p className="pl-mini-hint" style={{ margin: 0 }}>
              {job.probe.passed
                ? t("plRunnerProbePassed")
                : t("plRunnerProbeFailed")}
            </p>
          ) : null}

          <div className="pl-runner-steps">
            {(job?.steps ?? []).map((step) => (
              <div key={step.index} className={`pl-run-step ${step.status}`}>
                <div className="pl-run-icon">{statusIcon(step.status)}</div>
                <div className="pl-run-main">
                  <div className="pl-run-title">
                    <span>
                      {String(step.index + 1).padStart(2, "0")} ·{" "}
                      {stepLabel(step.type, step.label, t)}
                    </span>
                    <span className="pl-tag">{statusText(step.status, t)}</span>
                    {step.detail ? <span className="pl-tag warn">{step.detail}</span> : null}
                  </div>
                  <div className="pl-run-sub">{step.type}</div>
                  {step.error ? <div className="pl-run-error">{step.error}</div> : null}
                </div>
              </div>
            ))}
            {!job && starting ? (
              <div className="pl-run-step running">
                <div className="pl-run-icon">●</div>
                <div className="pl-run-main">
                  <div className="pl-run-title">{t("plRunnerRunning")}</div>
                </div>
              </div>
            ) : null}
          </div>

          {job?.error ? (
            <p className="pl-error">
              {job.error}
              <br />
              <span style={{ opacity: 0.85 }}>{t("plRunnerPartial")}</span>
            </p>
          ) : null}

          {job?.logs?.length ? (
            <div>
              <div className="pl-block-title" style={{ marginBottom: 6 }}>
                {t("plRunnerLogs")}
              </div>
              <pre className="pl-logs" ref={logsRef}>
                {job.logs.map((log, i) => (
                  <div key={i} className={log.level}>
                    {`[${new Date(log.ts).toLocaleTimeString()}] ${log.stepIndex != null ? `#${log.stepIndex + 1} ` : ""}${log.line}`}
                  </div>
                ))}
              </pre>
            </div>
          ) : null}
        </div>

        <div className="pl-modal-foot">
          <span className="spacer" />
          {job?.status === "error" || error ? (
            <button
              type="button"
              className="pl-btn"
              onClick={() => void start()}
              disabled={starting}
            >
              {t("plRunnerRetry")}
            </button>
          ) : null}
          <button type="button" className="pl-btn primary" onClick={props.onClose}>
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
