/**
 * 知识图谱相关路由。
 *
 * 目录级：
 * - GET  /:folderId          读取指定目录的图谱缓存
 * - POST /:folderId/analyze  触发指定目录的图谱构建
 *
 * 域级：
 * - GET  /domain/:domainId          读取域级图谱缓存
 * - POST /domain/:domainId/analyze  触发域级图谱构建
 */
import { Router, type Request, type Response } from "express";
import {
  buildDomainGraph,
  buildGraphByDocId,
  getDomainGraph,
  getGraphByFolderId,
} from "../documents/graph.service.js";
import type { GraphAgentConfig } from "../documents/graph/graph-agent.js";
import { findDocumentById } from "../db/repositories/document.repo.js";
import { getDb } from "../db/connection.js";

const router = Router();

/**
 * 获取 Agent 配置（从环境变量读取）。
 * TODO: 后续改成从域配置 / 系统设置中读取
 */
function getAgentConfig(): GraphAgentConfig {
  const baseUrl = process.env.ANTHROPIC_BASE_URL;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const modelId = process.env.GRAPH_MODEL || process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";

  if (!baseUrl || !apiKey) {
    throw new Error("AI 模型配置缺失，请设置 ANTHROPIC_BASE_URL 和 ANTHROPIC_API_KEY");
  }

  return { baseUrl, apiKey, modelId };
}

// ========== 域级 ==========

/**
 * GET /domain/:domainId
 * 读取域级图谱缓存。
 */
router.get("/domain/:domainId", (req: Request, res: Response) => {
  const { domainId } = req.params as { domainId: string };
  const graph = getDomainGraph(domainId);
  res.json({ data: graph });
});

/**
 * POST /domain/:domainId/analyze
 * 触发域级图谱构建。
 */
router.post("/domain/:domainId/analyze", async (req: Request, res: Response) => {
  const { domainId } = req.params as { domainId: string };

  try {
    const agentConfig = getAgentConfig();
    const graph = await buildDomainGraph(domainId, agentConfig);
    res.json({ data: graph });
  } catch (err) {
    console.error("[Graph] 域级构建失败：", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "构建失败" });
  }
});

// ========== 目录级 ==========

/**
 * GET /:folderId
 * 读取指定目录的图谱缓存。
 *
 * 如果还没有生成过，返回 { data: null }。
 */
router.get("/:folderId", (req: Request, res: Response) => {
  const { folderId } = req.params as { folderId: string };
  const graph = getGraphByFolderId(folderId);
  res.json({ data: graph });
});

/**
 * POST /:folderId/analyze
 * 触发指定目录的图谱构建。
 *
 * 初版同步返回（小目录够用），后续改成异步任务。
 */
router.post("/:folderId/analyze", async (req: Request, res: Response) => {
  const { folderId } = req.params as { folderId: string };

  const db = getDb();
  const folder = findDocumentById(db, folderId);
  if (!folder) {
    res.status(404).json({ error: "目录不存在" });
    return;
  }

  try {
    const agentConfig = getAgentConfig();
    const graph = await buildGraphByDocId(folderId, agentConfig);
    res.json({ data: graph });
  } catch (err) {
    console.error("[Graph] 构建失败：", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "构建失败" });
  }
});

export function buildGraphRouter(): Router {
  return router;
}
