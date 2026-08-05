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

const OVERWRITE_OPTION = "直接覆写";
const OPEN_CODING_OPTION = "打开帮写审阅";
const CANCEL_OPTION = "取消";

function classifyChoice(choice: string): "overwrite" | "coding" | "cancel" {
  const t = choice.trim();
  if (t === OVERWRITE_OPTION || t === "覆写" || t.includes("直接覆写")) {
    return "overwrite";
  }
  if (t === OPEN_CODING_OPTION || t.includes("帮写")) {
    return "coding";
  }
  if (t === CANCEL_OPTION || t.includes("取消")) {
    return "cancel";
  }
  if (t.includes("覆写")) return "overwrite";
  return "cancel";
}

function doOverwrite(params: {
  visitorId: string;
  documentId: string;
  markdown: string;
  localBaseCommitId: string;
}) {
  const updated = updateDocument({
    actorVisitorId: params.visitorId,
    documentId: params.documentId,
    content: params.markdown,
    contentFormat: "markdown",
    version: { localBaseCommitId: params.localBaseCommitId },
  });
  return asToolResult({
    status: "overwritten",
    documentId: updated.documentId,
    displayName: updated.displayName,
    headCommitId: updated.headCommitId ?? null,
    overwritten: true,
    localBaseCommitId: params.localBaseCommitId,
  });
}

/**
 * Ask 覆写：空文直写；有正文则请用户选「直接覆写 / 打开帮写 / 取消」。
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
      "将完整 Markdown 写入指定文档（服务端）。几乎空则直接写入；已有实质正文时本工具会弹出选择卡，选项固定为以下三项（勿另调 ask_user_choice 自拟其它文案）：「直接覆写」「打开帮写审阅」「取消」。有正文不是无法覆写，只是要用户点选。必须传入完整 markdown。",
    parameters: Type.Object({
      documentId: Type.String({ description: "目标文档 documentId" }),
      markdown: Type.String({ description: "要写入的完整 Markdown 正文" }),
    }),
    execute: async (_id, params) => {
      const documentId = String(
        (params as { documentId?: string }).documentId ?? "",
      ).trim();
      const markdown = String((params as { markdown?: string }).markdown ?? "");
      if (!documentId) throw new Error("documentId is required");

      try {
        assertDocumentAccess(documentId, visitorId, "edit");
        const doc = getDocument(documentId, visitorId, "text");
        const plain = doc.content ?? "";
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
            markdown,
            localBaseCommitId: headCommitId,
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
          title: `「${displayName}」已有正文，请选择`,
          options: [OVERWRITE_OPTION, OPEN_CODING_OPTION, CANCEL_OPTION],
          expiresAt,
        });

        const choiceResult = await promise;
        if (choiceResult.status === "timeout") {
          onEvent({ type: "choice_expired", requestId });
          return asToolResult({
            status: "timeout",
            documentId,
            overwritten: false,
            message: "用户未在时限内选择；未覆写、未打开帮写",
          });
        }
        if (choiceResult.status === "cancelled") {
          return asToolResult({
            status: "cancelled",
            documentId,
            overwritten: false,
            message: "选择已取消；未覆写、未打开帮写",
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
            markdown,
            localBaseCommitId: base,
          });
        }
        if (action === "coding") {
          onEvent({ type: "open_coding", documentId, displayName });
          return asToolResult({
            status: "redirected_to_coding",
            documentId,
            displayName,
            choice,
            overwritten: false,
            message: "已请前端打开帮写；Ask 未覆写服务端正文",
          });
        }

        return asToolResult({
          status: "declined",
          documentId,
          choice,
          overwritten: false,
          message: "用户取消；未覆写、未打开帮写",
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
