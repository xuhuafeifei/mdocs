/** 文档发布 commit 来源（写入 document_commits.source）。 */
export type PublishSource = "auto" | "manual" | "agent" | "cli";

export const PUBLISH_SOURCES: readonly PublishSource[] = [
  "auto",
  "manual",
  "agent",
  "cli",
] as const;

/** 自动发布固定文案（服务端在 source=auto 时强制）。 */
export const AUTO_PUBLISH_MESSAGE = "自动发布";

/** message 最大字符数（码点近似用 String.length）。 */
export const PUBLISH_MESSAGE_MAX_LENGTH = 500;

export function isPublishSource(value: unknown): value is PublishSource {
  return typeof value === "string" && (PUBLISH_SOURCES as readonly string[]).includes(value);
}
