/**
 * submit_pipeline 交卷后的 YAML 归一：锁定 id/kind、补 outputs、清理 uninstall。
 */
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export function normalizeDraftYaml(yaml: string, currentYaml?: string): string {
  let doc: Record<string, unknown>;
  try {
    const parsed = parseYaml(yaml) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return yaml;
    doc = { ...(parsed as Record<string, unknown>) };
  } catch {
    return yaml;
  }

  let current: Record<string, unknown> | null = null;
  if (currentYaml) {
    try {
      const parsed = parseYaml(currentYaml) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        current = parsed as Record<string, unknown>;
      }
    } catch {
      current = null;
    }
  }

  const rawKind = String(doc.kind ?? "");
  const kind =
    typeof current?.kind === "string" && current.kind.trim()
      ? current.kind.trim()
      : rawKind === "system" || rawKind === "user" || rawKind === "tenant"
        ? rawKind
        : "tenant";
  doc.kind = kind;

  if (typeof current?.id === "string" && current.id.trim()) {
    doc.id = current.id.trim();
  } else if (!doc.id) {
    doc.id = "draft-pipeline";
  }

  const steps = Array.isArray(doc.steps) ? (doc.steps as Array<Record<string, unknown>>) : [];
  if (!Array.isArray(doc.outputs) || doc.outputs.length === 0) {
    const hasSkill = steps.some((s) => s && s.type === "upsert_skill");
    const hasMcp = steps.some((s) => s && s.type === "upsert_mcp");
    doc.outputs = hasSkill && !hasMcp ? ["skill"] : ["mcp"];
  }

  if (Array.isArray(doc.uninstall)) {
    const uninstall = doc.uninstall as Array<Record<string, unknown>>;
    for (const step of uninstall) {
      if (!step || typeof step !== "object") continue;
      if (step.type === "remove_mcp") {
        const id = String(step.mcp_server_id ?? "").trim();
        if (id && !id.startsWith("plugin-")) delete step.mcp_server_id;
      }
    }
    if (uninstall.length === 0) delete doc.uninstall;
  }

  return stringifyYaml(doc, { lineWidth: 100 });
}
