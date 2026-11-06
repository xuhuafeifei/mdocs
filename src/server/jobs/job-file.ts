export type JobFileConfig = {
  jobId: string;
  jobType: string;
  cron: string;
  prompt: string;
  tableSchema: { x: string; y: string };
};

export type JobFileDocument = {
  JobConfig: JobFileConfig;
  MonitorConfig?: unknown;
};

export function parseJobFileContent(raw: string): JobFileDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
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
    MonitorConfig: root.MonitorConfig,
  };
}
