import { Router, type Request, type Response } from "express";
import {
  getAgentStatus,
  getAgentContextUsageForApi,
  type AgentStreamEvent,
} from "../agent/Agent/run.js";
import {
  AgentRunActiveError,
  bootstrapAgentRuns,
  cancelAgentRun,
  getActiveRunForSession,
  getRunPublic,
  startAgentRun,
  subscribeAgentRun,
} from "../agent/Agent/run-manager.js";
import {
  getAgentSessionForApi,
  createAgentSessionForApi,
  listAgentSessionsForApi,
  openAgentSessionForApi,
  bindCodingSessionDocumentForApi,
  renameAgentSessionForApi,
  pinAgentSessionForApi,
} from "../agent/Agent/session-manager.js";
import { resolveUserChoice, expireUserChoice, cancelUserChoice } from "../agent/Agent/choice-pending.js";
import {
  resolveSkillForm,
  expireSkillForm,
  cancelSkillForm,
} from "../agent/Agent/skill-form-pending.js";
import {
  getVisitorAgentConfig,
  listVisitorAgentConfigs,
  toPublicAgentConfig,
  upsertVisitorAgentConfig,
  setVisitorDefaultAgentConfig,
  deleteVisitorAgentConfig,
} from "../agent/Config/config.js";
import {
  createUserSkill,
  listUserSkills,
  normalizeSkillRefs,
  removeUserSkill,
  updateUserSkill,
  USER_SKILL_BODY_MAX_CHARS,
} from "../agent/Agent/user-skills.js";
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

  router.get("/configs", (req, res) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "login required" } });
      return;
    }
    res.json({ data: listVisitorAgentConfigs(req.visitor.visitor_id) });
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
    const body = req.body ?? {};
    if (typeof body.apiKey === "string" && !body.apiKey.trim()) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "apiKey must not be empty" } });
      return;
    }
    try {
      const saved = upsertVisitorAgentConfig({
        ownerVisitorId: req.visitor.visitor_id,
        visitorName: req.visitor.visitor_name,
        id: typeof body.id === "string" ? body.id : undefined,
        isDefault: body.isDefault === true ? true : body.isDefault === false ? false : undefined,
        kind: body.kind,
        modelId: body.modelId,
        apiKey: body.apiKey,
        name: body.name,
        contextWindow: body.contextWindow,
        thinkingLevel: body.thinkingLevel,
        runTimeoutSeconds: body.runTimeoutSeconds,
        providerId: body.providerId,
        baseUrl: body.baseUrl,
        apiType: body.apiType,
      });
      res.json({ data: toPublicAgentConfig(saved) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.endsWith("_required") || msg.startsWith("invalid_") || msg === "config_not_found") {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: msg } });
        return;
      }
      throw err;
    }
  });

  router.post("/config/:id/default", (req, res) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "login required" } });
      return;
    }
    const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!id) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "id is required" } });
      return;
    }
    try {
      const data = setVisitorDefaultAgentConfig(req.visitor.visitor_id, id);
      res.json({ data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "config_not_found") {
        res.status(404).json({ error: { code: "NOT_FOUND", message: msg } });
        return;
      }
      throw err;
    }
  });

  router.delete("/config/:id", (req, res) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "login required" } });
      return;
    }
    const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!id) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "id is required" } });
      return;
    }
    try {
      deleteVisitorAgentConfig(req.visitor.visitor_id, id);
      res.json({ data: { ok: true } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "config_not_found") {
        res.status(404).json({ error: { code: "NOT_FOUND", message: msg } });
        return;
      }
      throw err;
    }
  });

  router.get("/skills", (req, res) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "login required" } });
      return;
    }
    res.json({ data: listUserSkills(req.visitor.visitor_id) });
  });

  router.post("/skills", (req, res) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "login required" } });
      return;
    }
    try {
      const data = createUserSkill({
        ownerVisitorId: req.visitor.visitor_id,
        name: typeof req.body?.name === "string" ? req.body.name : "",
        description: typeof req.body?.description === "string" ? req.body.description : undefined,
        body: typeof req.body?.body === "string" ? req.body.body : "",
      });
      res.status(201).json({ data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg === "skill_name_required" ||
        msg === "skill_name_invalid" ||
        msg === "skill_name_too_long" ||
        msg === "skill_description_too_long" ||
        msg === "skill_body_required" ||
        msg === "skill_body_too_long"
      ) {
        res.status(400).json({
          error: {
            code: "BAD_REQUEST",
            message:
              msg === "skill_body_too_long"
                ? `body must be <= ${USER_SKILL_BODY_MAX_CHARS} chars`
                : msg === "skill_name_invalid"
                  ? "name must be English letters, digits, and underscore only"
                  : msg,
          },
        });
        return;
      }
      if (msg === "skill_name_taken") {
        res.status(409).json({ error: { code: "CONFLICT", message: msg } });
        return;
      }
      throw err;
    }
  });

  router.patch("/skills/:id", (req, res) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "login required" } });
      return;
    }
    const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!id) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "id is required" } });
      return;
    }
    try {
      const data = updateUserSkill({
        ownerVisitorId: req.visitor.visitor_id,
        id,
        name: typeof req.body?.name === "string" ? req.body.name : "",
        description: typeof req.body?.description === "string" ? req.body.description : undefined,
        body: typeof req.body?.body === "string" ? req.body.body : "",
      });
      res.json({ data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "skill_not_found") {
        res.status(404).json({ error: { code: "NOT_FOUND", message: msg } });
        return;
      }
      if (
        msg === "skill_name_required" ||
        msg === "skill_name_invalid" ||
        msg === "skill_name_too_long" ||
        msg === "skill_description_too_long" ||
        msg === "skill_body_required" ||
        msg === "skill_body_too_long"
      ) {
        res.status(400).json({
          error: {
            code: "BAD_REQUEST",
            message:
              msg === "skill_name_invalid"
                ? "name must be English letters, digits, and underscore only"
                : msg,
          },
        });
        return;
      }
      if (msg === "skill_name_taken") {
        res.status(409).json({ error: { code: "CONFLICT", message: msg } });
        return;
      }
      throw err;
    }
  });

  router.delete("/skills/:id", (req, res) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "login required" } });
      return;
    }
    const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!id) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "id is required" } });
      return;
    }
    try {
      removeUserSkill(req.visitor.visitor_id, id);
      res.json({ data: { ok: true } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "skill_not_found") {
        res.status(404).json({ error: { code: "NOT_FOUND", message: msg } });
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
    const activeRun = getActiveRunForSession(req.visitor.visitor_id, data.sessionId);
    res.json({ data: { ...data, activeRun: activeRun ?? null } });
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
    const domainId =
      typeof req.body?.domainId === "string" && req.body.domainId.trim()
        ? req.body.domainId.trim()
        : null;
    const data = await createAgentSessionForApi(
      req.visitor.visitor_id,
      mode,
      documentId ?? null,
      domainId,
    );
    res.json({ data });
  });

  router.post("/session/rename", async (req, res) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "login required" } });
      return;
    }
    const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
    const title = typeof req.body?.title === "string" ? req.body.title : "";
    if (!sessionId) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "sessionId is required" } });
      return;
    }
    try {
      const mode = parseAgentMode(req.body?.mode ?? req.query?.mode);
      const data = await renameAgentSessionForApi(
        req.visitor.visitor_id,
        sessionId,
        title,
        mode,
      );
      res.json({ data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "invalid_session_id" || msg === "session_not_found") {
        res.status(404).json({ error: { code: "NOT_FOUND", message: msg } });
        return;
      }
      if (msg === "title_required" || msg === "title_too_long") {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: msg } });
        return;
      }
      throw err;
    }
  });

  router.post("/session/pin", async (req, res) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "login required" } });
      return;
    }
    const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
    if (!sessionId) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "sessionId is required" } });
      return;
    }
    if (typeof req.body?.pinned !== "boolean") {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "pinned boolean required" } });
      return;
    }
    try {
      const mode = parseAgentMode(req.body?.mode ?? req.query?.mode);
      const data = await pinAgentSessionForApi(
        req.visitor.visitor_id,
        sessionId,
        req.body.pinned,
        mode,
      );
      res.json({ data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "invalid_session_id" || msg === "session_not_found") {
        res.status(404).json({ error: { code: "NOT_FOUND", message: msg } });
        return;
      }
      throw err;
    }
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

    // 前端倒计时结束 / 用户取消：显式解冻 pending（与服务端 timer 双保险）
    if (req.body?.expire === true || req.body?.cancel === true) {
      try {
        if (req.body?.cancel === true) {
          cancelUserChoice(req.visitor.visitor_id, requestId);
          res.json({ data: { status: "cancelled" } });
        } else {
          expireUserChoice(req.visitor.visitor_id, requestId);
          res.json({ data: { status: "timeout" } });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "choice_not_found") {
          // 可能后端 timer 已先解冻
          res.json({
            data: { status: req.body?.cancel === true ? "cancelled" : "timeout" },
          });
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

  router.post("/skill-form", (req, res) => {
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

    if (req.body?.expire === true || req.body?.cancel === true) {
      try {
        if (req.body?.cancel === true) {
          cancelSkillForm(req.visitor.visitor_id, requestId);
          res.json({ data: { status: "cancelled" } });
        } else {
          expireSkillForm(req.visitor.visitor_id, requestId);
          res.json({ data: { status: "timeout" } });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "skill_form_not_found") {
          res.json({
            data: { status: req.body?.cancel === true ? "cancelled" : "timeout" },
          });
          return;
        }
        if (msg === "skill_form_forbidden") {
          res.status(403).json({ error: { code: "FORBIDDEN", message: msg } });
          return;
        }
        throw err;
      }
      return;
    }

    const name = typeof req.body?.name === "string" ? req.body.name : "";
    const description =
      typeof req.body?.description === "string" ? req.body.description : "";
    const body = typeof req.body?.body === "string" ? req.body.body : "";
    try {
      const data = resolveSkillForm(req.visitor.visitor_id, requestId, {
        name,
        description,
        body,
      });
      res.json({ data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "skill_form_not_found") {
        res.status(404).json({ error: { code: "NOT_FOUND", message: msg } });
        return;
      }
      if (msg === "skill_form_forbidden") {
        res.status(403).json({ error: { code: "FORBIDDEN", message: msg } });
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
    const skillNames = normalizeSkillRefs(
      req.body?.skillNames ?? req.body?.skillIds,
    );
    const ref = req.body?.references;
    const references =
      mode === "normal" && ref && typeof ref === "object"
        ? {
            domainId:
              typeof ref.domainId === "string" ? ref.domainId.trim() || undefined : undefined,
            documentId:
              typeof ref.documentId === "string"
                ? ref.documentId.trim() || undefined
                : undefined,
            graphFileId:
              typeof ref.graphFileId === "string"
                ? ref.graphFileId.trim() || undefined
                : undefined,
          }
        : undefined;

    let started;
    try {
      started = await startAgentRun({
        visitorId: req.visitor.visitor_id,
        message,
        mode,
        skillNames,
        documentId,
        workingMarkdown,
        baseMarkdown,
        references,
      });
    } catch (err) {
      if (err instanceof AgentRunActiveError) {
        res.status(409).json({
          error: {
            code: "RUN_ACTIVE",
            message: "当前会话已有进行中的对话，请等待结束或取消后再发",
            activeRun: err.activeRun,
          },
        });
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      log.error("chat start failed: %s", msg);
      res.status(400).json({ error: { code: "BAD_REQUEST", message: msg } });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Agent-Run-Id", started.run.runId);
    res.flushHeaders?.();

    // 断开仅取消订阅，不终止后台 run
    const sub = subscribeAgentRun({
      visitorId: req.visitor.visitor_id,
      runId: started.run.runId,
      afterSeq: 0,
      onEvent: (event) => writeSse(res, event),
      onClose: () => {
        if (!res.writableEnded) res.end();
      },
    });
    res.on("close", () => {
      sub?.unsubscribe();
      if (!res.writableEnded) res.end();
    });
  });

  router.get("/runs/:runId", (req, res) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "login required" } });
      return;
    }
    const runId = typeof req.params.runId === "string" ? req.params.runId : "";
    const run = getRunPublic(req.visitor.visitor_id, runId);
    if (!run) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "run_not_found" } });
      return;
    }
    res.json({ data: run });
  });

  router.get("/runs/:runId/stream", (req, res) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "login required" } });
      return;
    }
    const runId = typeof req.params.runId === "string" ? req.params.runId : "";
    const afterRaw = req.query?.afterSeq;
    const afterSeq =
      typeof afterRaw === "string" && /^\d+$/.test(afterRaw) ? Number(afterRaw) : 0;

    // 先确认存在并写好 SSE 头：subscribe 会同步回放事件 / 可能立刻 onClose
    if (!getRunPublic(req.visitor.visitor_id, runId)) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "run_not_found" } });
      return;
    }
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Agent-Run-Id", runId);
    res.flushHeaders?.();

    const sub = subscribeAgentRun({
      visitorId: req.visitor.visitor_id,
      runId,
      afterSeq,
      onEvent: (event) => {
        if (!res.writableEnded) writeSse(res, event);
      },
      onClose: () => {
        if (!res.writableEnded) res.end();
      },
    });
    if (!sub) {
      if (!res.writableEnded) res.end();
      return;
    }

    res.on("close", () => {
      sub.unsubscribe();
      if (!res.writableEnded) res.end();
    });
  });

  router.post("/runs/:runId/cancel", async (req, res) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "login required" } });
      return;
    }
    const runId = typeof req.params.runId === "string" ? req.params.runId : "";
    const run = await cancelAgentRun(req.visitor.visitor_id, runId);
    if (!run) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "run_not_found" } });
      return;
    }
    res.json({ data: run });
  });

  bootstrapAgentRuns();
  return router;
}
