/**
 * 从 local / base / remote 三份文本生成 git 冲突 Markdown（供 AI merge）。
 */
import { buildThreeWayMergePlan } from "../../shared/merge/merge-plan.js";
import { serializeMergeMarkedText } from "../../shared/merge/merge-marked-text.js";

export function buildConflictMarkdownFromTexts(params: {
  localMd: string;
  baseMd: string;
  remoteMd: string;
}): { conflictMarkdown: string; unresolvedCount: number } {
  const segments = buildThreeWayMergePlan(params.localMd, params.baseMd, params.remoteMd);
  return serializeMergeMarkedText(segments);
}
