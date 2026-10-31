/**
 * AI 安装台：左栏直接复用 AgentChatPanel（mode=plugin-pipeline），右栏仅流程节点。
 */
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n";
import {
  createCustomPipelineApi,
  fetchPipelineJobApi,
  installPipelineApi,
  savePipelineYamlApi,
  type AiPipelineDraft,
  type PipelineJob,
  type PipelineJobStepStatus,
} from "../../services/endpoints";
import { AgentChatPanel } from "../AgentChatPanel";
import { parsePipelineAst, stringifyPipelineAst } from "../pipeline/pipelineAst";
import { stepLabel } from "./pluginMeta";
import "./plugins.css";

type Props = {
  onClose: () => void;
  onInstalled?: () => void;
  /** 嵌在新建向导 Tab 内时隐藏自身标题栏 */
  embedded?: boolean;
};

function statusIcon(status: PipelineJobStepStatus): string {
  if (status === "done") return "✓";
  if (status === "running") return "●";
  if (status === "skipped") return "–";
  if (status === "error") return "!";
  return "·";
}

function rewriteYamlId(yaml: string, id: string): string {
  const ast = parsePipelineAst(yaml);
  ast.id = id;
  return stringifyPipelineAst(ast);
}

export function AiInstallBench(props: Props) {
  const { t } = useI18n();
  const [draftYaml, setDraftYaml] = useState<string | null>(null);
  const [boundServerId, setBoundServerId] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [job, setJob] = useState<PipelineJob | null>(null);
  const [installNotice, setInstallNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const draftAst = useMemo(() => {
    if (!draftYaml) return null;
    try {
      return parsePipelineAst(draftYaml);
    } catch {
      return null;
    }
  }, [draftYaml]);

  useEffect(() => {
    if (!boundServerId || !job || job.status !== "running") return;
    const timer = window.setInterval(() => {
      void fetchPipelineJobApi("tenant", boundServerId, "install")
        .then((res) => {
          if (res.job) {
            setJob(res.job);
            if (res.job.status === "done") {
              setInstallNotice(t("plAiInstallStayHint"));
              props.onInstalled?.();
            }
          }
        })
        .catch(() => {});
    }, 1200);
    return () => window.clearInterval(timer);
  }, [boundServerId, job, props, t]);

  function onPipelineDraft(draft: AiPipelineDraft) {
    setInstallNotice(null);
    setError(draft.valid ? null : draft.error ?? null);
    if (!draft.yaml?.trim()) return;
    setDraftYaml(draft.yaml);
    try {
      const nextId = parsePipelineAst(draft.yaml).id;
      if (boundServerId && nextId !== boundServerId) {
        setBoundServerId(null);
        setJob(null);
      }
    } catch {
      /* ignore */
    }
  }

  function onPipelineJob(payload: {
    scope: "system" | "tenant";
    id: string;
    yaml?: string;
    job: PipelineJob;
  }) {
    if (payload.yaml?.trim()) setDraftYaml(payload.yaml);
    setBoundServerId(payload.id);
    setJob(payload.job);
    setInstalling(payload.job.status === "running");
    setError(payload.job.status === "error" ? payload.job.error : null);
    if (payload.job.status === "done") {
      setInstallNotice(t("plAiInstallStayHint"));
      props.onInstalled?.();
    }
  }

  function clearRightDraft() {
    setDraftYaml(null);
    setBoundServerId(null);
    setJob(null);
    setInstallNotice(null);
    setError(null);
  }

  async function installDraft() {
    if (!draftYaml || installing) return;
    setInstalling(true);
    setError(null);
    setInstallNotice(null);
    try {
      let serverId = boundServerId;
      let yaml = draftYaml;
      if (!serverId) {
        const ast = parsePipelineAst(draftYaml);
        const created = await createCustomPipelineApi({
          name: ast.name,
          installMode:
            (ast.install_mode as
              | "remote"
              | "local_binary"
              | "command"
              | "skill_package") || "remote",
          outputs:
            ast.outputs.includes("skill") && !ast.outputs.includes("mcp")
              ? ["skill"]
              : ["mcp"],
        });
        serverId = created.id;
        yaml = rewriteYamlId(draftYaml, serverId);
        await savePipelineYamlApi("tenant", serverId, yaml);
        setBoundServerId(serverId);
        setDraftYaml(yaml);
      } else {
        yaml = rewriteYamlId(draftYaml, serverId);
        await savePipelineYamlApi("tenant", serverId, yaml);
        setDraftYaml(yaml);
      }
      const started = await installPipelineApi("tenant", serverId);
      setJob(started.job);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setInstalling(false);
    }
  }

  const displayId = boundServerId || draftAst?.id || "—";
  const nodeSteps = draftAst?.steps ?? [];
  const jobByIndex = new Map((job?.steps ?? []).map((s) => [s.index, s]));

  return (
    <div className={props.embedded ? "pl-ai-bench embedded" : "pl-ai-bench"}>
      {props.embedded ? null : (
        <div className="pl-ai-bench-head">
          <div style={{ flex: 1 }}>
            <h3>{t("plAiBenchTitle")}</h3>
            <p className="pl-modal-sub">{t("plAiBenchHint")}</p>
          </div>
          <button
            type="button"
            className="pl-x"
            onClick={props.onClose}
            aria-label={t("close")}
          >
            ×
          </button>
        </div>
      )}

      <div className="pl-ai-bench-body">
        <section className="pl-ai-bench-left" aria-label={t("plAiBenchChat")}>
          <AgentChatPanel
            open
            embedded
            mode="plugin-pipeline"
            pipelineCurrentYaml={draftYaml}
            onPipelineDraft={onPipelineDraft}
            onPipelineJob={onPipelineJob}
            onClose={props.onClose}
          />
        </section>

        <section className="pl-ai-bench-right" aria-label={t("plAiBenchNodes")}>
          <div className="pl-ai-right-head">
            <div>
              <div className="pl-block-title">{t("plAiBenchNodes")}</div>
              <p className="pl-field-hint">
                {t("plAiDraftId")}: <code>{displayId}</code>
              </p>
            </div>
            <button
              type="button"
              className="pl-btn ghost"
              onClick={clearRightDraft}
              disabled={!draftYaml && !boundServerId}
            >
              {t("plAiInstallAnother")}
            </button>
          </div>

          {!draftAst ? (
            <p className="pl-section-hint">{t("plAiNodesEmpty")}</p>
          ) : (
            <>
              <div className="pl-ai-draft-meta">
                <strong>{draftAst.name}</strong>
                <span className="pl-badge">{draftAst.install_mode || "—"}</span>
                <span className="pl-badge">
                  {draftAst.outputs.join(" · ") || "—"}
                </span>
              </div>
              {draftAst.probe.length > 0 ? (
                <div className="pl-block">
                  <div className="pl-block-title">Probe</div>
                  <ul className="pl-ai-node-list">
                    {draftAst.probe.map((p, i) => (
                      <li key={"p" + i}>
                        <span className="pl-ai-node-dot">·</span>
                        {String(p.type ?? "probe")}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="pl-block">
                <div className="pl-block-title">{t("plInstallAction")}</div>
                <ul className="pl-ai-node-list">
                  {nodeSteps.map((step, i) => {
                    const st = jobByIndex.get(i)?.status ?? "pending";
                    return (
                      <li key={i}>
                        <span className={"pl-ai-node-dot st-" + st}>
                          {statusIcon(st)}
                        </span>
                        <span>
                          {stepLabel(
                            String(step.type ?? ""),
                            String(step.type ?? ""),
                            t,
                          )}
                          {typeof step.name === "string" ? ` · ${step.name}` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              {job?.logs?.length ? (
                <pre className="pl-ai-job-log">
                  {job.logs
                    .slice(-40)
                    .map((l) => l.line)
                    .join("\n")}
                </pre>
              ) : null}
              {installNotice ? <p className="pl-notice">{installNotice}</p> : null}
              {error ? <p className="pl-error">{error}</p> : null}
              {job?.status === "error" ? (
                <p className="pl-error">{job.error || t("plRunnerFailed")}</p>
              ) : null}
              <div className="pl-ai-right-actions">
                <button
                  type="button"
                  className="pl-btn primary"
                  disabled={installing || job?.status === "running"}
                  onClick={() => void installDraft()}
                >
                  {installing || job?.status === "running"
                    ? t("pluginBusy")
                    : job?.status === "done"
                      ? t("plReinstall")
                      : t("plInstallAction")}
                </button>
                <button
                  type="button"
                  className="pl-btn ghost"
                  onClick={props.onClose}
                >
                  {t("plAiCloseBench")}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
