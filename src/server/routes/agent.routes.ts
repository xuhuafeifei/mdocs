import { Router, type Request, type Response } from "express";
import {
  getAgentStatus,
  getAgentContextUsageForApi,
  runOnboardingChat,
  type AgentStreamEvent,
} from "../agent/Agent/run.js";
import { getAgentSessionForApi, createAgentSessionForApi, listAgentSessionsForApi, openAgentSessionForApi, bindCodingSessionDocumentForApi } from "../agent/Agent/session-manager.js";
import { resolveUserChoice, expireUserChoice } from "../agent/Agent/choice-pending.js";
import {
  getVisitorAgentConfig,
  isAgentModelId,
  normalizeContextWindow,
  toPublicAgentConfig,
  upsertVisitorAgentConfig,
} from "../agent/Config/config.js";
import { useLogger } from "../logger/logger.js";

const log = useLogger("agent-route");

function writeSse(res: Response, event: AgentStreamEvent) {
  if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function parseAgentMode(raw: unknown): "normal" | "coding" {
  return typeof raw === "string" && raw.trim() === "coding" ? "coding" : "normal";
}

/** query/body 的 documentId；空串视为 null（空白帮写） */
function parseDocumentId(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t || null;
}

/** 薄封装：校验入参 → 调 agent 层 → 把 onEvent 写成 SSE */
export function buildAgentRouter(): Router {
  const router = Router();

  router.get("/status", (req, res) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "login required" } });
      return;
    }
    res.json({ data: getAgentStatus(req.visitor.visitor_id) });
  });

  router.get("/config", (req, res) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "login required" } });
      return;
    }
    const cfg = getVisitorAgentConfig(req.visitor.visitor_id);
    res.json({ data: cfg ? toPublicAgentConfig(cfg) : null });
  });

  router.put("/config", (req, res) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "login required" } });
      return;
    }

    const modelId = typeof req.body?.modelId === "string" ? req.body.modelId.trim() : "";
    if (!isAgentModelId(modelId)) {
      res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "modelId must be deepseek-v4-flash or deepseek-v4-pro",
        },
      });
      return;
    }

    if ("apiKey" in (req.body ?? {}) && typeof req.body.apiKey === "string" && !req.body.apiKey.trim()) {
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: "apiKey must not be empty" },
      });
      return;
    }

    const name =
      "name" in (req.body ?? {}) && typeof req.body.name === "string"
        ? req.body.name
        : undefined;
    const apiKey =
      "apiKey" in (req.body ?? {}) && typeof req.body.apiKey === "string"
        ? req.body.apiKey
        : undefined;
    const contextWindowRaw =
      "contextWindow" in (req.body ?? {}) ? req.body.contextWindow : undefined;
    const contextWindow =
      contextWindowRaw === undefined ? undefined : normalizeContextWindow(contextWindowRaw);

    try {
      const saved = upsertVisitorAgentConfig({
        ownerVisitorId: req.visitor.visitor_id,
        visitorName: req.visitor.visitor_name,
        modelId,
        name,
        apiKey,
        contextWindow,
      });
      res.json({ data: toPublicAgentConfig(saved) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "api_key_required") {
        res.status(400).json({
          error: { code: "BAD_REQUEST", message: "apiKey is required on first save" },
        });
        return;
      }
      throw err;
    }
  });

  router.get("/session", async (req, res) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "login required" } });
      return;
    }

    const mode = parseAgentMode(req.query?.mode);
    const documentId =
      mode === "coding" ? parseDocumentId(req.query?.documentId) : undefined;
    const data = await getAgentSessionForApi(
      req.visitor.visitor_id,
      mode,
      documentId ?? null,
    );
    res.json({ data });
  });

  router.get("/context-usage", async (req, res) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "login required" } });
      return;
    }
    const data = await getAgentContextUsageForApi(req.visitor.visitor_id);
    res.json({ data });
  });

  router.get("/sessions", async (req, res) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "login required" } });
      return;
    }
    const mode = parseAgentMode(req.query?.mode);
    const documentId =
      mode === "coding" ? parseDocumentId(req.query?.documentId) : undefined;
    const data = await listAgentSessionsForApi(
      req.visitor.visitor_id,
      mode,
      documentId ?? null,
    );
    res.json({ data });
  });

  router.post("/sessions", async (req, res) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "login required" } });
      return;
    }
    const mode = parseAgentMode(req.body?.mode ?? req.query?.mode);
    const documentId =
      mode === "coding"
        ? parseDocumentId(req.body?.documentId ?? req.query?.documentId)
        : undefined;
    const data = await createAgentSessionForApi(
      req.visitor.visitor_id,
      mode,
      documentId ?? null,
    );
    res.json({ data });
  });

  router.post("/session/open", async (req, res) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "login required" } });
      return;
    }
    const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
    if (!sessionId) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "sessionId is required" } });
      return;
    }
    try {
      const mode = parseAgentMode(req.body?.mode ?? req.query?.mode);
      const documentId =
        mode === "coding"
          ? parseDocumentId(req.body?.documentId ?? req.query?.documentId)
          : undefined;
      const data = await openAgentSessionForApi(
        req.visitor.visitor_id,
        sessionId,
        mode,
        documentId ?? null,
      );
      res.json({ data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg === "invalid_session_id" ||
        msg === "session_not_found" ||
        msg === "session_document_mismatch"
      ) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: msg } });
        return;
      }
      throw err;
    }
  });

  router.post("/session/bind-document", async (req, res) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "login required" } });
      return;
    }
    const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
    const documentId =
      typeof req.body?.documentId === "string" ? req.body.documentId.trim() : "";
    if (!sessionId || !documentId) {
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: "sessionId and documentId are required" },
      });
      return;
    }
    try {
      const data = await bindCodingSessionDocumentForApi(
        req.visitor.visitor_id,
        sessionId,
        documentId,
      );
      res.json({ data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg === "invalid_session_id" ||
        msg === "session_not_found" ||
        msg === "document_id_required" ||
        msg === "bind_only_coding"
      ) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: msg } });
        return;
      }
      throw err;
    }
  });

  router.post("/choice", (req, res) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "login required" } });
      return;
    }
    const requestId =
      typeof req.body?.requestId === "string" ? req.body.requestId.trim() : "";
    if (!requestId) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "requestId is required" } });
      return;
    }

    // 前端倒计时结束：显式取消 pending（与服务端 timer 双保险）
    if (req.body?.expire === true || req.body?.cancel === true) {
      try {
        expireUserChoice(req.visitor.visitor_id, requestId);
        res.json({ data: { status: "timeout" } });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "choice_not_found") {
          // 可能后端 timer 已先解冻
          res.json({ data: { status: "timeout" } });
          return;
        }
        if (msg === "choice_forbidden") {
          res.status(403).json({ error: { code: "FORBIDDEN", message: msg } });
          return;
        }
        throw err;
      }
      return;
    }

    const choice = typeof req.body?.choice === "string" ? req.body.choice : "";
    try {
      const data = resolveUserChoice(req.visitor.visitor_id, requestId, choice);
      res.json({ data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "choice_not_found") {
        res.status(404).json({ error: { code: "NOT_FOUND", message: msg } });
        return;
      }
      if (msg === "choice_forbidden") {
        res.status(403).json({ error: { code: "FORBIDDEN", message: msg } });
        return;
      }
      if (msg === "choice_empty") {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: msg } });
        return;
      }
      throw err;
    }
  });

  router.post("/chat", async (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "login required" } });
      return;
    }

    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "message is required" } });
      return;
    }

    const status = getAgentStatus(req.visitor.visitor_id);
    if (!status.enabled || !status.skillsReady) {
      res.status(503).json({
        error: {
          code: "AGENT_UNAVAILABLE",
          message: status.reason ?? "unavailable",
        },
      });
      return;
    }

    const modeRaw = typeof req.body?.mode === "string" ? req.body.mode.trim() : "";
    const mode = modeRaw === "coding" ? "coding" : "normal";
    const workingMarkdown =
      mode === "coding" && typeof req.body?.workingMarkdown === "string"
        ? req.body.workingMarkdown
        : undefined;
    const baseMarkdown =
      mode === "coding" && typeof req.body?.baseMarkdown === "string"
        ? req.body.baseMarkdown
        : undefined;
    const documentId =
      mode === "coding" && typeof req.body?.documentId === "string"
        ? req.body.documentId.trim() || null
        : undefined;

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const ac = new AbortController();
    // 监听响应 close：客户端中途断开时 abort；正常 res.end() 后 writableEnded=true 不再 abort
    res.on("close", () => {
      if (!res.writableEnded) ac.abort();
    });

    try {
      await runOnboardingChat({
        visitorId: req.visitor.visitor_id,
        message,
        mode,
        documentId,
        workingMarkdown,
        baseMarkdown,
        signal: ac.signal,
        onEvent: (event) => writeSse(res, event),
      });
    } catch (err) {
      if (!ac.signal.aborted) {
        log.error("chat failed: %s", (err as Error).message);
      }
    } finally {
      if (!res.writableEnded) res.end();
    }
  });

  return router;
}
