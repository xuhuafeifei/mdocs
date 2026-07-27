import { Router, type Request, type Response } from "express";
import {
  getAgentStatus,
  runOnboardingChat,
  type AgentStreamEvent,
} from "../agent/Agent/run.js";
import {
  getVisitorAgentConfig,
  isAgentModelId,
  toPublicAgentConfig,
  upsertVisitorAgentConfig,
} from "../agent/Config/config.js";
import { useLogger } from "../logger/logger.js";

const log = useLogger("agent-route");

function writeSse(res: Response, event: AgentStreamEvent) {
  if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
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

    try {
      const saved = upsertVisitorAgentConfig({
        ownerVisitorId: req.visitor.visitor_id,
        visitorName: req.visitor.visitor_name,
        modelId,
        name,
        apiKey,
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
