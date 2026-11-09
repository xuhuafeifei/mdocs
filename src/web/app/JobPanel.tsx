/**
 * Job 操作面板：配置 / 图表 / 运行流水（无草稿发布）。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Play, Square, Trash2, RefreshCw } from "lucide-react";
import type { ActiveDocumentMeta } from "../../shared/types/document";
import {
  cancelJobRunApi,
  getJobConfigApi,
  getJobDataApi,
  getJobRunsApi,
  manualJobRunApi,
  saveJobConfigApi,
  saveJobMonitorConfigApi,
  type JobDataPoint,
  type JobFilePayload,
  type JobRunRow,
} from "../services/endpoints";
import { useI18n } from "../i18n";
import "./JobPanel.css";

const STATUS_LABEL: Record<number, string> = {
  0: "准备",
  10: "运行中",
  20: "完成",
  30: "失败",
};

type Props = {
  meta: ActiveDocumentMeta;
  canEdit: boolean;
  onDelete: () => Promise<void>;
  readerChrome?: boolean;
  onOpenMobileNav?: () => void;
};

export function JobPanel(props: Props) {
  const { t } = useI18n();
  const documentId = props.meta.documentId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cron, setCron] = useState("");
  const [prompt, setPrompt] = useState("");
  const [axisX, setAxisX] = useState("时间");
  const [axisY, setAxisY] = useState("价格");
  const [monitors, setMonitors] = useState<JobFilePayload["MonitorConfig"]>([]);
  const [runs, setRuns] = useState<JobRunRow[]>([]);
  const [points, setPoints] = useState<JobDataPoint[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  /** 配置：只从服务端拉一次（或保存后再拉）；不以本地草稿为准。 */
  const loadConfigFromServer = useCallback(async () => {
    const cfg = await getJobConfigApi(documentId);
    setCron(cfg.JobConfig.cron);
    setPrompt(cfg.JobConfig.prompt);
    setAxisX(cfg.JobConfig.tableSchema.x);
    setAxisY(cfg.JobConfig.tableSchema.y);
    setMonitors(cfg.MonitorConfig ?? []);
  }, [documentId]);

  /** 运行时：流水 + 产出点，一律读服务端。 */
  const loadRuntimeFromServer = useCallback(async () => {
    const [runRes, dataRes] = await Promise.all([
      getJobRunsApi(documentId),
      getJobDataApi(documentId),
    ]);
    setRuns(runRes.runs);
    setPoints(dataRes.points);
  }, [documentId]);

  const refreshAllFromServer = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([loadConfigFromServer(), loadRuntimeFromServer()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [loadConfigFromServer, loadRuntimeFromServer]);

  useEffect(() => {
    setLoading(true);
    void refreshAllFromServer();
  }, [refreshAllFromServer]);

  const activeRun = useMemo(
    () => runs.find((r) => r.status === 0 || r.status === 10) ?? null,
    [runs],
  );

  // 仅在有运行中任务时轮询运行时数据；不轮询配置，避免盖住正在编辑的表单
  useEffect(() => {
    if (!activeRun) return;
    const timer = window.setInterval(() => {
      void loadRuntimeFromServer().catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeRun, loadRuntimeFromServer]);

  async function saveConfig(): Promise<void> {
    if (!props.canEdit) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await saveJobConfigApi(documentId, {
        cron,
        prompt,
        tableSchema: { x: axisX, y: axisY },
      });
      await saveJobMonitorConfigApi(documentId, monitors);
      await loadConfigFromServer();
      setMessage("已保存到服务端");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runNow(): Promise<void> {
    if (!props.canEdit) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await manualJobRunApi(documentId);
      setMessage("已开始执行");
      await loadRuntimeFromServer();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function cancelActive(): Promise<void> {
    if (!props.canEdit || !activeRun) return;
    setBusy(true);
    setError(null);
    try {
      await cancelJobRunApi(documentId, activeRun.id);
      setMessage("已请求终止");
      await loadRuntimeFromServer();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function addMonitor(): void {
    setMonitors((prev) => [
      ...prev,
      {
        monitorId: crypto.randomUUID(),
        rule: "<=",
        threshold: 0,
      },
    ]);
  }

  if (loading) {
    return <div className="mdocs-job-panel muted">加载 Job…</div>;
  }

  return (
    <div className="mdocs-job-panel">
      <header className="mdocs-job-panel-header">
        {props.readerChrome && props.onOpenMobileNav ? (
          <button type="button" className="ghost" onClick={props.onOpenMobileNav}>
            菜单
          </button>
        ) : null}
        <div className="mdocs-job-panel-title">
          <strong>{props.meta.displayName || "Job"}</strong>
          <span className="muted">定时任务</span>
        </div>
        <div className="mdocs-job-panel-actions">
          <button
            type="button"
            className="ghost"
            title="从服务端刷新"
            onClick={() => void refreshAllFromServer()}
            disabled={busy}
          >
            <RefreshCw size={14} />
          </button>
          {props.canEdit ? (
            <>
              <button type="button" className="primary" onClick={() => void runNow()} disabled={busy || Boolean(activeRun)}>
                <Play size={14} /> 立刻执行
              </button>
              <button type="button" onClick={() => void cancelActive()} disabled={busy || !activeRun}>
                <Square size={14} /> 终止
              </button>
              <button type="button" onClick={() => void saveConfig()} disabled={busy}>
                保存配置
              </button>
              <button
                type="button"
                className="ghost danger"
                onClick={() => void props.onDelete()}
                title={t("delete")}
              >
                <Trash2 size={14} />
              </button>
            </>
          ) : null}
        </div>
      </header>

      {error ? <div className="mdocs-job-banner error">{error}</div> : null}
      {message ? <div className="mdocs-job-banner ok">{message}</div> : null}

      <section className="mdocs-job-section">
        <h3>1. 任务配置</h3>
        <label className="mdocs-job-field">
          <span>Cron（秒 分 时 日 月 周）</span>
          <input
            value={cron}
            disabled={!props.canEdit || busy}
            onChange={(e) => setCron(e.target.value)}
            placeholder="0 0 9 * * *"
          />
        </label>
        <label className="mdocs-job-field">
          <span>Prompt</span>
          <textarea
            value={prompt}
            disabled={!props.canEdit || busy}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            placeholder="让助手去查什么、如何写点数…"
          />
        </label>
        <div className="mdocs-job-row">
          <label className="mdocs-job-field">
            <span>横轴含义</span>
            <input value={axisX} disabled={!props.canEdit || busy} onChange={(e) => setAxisX(e.target.value)} />
          </label>
          <label className="mdocs-job-field">
            <span>纵轴含义</span>
            <input value={axisY} disabled={!props.canEdit || busy} onChange={(e) => setAxisY(e.target.value)} />
          </label>
        </div>
      </section>

      <section className="mdocs-job-section">
        <h3>2. 数据图（{axisY} / {axisX}）</h3>
        <JobChart points={points} axisX={axisX} axisY={axisY} />
        <div className="mdocs-job-table-wrap">
          <table className="mdocs-job-table">
            <thead>
              <tr>
                <th>{axisX}</th>
                <th>{axisY}</th>
                <th>run</th>
              </tr>
            </thead>
            <tbody>
              {points.length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">
                    暂无数据
                  </td>
                </tr>
              ) : (
                [...points].reverse().slice(0, 30).map((p) => (
                  <tr key={p.id}>
                    <td>{p.x}</td>
                    <td>{p.y}</td>
                    <td>{p.job_running_id}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mdocs-job-section">
        <h3>3. 监控规则（只存，一期不告警）</h3>
        {monitors.map((m, i) => (
          <div className="mdocs-job-row" key={m.monitorId}>
            <select
              value={m.rule}
              disabled={!props.canEdit || busy}
              onChange={(e) => {
                const rule = e.target.value;
                setMonitors((prev) =>
                  prev.map((row, idx) => (idx === i ? { ...row, rule } : row)),
                );
              }}
            >
              <option value="<=">&lt;=</option>
              <option value=">=">&gt;=</option>
              <option value="<">&lt;</option>
              <option value=">">&gt;</option>
            </select>
            <input
              type="number"
              value={m.threshold}
              disabled={!props.canEdit || busy}
              onChange={(e) => {
                const threshold = Number(e.target.value);
                setMonitors((prev) =>
                  prev.map((row, idx) => (idx === i ? { ...row, threshold } : row)),
                );
              }}
            />
            {props.canEdit ? (
              <button
                type="button"
                className="ghost"
                onClick={() => setMonitors((prev) => prev.filter((_, idx) => idx !== i))}
              >
                删
              </button>
            ) : null}
          </div>
        ))}
        {props.canEdit ? (
          <button type="button" className="ghost" onClick={addMonitor}>
            + 规则
          </button>
        ) : null}
      </section>

      <section className="mdocs-job-section">
        <h3>运行情况</h3>
        <div className="mdocs-job-table-wrap">
          <table className="mdocs-job-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>状态</th>
                <th>触发</th>
                <th>开始</th>
                <th>结束</th>
                <th>原因</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    尚无运行记录
                  </td>
                </tr>
              ) : (
                runs.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{STATUS_LABEL[r.status] ?? r.status}</td>
                    <td>{r.trigger}</td>
                    <td>{r.start_time}</td>
                    <td>{r.end_time ?? "—"}</td>
                    <td>{r.failed_reason ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function JobChart(props: {
  points: JobDataPoint[];
  axisX: string;
  axisY: string;
}) {
  const { points } = props;
  if (points.length === 0) {
    return <div className="mdocs-job-chart empty muted">跑起来并写入数据后显示折线</div>;
  }
  const ys = points.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = maxY - minY || 1;
  const w = 640;
  const h = 180;
  const pad = 16;
  const coords = points.map((p, i) => {
    const x = pad + (i / Math.max(points.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - ((p.y - minY) / span) * (h - pad * 2);
    return `${x},${y}`;
  });
  return (
    <svg className="mdocs-job-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="job chart">
      <polyline
        fill="none"
        stroke="var(--mdocs-accent, #2563eb)"
        strokeWidth="2"
        points={coords.join(" ")}
      />
      {points.map((p, i) => {
        const [cx, cy] = coords[i]!.split(",").map(Number);
        return <circle key={p.id} cx={cx} cy={cy} r={3} fill="var(--mdocs-accent, #2563eb)" />;
      })}
    </svg>
  );
}
