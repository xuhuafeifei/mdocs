/**
 * Job 操作面板：配置 / 图表 / 运行流水（无草稿发布）。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock3,
  Menu,
  Play,
  Plus,
  RefreshCw,
  Save,
  Square,
  Trash2,
  Activity,
  LineChart,
} from "lucide-react";
import type { ActiveDocumentMeta } from "../../shared/types/document";
import {
  cancelJobRunApi,
  deleteJobDataApi,
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

function shortId(id: string | number): string {
  const s = String(id);
  return s.length > 8 ? s.slice(0, 8) : s;
}

function formatTime(raw: string | null | undefined): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function statusClass(status: number): string {
  if (status === 10 || status === 0) return "is-running";
  if (status === 20) return "is-done";
  if (status === 30) return "is-failed";
  return "";
}

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

  // 成功提示自动消失，避免一直占布局
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 1800);
    return () => window.clearTimeout(timer);
  }, [message]);

  const activeRun = useMemo(
    () => runs.find((r) => r.status === 0 || r.status === 10) ?? null,
    [runs],
  );

  const lastRun = runs[0] ?? null;
  const latestPoint = points.length > 0 ? points[points.length - 1] : null;

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
      // 串行写同一 .job；用接口回包更新本地，避免再拉一遍导致表单闪烁
      const cfgRes = await saveJobConfigApi(documentId, {
        cron,
        prompt,
        tableSchema: { x: axisX, y: axisY },
      });
      const monRes = await saveJobMonitorConfigApi(documentId, monitors);
      setCron(cfgRes.JobConfig.cron);
      setPrompt(cfgRes.JobConfig.prompt);
      setAxisX(cfgRes.JobConfig.tableSchema.x);
      setAxisY(cfgRes.JobConfig.tableSchema.y);
      setMonitors(monRes.MonitorConfig ?? []);
      setMessage("已保存");
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

  async function deletePoints(ids: number[]): Promise<void> {
    if (!props.canEdit || ids.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await deleteJobDataApi(documentId, { ids });
      setMessage(`已删除 ${res.deleted} 个数据点`);
      await loadRuntimeFromServer();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function clearAllPoints(): Promise<void> {
    if (!props.canEdit || points.length === 0) return;
    if (!window.confirm(`确认清空全部 ${points.length} 个数据点？运行流水会保留。`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await deleteJobDataApi(documentId, { all: true });
      setMessage(`已清空 ${res.deleted} 个数据点`);
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
    return (
      <div className="mdocs-job-panel">
        <div className="mdocs-job-loading">加载 Job…</div>
      </div>
    );
  }

  return (
    <div className="mdocs-job-panel">
      <header className="mdocs-job-toolbar">
        <div className="mdocs-job-toolbar-left">
          {props.readerChrome && props.onOpenMobileNav ? (
            <button
              type="button"
              className="ghost mdocs-job-icon-btn"
              onClick={props.onOpenMobileNav}
              aria-label="菜单"
            >
              <Menu size={16} />
            </button>
          ) : null}
          <div className="mdocs-job-title-block">
            <div className="mdocs-job-title-row">
              <h1 className="mdocs-job-title">{props.meta.displayName || "Job"}</h1>
              <span className="mdocs-job-type-badge">定时任务</span>
              {activeRun ? (
                <span className="mdocs-job-status-pill is-running">
                  <span className="mdocs-job-status-dot" />
                  运行中
                </span>
              ) : null}
            </div>
            <p className="mdocs-job-subtitle">
              {cron ? `计划：${cron}` : "尚未设置 Cron"}
              {latestPoint ? ` · 最新 ${axisY}=${latestPoint.y}` : ""}
            </p>
          </div>
        </div>
        <div className="mdocs-job-toolbar-actions">
          <button
            type="button"
            className="ghost mdocs-job-icon-btn"
            title="从服务端刷新"
            onClick={() => void refreshAllFromServer()}
            disabled={busy}
          >
            <RefreshCw size={15} />
          </button>
          {props.canEdit ? (
            <>
              <button
                type="button"
                className="primary"
                onClick={() => void runNow()}
                disabled={busy || Boolean(activeRun)}
              >
                <Play size={14} /> 立刻执行
              </button>
              <button type="button" onClick={() => void cancelActive()} disabled={busy || !activeRun}>
                <Square size={14} /> 终止
              </button>
              <button type="button" className="secondary" onClick={() => void saveConfig()} disabled={busy}>
                <Save size={14} /> 保存
              </button>
              <button
                type="button"
                className="ghost danger mdocs-job-icon-btn"
                onClick={() => void props.onDelete()}
                title={t("delete")}
              >
                <Trash2 size={15} />
              </button>
            </>
          ) : null}
        </div>
      </header>

      {error ? <div className="mdocs-job-banner error">{error}</div> : null}
      {message ? (
        <div className="mdocs-job-toast" role="status">
          {message}
        </div>
      ) : null}

      <div className="mdocs-job-body">
        <div className="mdocs-job-stats">
          <div className="mdocs-job-stat">
            <span className="mdocs-job-stat-label">数据点</span>
            <strong className="mdocs-job-stat-value">{points.length}</strong>
          </div>
          <div className="mdocs-job-stat">
            <span className="mdocs-job-stat-label">运行次数</span>
            <strong className="mdocs-job-stat-value">{runs.length}</strong>
          </div>
          <div className="mdocs-job-stat">
            <span className="mdocs-job-stat-label">上次状态</span>
            <strong className={`mdocs-job-stat-value ${lastRun ? statusClass(lastRun.status) : ""}`}>
              {lastRun ? (STATUS_LABEL[lastRun.status] ?? lastRun.status) : "—"}
            </strong>
          </div>
          <div className="mdocs-job-stat">
            <span className="mdocs-job-stat-label">监控规则</span>
            <strong className="mdocs-job-stat-value">{monitors.length}</strong>
          </div>
        </div>

        <section className="mdocs-job-card mdocs-job-card--chart">
          <div className="mdocs-job-card-head">
            <div className="mdocs-job-card-title">
              <LineChart size={16} />
              <h2>
                {axisY} <span className="mdocs-job-card-title-muted">/ {axisX}</span>
              </h2>
            </div>
            <div className="mdocs-job-card-head-right">
              {points.length > 0 ? (
                <span className="mdocs-job-card-meta">最近 {Math.min(points.length, 60)} 点</span>
              ) : null}
              {props.canEdit && points.length > 0 ? (
                <button
                  type="button"
                  className="ghost danger"
                  disabled={busy}
                  onClick={() => void clearAllPoints()}
                >
                  清空数据
                </button>
              ) : null}
            </div>
          </div>
          <JobChart points={points} axisX={axisX} axisY={axisY} />
          <div className="mdocs-job-table-wrap">
            <table className="mdocs-job-table">
              <thead>
                <tr>
                  <th>{axisX}</th>
                  <th>{axisY}</th>
                  <th>Run</th>
                  {props.canEdit ? <th className="mdocs-job-col-action" /> : null}
                </tr>
              </thead>
              <tbody>
                {points.length === 0 ? (
                  <tr>
                    <td colSpan={props.canEdit ? 4 : 3} className="mdocs-job-empty-cell">
                      暂无采集数据
                    </td>
                  </tr>
                ) : (
                  [...points]
                    .reverse()
                    .slice(0, 30)
                    .map((p) => (
                      <tr key={p.id}>
                        <td>{p.x}</td>
                        <td className="mdocs-job-num">{p.y}</td>
                        <td>
                          <code className="mdocs-job-code" title={String(p.job_running_id)}>
                            {shortId(p.job_running_id)}
                          </code>
                        </td>
                        {props.canEdit ? (
                          <td className="mdocs-job-col-action">
                            <button
                              type="button"
                              className="ghost danger mdocs-job-icon-btn"
                              title="删除此点"
                              disabled={busy}
                              onClick={() => void deletePoints([p.id])}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mdocs-job-grid">
          <section className="mdocs-job-card">
            <div className="mdocs-job-card-head">
              <div className="mdocs-job-card-title">
                <Clock3 size={16} />
                <h2>任务配置</h2>
              </div>
            </div>
            <label className="mdocs-job-field">
              <span>Cron（秒 分 时 日 月 周）</span>
              <input
                value={cron}
                disabled={!props.canEdit}
                onChange={(e) => setCron(e.target.value)}
                placeholder="0 0 9 * * *"
                spellCheck={false}
              />
            </label>
            <label className="mdocs-job-field">
              <span>Prompt</span>
              <textarea
                value={prompt}
                disabled={!props.canEdit}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                placeholder="让助手去查什么、如何写点数…"
              />
            </label>
            <div className="mdocs-job-row">
              <label className="mdocs-job-field">
                <span>横轴含义</span>
                <input
                  value={axisX}
                  disabled={!props.canEdit}
                  onChange={(e) => setAxisX(e.target.value)}
                />
              </label>
              <label className="mdocs-job-field">
                <span>纵轴含义</span>
                <input
                  value={axisY}
                  disabled={!props.canEdit}
                  onChange={(e) => setAxisY(e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="mdocs-job-card">
            <div className="mdocs-job-card-head">
              <div className="mdocs-job-card-title">
                <Activity size={16} />
                <h2>监控规则</h2>
              </div>
              {props.canEdit ? (
                <button type="button" className="ghost mdocs-job-add-btn" onClick={addMonitor}>
                  <Plus size={14} /> 添加
                </button>
              ) : null}
            </div>
            <p className="mdocs-job-hint">一期只保存规则，不做告警推送。</p>
            {monitors.length === 0 ? (
              <div className="mdocs-job-empty-block">还没有监控规则</div>
            ) : (
              <div className="mdocs-job-monitor-list">
                {monitors.map((m, i) => (
                  <div className="mdocs-job-monitor-row" key={m.monitorId}>
                    <span className="mdocs-job-monitor-label">{axisY}</span>
                    <select
                      value={m.rule}
                      disabled={!props.canEdit}
                      onChange={(e) => {
                        const rule = e.target.value;
                        setMonitors((prev) =>
                          prev.map((row, idx) => (idx === i ? { ...row, rule } : row)),
                        );
                      }}
                    >
                      <option value="<=">≤</option>
                      <option value=">=">≥</option>
                      <option value="<">&lt;</option>
                      <option value=">">&gt;</option>
                    </select>
                    <input
                      type="number"
                      value={m.threshold}
                      disabled={!props.canEdit}
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
                        className="ghost danger mdocs-job-icon-btn"
                        onClick={() => setMonitors((prev) => prev.filter((_, idx) => idx !== i))}
                        title="删除规则"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="mdocs-job-card">
          <div className="mdocs-job-card-head">
            <div className="mdocs-job-card-title">
              <Activity size={16} />
              <h2>运行流水</h2>
            </div>
            <span className="mdocs-job-card-meta">{runs.length} 条</span>
          </div>
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
                    <td colSpan={6} className="mdocs-job-empty-cell">
                      尚无运行记录
                    </td>
                  </tr>
                ) : (
                  runs.map((r) => (
                    <tr key={r.id} className={activeRun?.id === r.id ? "is-active-run" : undefined}>
                      <td>
                        <code className="mdocs-job-code" title={String(r.id)}>
                          {shortId(r.id)}
                        </code>
                      </td>
                      <td>
                        <span className={`mdocs-job-status-pill ${statusClass(r.status)}`}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                      <td>{r.trigger}</td>
                      <td>{formatTime(r.start_time)}</td>
                      <td>{formatTime(r.end_time)}</td>
                      <td className="mdocs-job-reason">{r.failed_reason ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function JobChart(props: {
  points: JobDataPoint[];
  axisX: string;
  axisY: string;
}) {
  const { points, axisY } = props;
  if (points.length === 0) {
    return (
      <div className="mdocs-job-chart empty">
        <LineChart size={28} strokeWidth={1.5} />
        <p>跑起来并写入数据后显示折线</p>
      </div>
    );
  }

  const series = points.slice(-60);
  const ys = series.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = maxY - minY || 1;
  const w = 720;
  const h = 220;
  const padL = 44;
  const padR = 16;
  const padT = 18;
  const padB = 28;
  const coords = series.map((p, i) => {
    const x = padL + (i / Math.max(series.length - 1, 1)) * (w - padL - padR);
    const y = padT + (1 - (p.y - minY) / span) * (h - padT - padB);
    return { x, y, p };
  });
  const line = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const area = `${padL},${h - padB} ${line} ${coords[coords.length - 1]!.x},${h - padB}`;
  const ticks = [0, 0.5, 1].map((t) => minY + span * (1 - t));

  return (
    <div className="mdocs-job-chart-frame">
      <svg className="mdocs-job-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${axisY} trend`}>
        {[0, 0.5, 1].map((t, i) => {
          const y = padT + t * (h - padT - padB);
          return (
            <g key={i}>
              <line
                x1={padL}
                x2={w - padR}
                y1={y}
                y2={y}
                className="mdocs-job-chart-grid"
              />
              <text x={padL - 8} y={y + 4} textAnchor="end" className="mdocs-job-chart-tick">
                {Number(ticks[i]!.toFixed(2))}
              </text>
            </g>
          );
        })}
        <polygon points={area} className="mdocs-job-chart-area" />
        <polyline
          fill="none"
          points={line}
          className="mdocs-job-chart-line"
        />
        {coords.map((c) => (
          <circle key={c.p.id} cx={c.x} cy={c.y} r={3.2} className="mdocs-job-chart-dot">
            <title>
              {c.p.x}: {c.p.y}
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
