import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { assertDocumentAccess, DocumentError } from "../../access/access-control.js";
import { getDocument, updateDocument } from "../../documents/document.service.js";
import { isAlmostEmptyDocumentText } from "./almost-empty.js";
import {
  DEFAULT_CHOICE_TIMEOUT_MS,
  waitForUserChoice,
} from "./choice-pending.js";
import { asToolResult, type ToolDeps } from "./tool-deps.js";
import { FILE_TYPE } from "../../../shared/file-types.js";
import { canOverwrite, getPolicy } from "../../../shared/file-type-policy.js";
import { documentChangedNotice } from "./session-tool-persist.js";

/**
 * 已有正文时的落地方式。不再有「帮写」中转：两种方式都直接作用在当前编辑器，
 * 区别只是改动先变成可审阅的 Diff，还是立刻生效。
 */
const DIFF_OPTION = "先看 Diff 再定";
const OVERWRITE_OPTION = "直接覆盖";
const CANCEL_OPTION = "取消";

function classifyChoice(choice: string): "diff" | "overwrite" | "cancel" {
  const t = choice.trim();
  // diff 先判：以免「先看 Diff」里含「覆盖」类字眼被误分类（历史文案兼容）
  if (
    t === DIFF_OPTION ||
    t.includes("Diff") ||
    t.includes("diff") ||
    t.includes("差异") ||
    t.includes("审阅") ||
    t.includes("帮写")
  ) {
    return "diff";
  }
  if (t === OVERWRITE_OPTION || t.includes("覆盖") || t.includes("覆写")) {
    return "overwrite";
  }
  if (t === CANCEL_OPTION || t.includes("取消")) {
    return "cancel";
  }
  return "cancel";
}

function doOverwrite(params: {
  visitorId: string;
  documentId: string;
  content: string;
  localBaseCommitId: string;
  fileType: string;
  message: string;
}) {
  const policy = getPolicy(params.fileType as any);
  const isRaw = policy.writeNormalize === "raw";
  const updated = updateDocument({
    actorVisitorId: params.visitorId,
    documentId: params.documentId,
    content: params.content,
    // html：原样 raw，勿传 contentFormat=markdown
    ...(isRaw ? {} : { contentFormat: "markdown" as const }),
    version: { localBaseCommitId: params.localBaseCommitId },
    message: params.message,
    source: "agent",
  });
  return asToolResult({
    status: "overwritten",
    documentId: updated.documentId,
    displayName: updated.displayName,
    headCommitId: updated.headCommitId ?? null,
    overwritten: true,
    localBaseCommitId: params.localBaseCommitId,
    fileType: params.fileType,
    notice: documentChangedNotice({
      documentId: updated.documentId,
      headCommitId: updated.headCommitId ?? null,
      displayName: updated.displayName,
    }),
  });
}

/**
 * Ask 覆写：空文直写；有正文则请用户选「直接覆写 / 打开帮写 / 取消」。
 * md → content 必须是 Markdown；html → content 必须是 HTML。不做格式互转。
 */
export function overwriteDocumentTool({
  visitorId,
  onEvent,
  signal,
}: ToolDeps): AgentTool {
  return {
    name: "overwrite_document",
    label: "覆写文档正文",
    description:
      "整篇写入完整正文（服务端）。" +
      "适用：.md 大改（重写大半篇/多段大面积改写/结构重排）、用户明确要求整篇重写、文档几乎为空、或目标是 html；" +
      "小改（一两处片段）仍用 replace_document_markdown / append_document。" +
      "必须先确认 fileType：md → 完整 Markdown；html → 完整 HTML（禁止传 Markdown，不做 MD↔HTML 转换）。" +
      "几乎空则直接写入；已有实质正文时弹出选择卡：「先看 Diff 再定」「直接覆盖」「取消」。" +
      "用户选「先看 Diff 再定」时改动不会立刻落库，而是作为 Diff 交给前端在编辑器里审阅，确认后另行发布。" +
      "有正文不是无法覆写，只是要用户点选。必须传 message（简短发布说明）。",
    parameters: Type.Object({
      documentId: Type.String({ description: "目标文档 documentId" }),
      content: Type.String({
        description:
          "完整正文，格式必须与文档类型一致：md→Markdown；html→HTML。禁止错格式，系统不会自动转换",
      }),
      message: Type.String({
        description: "本次发布说明（必填，简短中文，说明整篇改了什么）",
      }),
    }),
    execute: async (_id, params) => {
      const raw = params as {
        documentId?: string;
        content?: string;
        markdown?: string;
        message?: string;
      };
      const documentId = String(raw.documentId ?? "").trim();
      const content = String(raw.content ?? raw.markdown ?? "");
      const message = String(raw.message ?? "").trim();
      if (!documentId) throw new Error("documentId is required");
      if (!message) throw new Error("message is required");

      try {
        assertDocumentAccess(documentId, visitorId, "edit");
        const doc = getDocument(documentId, visitorId, "text");
        const plain = doc.content ?? "";
        const fileType = doc.fileType || FILE_TYPE.DOCUMENT;

        if (!canOverwrite(fileType as any) || fileType === FILE_TYPE.SHEET) {
          return asToolResult({
            status: "rejected",
            documentId,
            overwritten: false,
            message: "仅支持覆写普通文档，不支持该类型的文件",
          });
        }
        const displayName =
          String(doc.displayName ?? "").trim() || "未命名文档";
        const headCommitId = doc.headCommitId;
        if (!headCommitId) {
          throw new Error(
            "DOCUMENT_HAS_NO_HEAD: 文档缺少 headCommitId，无法安全覆写",
          );
        }

        if (isAlmostEmptyDocumentText(plain)) {
          return doOverwrite({
            visitorId,
            documentId,
            content,
            localBaseCommitId: headCommitId,
            fileType,
            message,
          });
        }

        const { requestId, promise } = waitForUserChoice({
          visitorId,
          timeoutMs: DEFAULT_CHOICE_TIMEOUT_MS,
          signal,
        });
        const expiresAt = new Date(
          Date.now() + DEFAULT_CHOICE_TIMEOUT_MS,
        ).toISOString();
        onEvent({
          type: "choice_card",
          requestId,
          title: `「${displayName}」已有正文，这次改动怎么落地？`,
          options: [DIFF_OPTION, OVERWRITE_OPTION, CANCEL_OPTION],
          expiresAt,
        });

        const choiceResult = await promise;
        if (choiceResult.status === "timeout") {
          onEvent({ type: "choice_expired", requestId });
          return asToolResult({
            status: "timeout",
            documentId,
            overwritten: false,
            message: "用户未在时限内选择；未覆写、未进入 Diff 审阅",
          });
        }
        if (choiceResult.status === "cancelled") {
          return asToolResult({
            status: "cancelled",
            documentId,
            overwritten: false,
            message: "选择已取消；未覆写、未进入 Diff 审阅",
          });
        }

        const choice = choiceResult.choice ?? "";
        const action = classifyChoice(choice);
        if (action === "overwrite") {
          const fresh = getDocument(documentId, visitorId, "text");
          const base = fresh.headCommitId;
          if (!base) {
            throw new Error(
              "DOCUMENT_HAS_NO_HEAD: 文档缺少 headCommitId，无法安全覆写",
            );
          }
          return doOverwrite({
            visitorId,
            documentId,
            content,
            localBaseCommitId: base,
            fileType: fresh.fileType || fileType,
            message,
          });
        }
        if (action === "diff") {
          // 改动以 Diff 形式交给前端：先校验/打开目标文档，再在编辑器里落地，用户确认后才发布。
          // 服务端此刻不写正文，content 原样下发，前端落地后走正常的发布链路。
          onEvent({
            type: "diff_proposal",
            documentId,
            displayName,
            fileType,
            markdown: content,
          });
          return asToolResult({
            status: "proposed_as_diff",
            documentId,
            displayName,
            choice,
            overwritten: false,
            message:
              "改动已作为 Diff 交给前端；用户审阅确认后才会写入正文。服务端暂未覆写。",
          });
        }

        return asToolResult({
          status: "declined",
          documentId,
          choice,
          overwritten: false,
          message: "用户取消；未覆写、未进入 Diff 审阅",
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
