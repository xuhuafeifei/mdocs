export type JobTableSchema = { x: string; y: string };

export type JobFileConfig = {
  jobId: string;
  jobType: string;
  cron: string;
  prompt: string;
  tableSchema: JobTableSchema;
};

export type JobMonitorRule = {
  monitorId: string;
  rule: string;
  threshold: number;
};

export type JobFileDocument = {
  JobConfig: JobFileConfig;
  MonitorConfig: JobMonitorRule[];
};

export function defaultJobFileDocument(jobId: string): JobFileDocument {
  return {
    JobConfig: {
      jobId,
      jobType: "agent",
      cron: "",
      prompt: "",
      tableSchema: { x: "时间", y: "价格" },
    },
    MonitorConfig: [],
  };
}

export function serializeJobFile(doc: JobFileDocument): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

export function parseJobFileContent(raw: string): JobFileDocument {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) {
    throw new Error("invalid job file json");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("invalid job file json");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("invalid job file shape");
  }
  const root = parsed as Record<string, unknown>;
  const cfgRaw = root.JobConfig;
  if (!cfgRaw || typeof cfgRaw !== "object") {
    throw new Error("JobConfig missing");
  }
  const cfg = cfgRaw as Record<string, unknown>;
  const schemaRaw =
    cfg.tableSchema && typeof cfg.tableSchema === "object"
      ? (cfg.tableSchema as Record<string, unknown>)
      : {};

  const monitors = normalizeMonitorConfig(root.MonitorConfig);

  return {
    JobConfig: {
      jobId: String(cfg.jobId ?? cfg.JobId ?? "").trim(),
      jobType: String(cfg.jobType ?? cfg.JobType ?? "agent").trim() || "agent",
      cron: String(cfg.cron ?? "").trim(),
      prompt: String(cfg.prompt ?? ""),
      tableSchema: {
        x: String(schemaRaw.x ?? "x"),
        y: String(schemaRaw.y ?? "y"),
      },
    },
    MonitorConfig: monitors,
  };
}

/** 创建时：空内容用默认壳；已有 JSON 则强制 jobId。 */
export function ensureJobFileContent(raw: string, jobId: string): string {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) {
    return serializeJobFile(defaultJobFileDocument(jobId));
  }
  try {
    const doc = parseJobFileContent(trimmed);
    doc.JobConfig.jobId = jobId;
    return serializeJobFile(doc);
  } catch {
    return serializeJobFile(defaultJobFileDocument(jobId));
  }
}

function normalizeMonitorConfig(raw: unknown): JobMonitorRule[] {
  if (!Array.isArray(raw)) return [];
  const out: JobMonitorRule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const monitorId = String(row.monitorId ?? "").trim();
    const rule = String(row.rule ?? "").trim();
    const threshold = Number(row.threshold ?? row.data);
    if (!monitorId || !rule || !Number.isFinite(threshold)) continue;
    out.push({ monitorId, rule, threshold });
  }
  return out;
}
