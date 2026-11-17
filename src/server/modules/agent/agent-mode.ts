export type AgentModeParam = "normal" | "coding" | "plugin-pipeline";

export function parseAgentMode(raw: unknown): AgentModeParam {
  if (typeof raw !== "string") return "normal";
  const t = raw.trim();
  if (t === "coding") return "coding";
  if (t === "plugin-pipeline") return "plugin-pipeline";
  return "normal";
}

/** query/body 的 documentId；空串视为 null（空白帮写） */
export function parseDocumentId(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t || null;
}
