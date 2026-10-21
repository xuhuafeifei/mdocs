/**
 * md 局部写：append_document / replace_document_markdown（不出覆写选择卡）。
 */
import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { assertDocumentAccess, DocumentError } from "../../access/access-control.js";
import { getDocument, updateDocument } from "../../documents/document.service.js";
import { markdownToLexicalJson } from "../../documents/markdown-to-lexical.js";
import { extractPlainTextFromLexical } from "../../documents/lexical-text.js";
import { FILE_TYPE } from "../../../shared/file-types.js";
import { asToolResult, type ToolDeps } from "./tool-deps.js";
import { documentChangedNotice } from "./session-tool-persist.js";

const APPEND_CONTENT_MAX = 100_000;
const FIND_MAX = 50_000;

type LexRoot = {
  root?: { children?: unknown[]; [k: string]: unknown };
  [k: string]: unknown;
};

function requireMdDoc(documentId: string, visitorId: string) {
  assertDocumentAccess(documentId, visitorId, "edit");
  const doc = getDocument(documentId, visitorId, "json");
  const fileType = doc.fileType || FILE_TYPE.DOCUMENT;
  if (fileType !== FILE_TYPE.DOCUMENT) {
    throw new Error(
      `NOT_MARKDOWN: append/replace 仅支持 fileType=md，当前为 '${fileType}'`,
    );
  }
  const headCommitId = doc.headCommitId;
  if (!headCommitId) {
    throw new Error("DOCUMENT_HAS_NO_HEAD: 文档缺少 headCommitId，无法安全写入");
  }
  return { doc, headCommitId, rawLexical: doc.content ?? "" };
}

function appendMarkdownIntoLexical(
  existingLexical: string,
  separator: string,
  markdown: string,
): string {
  const trimmedExisting = existingLexical.trim();
  if (!trimmedExisting) {
    return markdownToLexicalJson(markdown);
  }
  let existing: LexRoot;
  try {
    existing = JSON.parse(existingLexical) as LexRoot;
  } catch {
    return markdownToLexicalJson(
      extractPlainTextFromLexical(existingLexical) + separator + markdown,
    );
  }
  if (!existing?.root || !Array.isArray(existing.root.children)) {
    return markdownToLexicalJson(
      extractPlainTextFromLexical(existingLexical) + separator + markdown,
    );
  }
  const plain = extractPlainTextFromLexical(existingLexical);
  const prefix = plain.trim() ? separator : "";
  const addition = JSON.parse(markdownToLexicalJson(prefix + markdown)) as LexRoot;
  const addChildren = Array.isArray(addition.root?.children)
    ? addition.root!.children!
    : [];
  return JSON.stringify({
    ...existing,
    root: {
      ...existing.root,
      children: [...existing.root.children, ...addChildren],
    },
  });
}

function replaceNth(haystack: string, needle: string, replacement: string, n: number): string {
  let from = 0;
  for (let i = 1; i <= n; i += 1) {
    const idx = haystack.indexOf(needle, from);
    if (idx < 0) {
      throw new Error(`OCCURRENCE_OUT_OF_RANGE: find 只出现 ${i - 1} 次，无法取第 ${n} 次`);
    }
    if (i === n) {
      return (
        haystack.slice(0, idx) + replacement + haystack.slice(idx + needle.length)
      );
    }
    from = idx + needle.length;
  }
  throw new Error(`OCCURRENCE_OUT_OF_RANGE: find 出现次数不足 ${n}`);
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  while (true) {
    const idx = haystack.indexOf(needle, from);
    if (idx < 0) break;
    count += 1;
    from = idx + needle.length;
  }
  return count;
}

export function appendDocumentTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "append_document",
    label: "追加文档正文",
    description:
      "在 .md 文档末尾追加 Markdown（不覆写已有内容，无选择卡）。" +
      "写后直接发布。写成功后请重新 get_document，勿沿用旧读结果。" +
      "整篇替换用 overwrite_document；改片段用 replace_document_markdown。仅 fileType=md。",
    parameters: Type.Object({
      documentId: Type.String({ description: "目标文档 documentId" }),
      content: Type.String({ description: "追加的 Markdown" }),
      separator: Type.Optional(
        Type.String({
          description: '已有正文非空时先拼此分隔符再追加；默认 "\\n\\n"',
        }),
      ),
    }),
    execute: async (_id, params) => {
      const p = params as {
        documentId?: string;
        content?: string;
        separator?: string;
      };
      const documentId = String(p.documentId ?? "").trim();
      const content = String(p.content ?? "");
      const separator =
        p.separator === undefined ? "\n\n" : String(p.separator);
      if (!documentId) throw new Error("documentId is required");
      if (content.length > APPEND_CONTENT_MAX) {
        throw new Error(`content exceeds max ${APPEND_CONTENT_MAX}`);
      }
      try {
        const { headCommitId, rawLexical } = requireMdDoc(
          documentId,
          visitorId,
        );
        const nextLexical = appendMarkdownIntoLexical(
          rawLexical,
          separator,
          content,
        );
        const updated = updateDocument({
          actorVisitorId: visitorId,
          documentId,
          content: nextLexical,
          version: { localBaseCommitId: headCommitId },
        });
        const payload = {
          status: "appended",
          documentId,
          displayName: updated.displayName,
          headCommitId: updated.headCommitId ?? null,
          appendedChars: content.length,
          fileType: FILE_TYPE.DOCUMENT,
          notice: documentChangedNotice({
            documentId,
            headCommitId: updated.headCommitId ?? null,
            displayName: updated.displayName,
          }),
        };
        return asToolResult(payload);
      } catch (err) {
        if (err instanceof DocumentError) {
          throw new Error(`${err.code}: ${err.message}`);
        }
        throw err;
      }
    },
  };
}

export function replaceDocumentMarkdownTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "replace_document_markdown",
    label: "替换文档片段",
    description:
      "在 get_document 纯文本层上精确查找并替换（段落/片段级）。" +
      "find 默认须恰好出现 1 次；多次时传 occurrence（1-based）。" +
      "替换后以 Markdown 回写（复杂排版可能简化）。无选择卡，写后直接发布。" +
      "写成功后请重新 get_document。仅 fileType=md。",
    parameters: Type.Object({
      documentId: Type.String({ description: "目标文档 documentId" }),
      find: Type.String({ description: "要查找的原文片段（非空）" }),
      replace: Type.String({ description: "替换为；空字符串表示删除该片段" }),
      occurrence: Type.Optional(
        Type.Number({
          description: "替换第几次出现（1-based）；省略则要求恰好 1 次",
        }),
      ),
    }),
    execute: async (_id, params) => {
      const p = params as {
        documentId?: string;
        find?: string;
        replace?: string;
        occurrence?: number;
      };
      const documentId = String(p.documentId ?? "").trim();
      const find = String(p.find ?? "");
      const replace = String(p.replace ?? "");
      if (!documentId) throw new Error("documentId is required");
      if (!find) throw new Error("find is required");
      if (find.length > FIND_MAX) {
        throw new Error(`find exceeds max ${FIND_MAX}`);
      }
      try {
        const { headCommitId, rawLexical } = requireMdDoc(
          documentId,
          visitorId,
        );
        const plain = extractPlainTextFromLexical(rawLexical);
        const matchCount = countOccurrences(plain, find);
        if (matchCount === 0) {
          throw new Error("FIND_NOT_FOUND: find 在正文中未出现");
        }
        let occurrence = 1;
        if (p.occurrence === undefined || p.occurrence === null) {
          if (matchCount !== 1) {
            throw new Error(
              `FIND_AMBIGUOUS: find 出现 ${matchCount} 次，请传 occurrence（1-based）`,
            );
          }
        } else {
          occurrence = Math.floor(Number(p.occurrence));
          if (!Number.isFinite(occurrence) || occurrence < 1) {
            throw new Error("occurrence must be a positive integer");
          }
          if (occurrence > matchCount) {
            throw new Error(
              `OCCURRENCE_OUT_OF_RANGE: find 共 ${matchCount} 次，无法取第 ${occurrence} 次`,
            );
          }
        }
        const nextPlain = replaceNth(plain, find, replace, occurrence);
        const updated = updateDocument({
          actorVisitorId: visitorId,
          documentId,
          content: nextPlain,
          contentFormat: "markdown",
          version: { localBaseCommitId: headCommitId },
        });
        return asToolResult({
          status: "replaced",
          documentId,
          displayName: updated.displayName,
          headCommitId: updated.headCommitId ?? null,
          matchCount,
          occurrence,
          replaced: true,
          fileType: FILE_TYPE.DOCUMENT,
          notice: documentChangedNotice({
            documentId,
            headCommitId: updated.headCommitId ?? null,
            displayName: updated.displayName,
          }),
        });
      } catch (err) {
        if (err instanceof DocumentError) {
          throw new Error(`${err.code}: ${err.message}`);
        }
        throw err;
      }
    },
  };
}

export function documentEditTools(deps: ToolDeps): AgentTool[] {
  return [appendDocumentTool(deps), replaceDocumentMarkdownTool(deps)];
}
