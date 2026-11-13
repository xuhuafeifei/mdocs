import { getVisitorAgentConfig } from "../../agent/Config/config.js";
import { assertGraphAccess, DocumentError } from "../../access/access-control.js";
import { getDb } from "../../../infra/db/connection.js";
import { findDocumentById } from "../../../infra/db/repositories/document.repo.js";
import { taskQueue } from "../../../infra/task-queue/index.js";
import { FILE_TYPE } from "../../../../shared/file-types.js";
import {
  getDomainGraph,
  getGraphByFolderId,
} from "../graph.service.js";
import type { GraphAgentConfig } from "../graph/graph-agent.js";
import { GraphError } from "../graph-error.js";
import "../graph-task.js"; // 副作用：注册图谱任务

/** 未配置可用 AI 时抛出，前端据此引导用户去配置 */
export class AiNotConfiguredError extends GraphError {
  constructor() {
    super("AI_NOT_CONFIGURED", "请先配置 AI 模型后再生成图谱", 400);
    this.name = "AiNotConfiguredError";
  }
}

/** 优先当前访客默认 AI；未配置再读服务端环境变量（兼容旧部署） */
export function resolveGraphAgentConfig(visitorId: string | null | undefined): GraphAgentConfig {
  if (visitorId) {
    const cfg = getVisitorAgentConfig(visitorId);
    if (cfg?.apiKey) {
      return {
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        modelId: cfg.modelId,
        apiType: cfg.apiType,
        contextWindow: cfg.contextWindow,
        compat: cfg.compat ?? undefined,
      };
    }
  }

  const baseUrl = process.env.ANTHROPIC_BASE_URL;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const modelId =
    process.env.GRAPH_MODEL || process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";
  if (baseUrl && apiKey) {
    return { baseUrl, apiKey, modelId, apiType: "anthropic-messages" };
  }

  throw new AiNotConfiguredError();
}

function rethrowAccess(err: unknown): never {
  if (err instanceof DocumentError) throw err;
  throw err;
}

export function getGraphTask(taskId: string) {
  return taskQueue.getTask(taskId);
}

export function readDomainGraph(domainId: string, visitorId: string | null) {
  try {
    assertGraphAccess(domainId, visitorId);
  } catch (err) {
    rethrowAccess(err);
  }
  return getDomainGraph(domainId);
}

export function enqueueDomainGraphAnalyze(domainId: string, visitorId: string | null) {
  try {
    assertGraphAccess(domainId, visitorId);
    const agentConfig = resolveGraphAgentConfig(visitorId);
    return taskQueue.enqueue("graph-generate", {
      type: "domain",
      targetId: domainId,
      agentConfig,
      visitorId: visitorId ?? undefined,
      force: false,
    });
  } catch (err) {
    if (err instanceof DocumentError || err instanceof GraphError) throw err;
    console.error("[Graph] 域级构建入队失败：", err);
    throw new GraphError(
      "GRAPH_ENQUEUE_FAILED",
      err instanceof Error ? err.message : "入队失败",
      500,
    );
  }
}

export function readFolderGraph(folderId: string, visitorId: string | null) {
  const folder = findDocumentById(getDb(), folderId);
  if (!folder) {
    throw new GraphError("NOT_FOUND", "目录不存在", 404);
  }
  try {
    assertGraphAccess(folder.domain_id, visitorId);
  } catch (err) {
    rethrowAccess(err);
  }
  return getGraphByFolderId(folderId);
}

export function enqueueFolderGraphAnalyze(folderId: string, visitorId: string | null) {
  const folder = findDocumentById(getDb(), folderId);
  if (!folder) {
    throw new GraphError("NOT_FOUND", "目录不存在", 404);
  }

  try {
    assertGraphAccess(folder.domain_id, visitorId);
    const agentConfig = resolveGraphAgentConfig(visitorId);
    // DB 里目录是 FILE_TYPE.FOLDER === "dir"，不是字面量 "folder"
    return taskQueue.enqueue("graph-generate", {
      type: folder.file_type === FILE_TYPE.FOLDER ? "dir" : "doc",
      targetId: folderId,
      agentConfig,
      visitorId: visitorId ?? undefined,
      force: false,
    });
  } catch (err) {
    if (err instanceof DocumentError || err instanceof GraphError) throw err;
    console.error("[Graph] 构建入队失败：", err);
    throw new GraphError(
      "GRAPH_ENQUEUE_FAILED",
      err instanceof Error ? err.message : "入队失败",
      500,
    );
  }
}
