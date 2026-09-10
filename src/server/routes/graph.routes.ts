/**
 * 知识图谱相关路由。
 *
 * 目录级：
 * - GET  /:folderId          读取指定目录的图谱缓存
 * - POST /:folderId/analyze  触发指定目录的图谱构建（异步入队）
 *
 * 域级：
 * - GET  /domain/:domainId          读取域级图谱缓存
 * - POST /domain/:domainId/analyze  触发域级图谱构建（异步入队）
 *
 * 任务查询：
 * - GET /tasks/:taskId       查询任务状态 + 进度
 */
import { Router, type Request, type Response } from "express";
import {
  buildDomainGraph,
  buildGraphByDocId,
  getDomainGraph,
  getGraphByFolderId,
} from "../documents/graph.service.js";
import type { GraphAgentConfig } from "../documents/graph/graph-agent.js";
import { getVisitorAgentConfig } from "../agent/Config/config.js";
import { findDocumentById } from "../db/repositories/document.repo.js";
import { getDb } from "../db/connection.js";
import { taskQueue } from "../task-queue/index.js";
import { FILE_TYPE } from "../../shared/file-types.js";
import "../documents/graph-task.js"; // 副作用导入，注册图谱任务

const router = Router();

/** 未配置可用 AI 时抛出，前端据此引导用户去配置（而不是显示一句泛泛的失败） */
class AiNotConfiguredError extends Error {
  readonly code = "AI_NOT_CONFIGURED";
  constructor() {
    super("请先配置 AI 模型后再生成图谱");
  }
}

/** 优先用当前访客默认 AI 配置；未配置时再读服务端环境变量（兼容旧部署） */
function getAgentConfig(req: Request): GraphAgentConfig {
  const visitorId = req.visitor?.visitor_id;
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
  const modelId = process.env.GRAPH_MODEL || process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";
  if (baseUrl && apiKey) {
    return { baseUrl, apiKey, modelId, apiType: "anthropic-messages" };
  }

  throw new AiNotConfiguredError();
}

/* ── 任务查询 ── */

router.get("/tasks/:taskId", (req: Request, res: Response) => {
  const { taskId } = req.params as { taskId: string };
  const result = taskQueue.getTask(taskId);
  res.json({ data: result });
});

// ========== 域级 ==========

router.get("/domain/:domainId", (req: Request, res: Response) => {
  const { domainId } = req.params as { domainId: string };
  const graph = getDomainGraph(domainId);
  res.json({ data: graph });
});

router.post("/domain/:domainId/analyze", (req: Request, res: Response) => {
  const { domainId } = req.params as { domainId: string };

  try {
    const agentConfig = getAgentConfig(req);
    const result = taskQueue.enqueue("graph-generate", {
      type: "domain",
      targetId: domainId,
      agentConfig,
      visitorId: req.visitor?.visitor_id,
      force: false,
    });
    res.json({ data: result });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      res.status(400).json({ error: { code: err.code, message: err.message } });
      return;
    }
    console.error("[Graph] 域级构建入队失败：", err);
    const message = err instanceof Error ? err.message : "入队失败";
    res.status(500).json({ error: { code: "GRAPH_ENQUEUE_FAILED", message } });
  }
});

// ========== 目录级 ==========

router.get("/:folderId", (req: Request, res: Response) => {
  const { folderId } = req.params as { folderId: string };
  const graph = getGraphByFolderId(folderId);
  res.json({ data: graph });
});

router.post("/:folderId/analyze", (req: Request, res: Response) => {
  const { folderId } = req.params as { folderId: string };

  const db = getDb();
  const folder = findDocumentById(db, folderId);
  if (!folder) {
    res.status(404).json({ error: { message: "目录不存在" } });
    return;
  }

  try {
    const agentConfig = getAgentConfig(req);
    // DB 里目录是 FILE_TYPE.FOLDER === "dir"，不是字面量 "folder"
    const result = taskQueue.enqueue("graph-generate", {
      type: folder.file_type === FILE_TYPE.FOLDER ? "dir" : "doc",
      targetId: folderId,
      agentConfig,
      visitorId: req.visitor?.visitor_id,
      force: false,
    });
    res.json({ data: result });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      res.status(400).json({ error: { code: err.code, message: err.message } });
      return;
    }
    console.error("[Graph] 构建入队失败：", err);
    const message = err instanceof Error ? err.message : "入队失败";
    res.status(500).json({ error: { code: "GRAPH_ENQUEUE_FAILED", message } });
  }
});

export function buildGraphRouter(): Router {
  return router;
}
