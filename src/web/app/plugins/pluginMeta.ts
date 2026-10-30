/**
 * 插件 UI 文案 / 摘要 helper：只做展示，不承载业务。
 */
import type {
  PipelineInstallHistoryEntry,
  PipelineInstallMode,
  PipelineListItem,
} from "../../services/endpoints";
import type { TranslationKey } from "../../i18n/types";

export type T = (key: TranslationKey, vars?: Record<string, string>) => string;

export function modeLabel(mode: PipelineInstallMode, t: T): string {
  if (mode === "local_binary") return t("plInstallModeLocal");
  if (mode === "command") return t("plInstallModeCommand");
  if (mode === "remote") return t("plInstallModeRemote");
  return t("plInstallModeSkill");
}

export function sourceLabel(kind: PipelineListItem["kind"], t: T): string {
  if (kind === "system") return t("pluginBadgeSystem");
  if (kind === "tenant") return t("plBadgeTenant");
  return t("plBadgeUser");
}

export function sourceClass(kind: PipelineListItem["kind"]): string {
  return kind === "system" ? "system" : kind === "tenant" ? "tenant" : "custom";
}

export function outputsLabel(outputs: string[]): string {
  const parts: string[] = [];
  if (outputs.includes("mcp")) parts.push("MCP");
  if (outputs.includes("skill")) parts.push("Skill");
  return parts.join(" + ") || "—";
}

export function statusOf(
  pipe: PipelineListItem,
  t: T,
): { label: string; tone: "live" | "on" | "off" | "running" | "error" } {
  const job = pipe.installJob;
  if (job && job.status === "running") {
    return { label: t("plRunnerRunning"), tone: "running" };
  }
  if (job && job.status === "error") {
    return { label: t("plRunnerFailed"), tone: "error" };
  }
  if (!pipe.installed) return { label: t("pluginStatusNotInstalled"), tone: "off" };
  if (pipe.runtime === "engram") {
    return pipe.runtimeRunning
      ? { label: t("pluginRuntimeRunning"), tone: "live" }
      : { label: t("pluginRuntimeStopped"), tone: "on" };
  }
  return { label: t("plSectionInstalled"), tone: "on" };
}

const STEP_KEYS: Record<string, TranslationKey> = {
  download: "plStepDownload",
  extract: "plStepExtract",
  copy_file: "plStepCopyFile",
  exec: "plStepExec",
  upsert_mcp: "plStepUpsertMcp",
  upsert_skill: "plStepUpsertSkill",
  write_soul_sidecar: "plStepWriteSoul",
  delete_soul_sidecar: "plStepDeleteSoul",
  remove_mcp: "plStepRemoveMcp",
  remove_skill: "plStepRemoveSkill",
};

const PROBE_KEYS: Record<string, TranslationKey> = {
  file_exists: "plProbeFileExists",
  http_health: "plProbeHttp",
  npm_global: "plProbeNpm",
};

export function stepLabel(
  type: string,
  fallback: string | undefined,
  t: T,
): string {
  const key = STEP_KEYS[type];
  return key ? t(key) : fallback ?? type;
}

export function probeLabel(type: string, fallback: string | undefined, t: T): string {
  const key = PROBE_KEYS[type];
  return key ? t(key) : fallback ?? type;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

export function stepSummary(
  step: Record<string, unknown>,
  t: T,
): string {
  const type = String(step.type ?? "");
  if (type === "download") {
    const url = String(step.url ?? "").trim();
    return url || t("plInstallModeLocal") + " · 内置下载源";
  }
  if (type === "extract") {
    return `→ ${String(step.dest ?? ".")}`;
  }
  if (type === "copy_file") {
    return `${String(step.from ?? "")} → ${String(step.to ?? "")}`;
  }
  if (type === "exec") {
    const args = asStringArray(step.args);
    return `$ ${String(step.command ?? "")} ${args.join(" ")}`.trim();
  }
  if (type === "upsert_mcp") {
    const transport = String(step.transport ?? "stdio");
    return transport === "http"
      ? `HTTP · ${String(step.url ?? "")}`
      : `stdio · ${String(step.command ?? "")} ${asStringArray(step.args).join(" ")}`.trim();
  }
  if (type === "upsert_skill") {
    return String(step.name ?? "");
  }
  if (type === "write_soul_sidecar" || type === "delete_soul_sidecar") {
    return `${step.scope === "tenant" ? t("plSoulTenant") : t("plSoulGlobal")} · ${String(step.file ?? "")}`;
  }
  if (type === "remove_mcp") {
    return String(step.mcp_server_id ?? "") || `plugin-<id>`;
  }
  if (type === "remove_skill") {
    return String(step.name ?? "");
  }
  return "";
}

export function probeSummary(probe: Record<string, unknown>): string {
  const type = String(probe.type ?? "");
  if (type === "file_exists") return String(probe.path ?? "");
  if (type === "http_health") return String(probe.url ?? "");
  if (type === "npm_global") return String(probe.package ?? "");
  return "";
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function historyFor(
  history: PipelineInstallHistoryEntry[],
  pipelineId: string,
): PipelineInstallHistoryEntry[] {
  return history.filter((h) => h.id === pipelineId).slice(0, 8);
}

export function whenLabel(
  when: string | undefined,
  t: T,
): string | null {
  if (!when || when === "always") return null;
  if (when === "first_install") return t("plStepConditionFirst");
  if (when === "probe_passed") return t("plStepConditionProbePassed");
  if (when === "probe_failed") return t("plStepConditionProbeFailed");
  return when;
}
