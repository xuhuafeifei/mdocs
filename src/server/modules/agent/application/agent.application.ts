import {
  getAgentContextUsageForApi,
  getAgentStatus,
} from "../Agent/run.js";
import {
  AgentRunActiveError,
  cancelAgentRun,
  getActiveRunForSession,
  getRunPublic,
  startAgentRun,
  type AgentRunPublic,
} from "../Agent/run-manager.js";
import { buildContextInspector } from "../Agent/context-inspector.js";
import { SessionCompactingError } from "../Agent/context-compact-lock.js";
import { compactAgentSession } from "../Agent/context-compact.js";
import {
  bindCodingSessionDocumentForApi,
  createAgentSessionForApi,
  getAgentSessionForApi,
  listAgentSessionsForApi,
  openAgentSessionForApi,
  pinAgentSessionForApi,
  renameAgentSessionForApi,
} from "../Agent/session-manager.js";
import {
  allowedUploadAccept,
  getAttachmentStore,
} from "../attachments/index.js";
import {
  cancelUserChoice,
  expireUserChoice,
  resolveUserChoice,
} from "../Agent/choice-pending.js";
import { resolveEditorDraft } from "../Agent/editor-draft-wait.js";
import {
  cancelSkillForm,
  expireSkillForm,
  resolveSkillForm,
} from "../Agent/skill-form-pending.js";
import {
  deleteVisitorAgentConfig,
  getVisitorAgentConfig,
  listVisitorAgentConfigs,
  setVisitorDefaultAgentConfig,
  toPublicAgentConfig,
  upsertVisitorAgentConfig,
} from "../Config/config.js";
import {
  createUserSkill,
  listUserSkills,
  normalizeSkillRefs,
  removeUserSkill,
  updateUserSkill,
  USER_SKILL_BODY_MAX_CHARS,
} from "../Agent/user-skills.js";
import { useLogger } from "../../../infra/logger/logger.js";
import {
  AgentError,
  agentBadRequest,
  agentConflict,
  agentForbidden,
  agentNotFound,
} from "../agent-error.js";
import { parseAgentMode, parseDocumentId, type AgentModeParam } from "../agent-mode.js";

const log = useLogger("agent");

export function getAttachmentAccept() {
  return { accept: allowedUploadAccept() };
}

export async function saveAgentAttachment(params: {
  visitorId: string;
  sessionId: string;
  file: Express.Multer.File | undefined;
}) {
  const sessionId = params.sessionId.trim();
  if (!sessionId) agentBadRequest("sessionId is required");
  const file = params.file;
  if (!file?.buffer?.length) agentBadRequest("file is required");
  try {
    const meta = await getAttachmentStore().saveStaging({
      visitorId: params.visitorId,
      sessionId,
      name: file.originalname || "file",
      mime: file.mimetype,
      data: new Uint8Array(file.buffer),
    });
    return {
      id: meta.id,
      name: meta.name,
      mime: meta.mime,
      bytes: meta.bytes,
      status: meta.status,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "unsupported_type" || msg === "file_too_large") {
      agentBadRequest(msg);
    }
    throw err;
  }
}

export async function readAgentAttachment(visitorId: string, idRaw: string) {
  const id = idRaw.trim();
  if (!id) agentBadRequest("id is required");
  try {
    return await getAttachmentStore().read({ visitorId, id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "attachment_not_found") agentNotFound(msg);
    throw err;
  }
}

export function agentStatus(visitorId: string) {
  return getAgentStatus(visitorId);
}

export function listConfigs(visitorId: string) {
  return listVisitorAgentConfigs(visitorId);
}

export function getDefaultConfig(visitorId: string) {
  const cfg = getVisitorAgentConfig(visitorId);
  return cfg ? toPublicAgentConfig(cfg) : null;
}

export function upsertConfig(
  visitorId: string,
  visitorName: string,
  body: Record<string, unknown>,
) {
  if (typeof body.apiKey === "string" && !body.apiKey.trim()) {
    agentBadRequest("apiKey must not be empty");
  }
  try {
    const saved = upsertVisitorAgentConfig({
      ownerVisitorId: visitorId,
      visitorName,
      id: typeof body.id === "string" ? body.id : undefined,
      isDefault:
        body.isDefault === true ? true : body.isDefault === false ? false : undefined,
      kind: body.kind as never,
      modelId: body.modelId as never,
      apiKey: body.apiKey as never,
      name: body.name as never,
      contextWindow: body.contextWindow as never,
      maxOutputTokens: body.maxOutputTokens as never,
      thinkingLevel: body.thinkingLevel as never,
      runTimeoutSeconds: body.runTimeoutSeconds as never,
      providerId: body.providerId as never,
      baseUrl: body.baseUrl as never,
      apiType: body.apiType as never,
    });
    return toPublicAgentConfig(saved);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.endsWith("_required") || msg.startsWith("invalid_") || msg === "config_not_found") {
      agentBadRequest(msg);
    }
    throw err;
  }
}

export function setDefaultConfig(visitorId: string, idRaw: string) {
  const id = idRaw.trim();
  if (!id) agentBadRequest("id is required");
  try {
    return setVisitorDefaultAgentConfig(visitorId, id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "config_not_found") agentNotFound(msg);
    throw err;
  }
}

export function removeConfig(visitorId: string, idRaw: string) {
  const id = idRaw.trim();
  if (!id) agentBadRequest("id is required");
  try {
    deleteVisitorAgentConfig(visitorId, id);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "config_not_found") agentNotFound(msg);
    throw err;
  }
}

function mapSkillWriteError(msg: string): never {
  if (
    msg === "skill_name_required" ||
    msg === "skill_name_invalid" ||
    msg === "skill_name_too_long" ||
    msg === "skill_description_too_long" ||
    msg === "skill_body_required" ||
    msg === "skill_body_too_long"
  ) {
    agentBadRequest(
      msg === "skill_body_too_long"
        ? `body must be <= ${USER_SKILL_BODY_MAX_CHARS} chars`
        : msg === "skill_name_invalid"
          ? "name must be English letters, digits, underscore, or hyphen"
          : msg,
    );
  }
  if (msg === "skill_name_taken") {
    throw new AgentError("CONFLICT", msg, 409);
  }
  if (msg === "skill_not_found") agentNotFound(msg);
  throw new Error(msg);
}

export function skillsList(visitorId: string) {
  return listUserSkills(visitorId);
}

export function skillsCreate(
  visitorId: string,
  body: { name?: unknown; description?: unknown; body?: unknown },
) {
  try {
    return createUserSkill({
      ownerVisitorId: visitorId,
      name: typeof body.name === "string" ? body.name : "",
      description: typeof body.description === "string" ? body.description : undefined,
      body: typeof body.body === "string" ? body.body : "",
    });
  } catch (err) {
    mapSkillWriteError(err instanceof Error ? err.message : String(err));
  }
}

export function skillsUpdate(
  visitorId: string,
  idRaw: string,
  body: { name?: unknown; description?: unknown; body?: unknown },
) {
  const id = idRaw.trim();
  if (!id) agentBadRequest("id is required");
  try {
    return updateUserSkill({
      ownerVisitorId: visitorId,
      id,
      name: typeof body.name === "string" ? body.name : "",
      description: typeof body.description === "string" ? body.description : undefined,
      body: typeof body.body === "string" ? body.body : "",
    });
  } catch (err) {
    mapSkillWriteError(err instanceof Error ? err.message : String(err));
  }
}

export function skillsRemove(visitorId: string, idRaw: string) {
  const id = idRaw.trim();
  if (!id) agentBadRequest("id is required");
  try {
    removeUserSkill(visitorId, id);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "skill_not_found") agentNotFound(msg);
    throw err;
  }
}

export async function sessionGet(
  visitorId: string,
  modeRaw: unknown,
  documentIdRaw: unknown,
) {
  const mode = parseAgentMode(modeRaw);
  const documentId = mode === "coding" ? parseDocumentId(documentIdRaw) : undefined;
  const data = await getAgentSessionForApi(visitorId, mode, documentId ?? null);
  const activeRun = getActiveRunForSession(visitorId, data.sessionId);
  return { ...data, activeRun: activeRun ?? null };
}

export async function contextUsage(visitorId: string) {
  return getAgentContextUsageForApi(visitorId);
}

export async function systemPromptInspector(
  visitorId: string,
  query: {
    mode?: unknown;
    domainId?: unknown;
    documentId?: unknown;
    sessionId?: unknown;
  },
) {
  const mode = parseAgentMode(query.mode) === "coding" ? "coding" : "normal";
  return buildContextInspector({
    visitorId,
    mode,
    sessionId: typeof query.sessionId === "string" ? query.sessionId : undefined,
    domainId: typeof query.domainId === "string" ? query.domainId : undefined,
    documentId: typeof query.documentId === "string" ? query.documentId : undefined,
  });
}

export async function sessionsList(
  visitorId: string,
  modeRaw: unknown,
  documentIdRaw: unknown,
) {
  const mode = parseAgentMode(modeRaw);
  const documentId = mode === "coding" ? parseDocumentId(documentIdRaw) : undefined;
  return listAgentSessionsForApi(visitorId, mode, documentId ?? null);
}

export async function sessionsCreate(
  visitorId: string,
  body: { mode?: unknown; documentId?: unknown; domainId?: unknown },
) {
  const mode = parseAgentMode(body.mode);
  const documentId = mode === "coding" ? parseDocumentId(body.documentId) : undefined;
  const domainId =
    typeof body.domainId === "string" && body.domainId.trim()
      ? body.domainId.trim()
      : null;
  return createAgentSessionForApi(visitorId, mode, documentId ?? null, domainId);
}

export async function sessionCompact(
  visitorId: string,
  body: { mode?: unknown; documentId?: unknown; sessionId?: unknown },
) {
  const mode = parseAgentMode(body.mode);
  const documentId = mode === "coding" ? parseDocumentId(body.documentId) : undefined;
  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.trim()
      ? body.sessionId.trim()
      : undefined;
  try {
    const result = await compactAgentSession({
      visitorId,
      kind: mode,
      documentId: documentId ?? null,
      sessionId,
      force: true,
    });
    return {
      compacted: result.compacted,
      reason: result.reason,
      percent: result.usage.percent,
      used: result.usage.used,
      limit: result.usage.limit,
      sessionId: result.sessionId,
    };
  } catch (err) {
    if (err instanceof SessionCompactingError) {
      agentConflict("SESSION_COMPACTING", "正在压缩上下文，请稍后再试");
    }
    const msg = err instanceof Error ? err.message : String(err);
    log.error("session compact failed: %s", msg);
    agentBadRequest(msg);
  }
}

export async function sessionRename(
  visitorId: string,
  body: { sessionId?: unknown; title?: unknown; mode?: unknown },
) {
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const title = typeof body.title === "string" ? body.title : "";
  if (!sessionId) agentBadRequest("sessionId is required");
  try {
    return await renameAgentSessionForApi(
      visitorId,
      sessionId,
      title,
      parseAgentMode(body.mode),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "invalid_session_id" || msg === "session_not_found") agentNotFound(msg);
    if (msg === "title_required" || msg === "title_too_long") agentBadRequest(msg);
    throw err;
  }
}

export async function sessionPin(
  visitorId: string,
  body: { sessionId?: unknown; pinned?: unknown; mode?: unknown },
) {
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId) agentBadRequest("sessionId is required");
  if (typeof body.pinned !== "boolean") agentBadRequest("pinned boolean required");
  try {
    return await pinAgentSessionForApi(
      visitorId,
      sessionId,
      body.pinned,
      parseAgentMode(body.mode),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "invalid_session_id" || msg === "session_not_found") agentNotFound(msg);
    throw err;
  }
}

export async function sessionOpen(
  visitorId: string,
  body: { sessionId?: unknown; mode?: unknown; documentId?: unknown },
) {
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId) agentBadRequest("sessionId is required");
  try {
    const mode = parseAgentMode(body.mode);
    const documentId = mode === "coding" ? parseDocumentId(body.documentId) : undefined;
    return await openAgentSessionForApi(visitorId, sessionId, mode, documentId ?? null);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg === "invalid_session_id" ||
      msg === "session_not_found" ||
      msg === "session_document_mismatch"
    ) {
      agentNotFound(msg);
    }
    throw err;
  }
}

export async function sessionBindDocument(
  visitorId: string,
  body: { sessionId?: unknown; documentId?: unknown },
) {
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const documentId =
    typeof body.documentId === "string" ? body.documentId.trim() : "";
  if (!sessionId || !documentId) {
    agentBadRequest("sessionId and documentId are required");
  }
  try {
    return await bindCodingSessionDocumentForApi(visitorId, sessionId, documentId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg === "invalid_session_id" ||
      msg === "session_not_found" ||
      msg === "document_id_required" ||
      msg === "bind_only_coding"
    ) {
      agentBadRequest(msg);
    }
    throw err;
  }
}

export function resolveChoice(
  visitorId: string,
  body: {
    requestId?: unknown;
    expire?: unknown;
    cancel?: unknown;
    choice?: unknown;
  },
) {
  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  if (!requestId) agentBadRequest("requestId is required");

  if (body.expire === true || body.cancel === true) {
    try {
      if (body.cancel === true) {
        cancelUserChoice(visitorId, requestId);
        return { status: "cancelled" as const };
      }
      expireUserChoice(visitorId, requestId);
      return { status: "timeout" as const };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "choice_not_found") {
        return { status: body.cancel === true ? ("cancelled" as const) : ("timeout" as const) };
      }
      if (msg === "choice_forbidden") agentForbidden(msg);
      throw err;
    }
  }

  const choice = typeof body.choice === "string" ? body.choice : "";
  try {
    return resolveUserChoice(visitorId, requestId, choice);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "choice_not_found") agentNotFound(msg);
    if (msg === "choice_forbidden") agentForbidden(msg);
    if (msg === "choice_empty") agentBadRequest(msg);
    throw err;
  }
}

export function resolveDraft(
  visitorId: string,
  body: Record<string, unknown>,
) {
  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  if (!requestId) agentBadRequest("requestId is required");
  const status = body.status;
  try {
    if (status === "unavailable") {
      const reason =
        typeof body.reason === "string" && body.reason.trim()
          ? body.reason.trim()
          : "unavailable";
      return resolveEditorDraft(visitorId, requestId, {
        status: "unavailable",
        reason,
      });
    }
    if (status !== "ok") {
      agentBadRequest("status must be ok or unavailable");
    }
    const documentId =
      typeof body.documentId === "string" ? body.documentId.trim() : "";
    const content = typeof body.content === "string" ? body.content : null;
    const contentFormat =
      body.contentFormat === "html" || body.contentFormat === "plain"
        ? body.contentFormat
        : "markdown";
    const source = body.source === "indexeddb" ? "indexeddb" : "editor";
    if (!documentId || content == null) {
      agentBadRequest("documentId and content are required when status=ok");
    }
    return resolveEditorDraft(visitorId, requestId, {
      status: "ok",
      documentId,
      content,
      contentFormat,
      source,
      localBaseCommitId:
        typeof body.localBaseCommitId === "string"
          ? body.localBaseCommitId
          : body.localBaseCommitId === null
            ? null
            : undefined,
      displayName:
        typeof body.displayName === "string" ? body.displayName : undefined,
    });
  } catch (err) {
    if (err instanceof AgentError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "editor_draft_not_found") agentNotFound(msg);
    if (msg === "editor_draft_forbidden" || msg === "editor_draft_document_mismatch") {
      agentForbidden(msg);
    }
    if (msg === "editor_draft_empty") agentBadRequest(msg);
    throw err;
  }
}

export function resolveSkillFormBody(
  visitorId: string,
  body: Record<string, unknown>,
) {
  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  if (!requestId) agentBadRequest("requestId is required");

  if (body.expire === true || body.cancel === true) {
    try {
      if (body.cancel === true) {
        cancelSkillForm(visitorId, requestId);
        return { status: "cancelled" as const };
      }
      expireSkillForm(visitorId, requestId);
      return { status: "timeout" as const };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "skill_form_not_found") {
        return {
          status: body.cancel === true ? ("cancelled" as const) : ("timeout" as const),
        };
      }
      if (msg === "skill_form_forbidden") agentForbidden(msg);
      throw err;
    }
  }

  try {
    return resolveSkillForm(visitorId, requestId, {
      name: typeof body.name === "string" ? body.name : "",
      description: typeof body.description === "string" ? body.description : "",
      body: typeof body.body === "string" ? body.body : "",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "skill_form_not_found") agentNotFound(msg);
    if (msg === "skill_form_forbidden") agentForbidden(msg);
    throw err;
  }
}

export type StartedAgentChat = {
  run: AgentRunPublic;
};

export async function startChat(
  visitorId: string,
  body: Record<string, unknown>,
): Promise<StartedAgentChat> {
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const assetIds = Array.isArray(body.assetIds)
    ? (body.assetIds as unknown[])
        .filter((id): id is string => typeof id === "string" && !!id.trim())
        .map((id) => id.trim())
    : [];
  if (!message && assetIds.length === 0) {
    agentBadRequest("message or assetIds is required");
  }

  const mode = parseAgentMode(body.mode);
  const status = getAgentStatus(visitorId);
  const available =
    mode === "plugin-pipeline"
      ? status.reason !== "missing_api_key"
      : status.enabled && status.skillsReady;
  if (!available) {
    throw new AgentError("AGENT_UNAVAILABLE", status.reason ?? "unavailable", 503);
  }

  const workingMarkdown =
    mode === "coding" && typeof body.workingMarkdown === "string"
      ? body.workingMarkdown
      : undefined;
  const baseMarkdown =
    mode === "coding" && typeof body.baseMarkdown === "string"
      ? body.baseMarkdown
      : undefined;
  const documentId =
    mode === "coding" && typeof body.documentId === "string"
      ? body.documentId.trim() || null
      : undefined;
  const pipelineCurrentYaml =
    mode === "plugin-pipeline" && typeof body.pipelineCurrentYaml === "string"
      ? body.pipelineCurrentYaml
      : undefined;
  const skillNames =
    mode === "plugin-pipeline"
      ? []
      : normalizeSkillRefs(body.skillNames ?? body.skillIds);
  const chatAssetIds = mode === "plugin-pipeline" ? [] : assetIds;
  const ref = body.references;
  const references =
    mode === "normal" && ref && typeof ref === "object"
      ? {
          domainId:
            typeof (ref as { domainId?: unknown }).domainId === "string"
              ? ((ref as { domainId: string }).domainId.trim() || undefined)
              : undefined,
          documentId:
            typeof (ref as { documentId?: unknown }).documentId === "string"
              ? ((ref as { documentId: string }).documentId.trim() || undefined)
              : undefined,
          graphFileId:
            typeof (ref as { graphFileId?: unknown }).graphFileId === "string"
              ? ((ref as { graphFileId: string }).graphFileId.trim() || undefined)
              : undefined,
        }
      : undefined;

  try {
    return await startAgentRun({
      visitorId,
      message,
      mode,
      skillNames,
      assetIds: chatAssetIds,
      documentId,
      workingMarkdown,
      baseMarkdown,
      references,
      pipelineCurrentYaml,
    });
  } catch (err) {
    if (err instanceof SessionCompactingError) {
      agentConflict("SESSION_COMPACTING", "正在压缩上下文，请稍后再试");
    }
    if (err instanceof AgentRunActiveError) {
      throw new AgentError(
        "RUN_ACTIVE",
        "当前会话已有进行中的对话，请等待结束或取消后再发",
        409,
        { activeRun: err.activeRun },
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    log.error("chat start failed: %s", msg);
    agentBadRequest(msg);
  }
}

export function runGet(visitorId: string, runId: string): AgentRunPublic {
  const run = getRunPublic(visitorId, runId);
  if (!run) agentNotFound("run_not_found");
  return run;
}

export async function runCancel(visitorId: string, runId: string) {
  const run = await cancelAgentRun(visitorId, runId);
  if (!run) agentNotFound("run_not_found");
  return run;
}

export type { AgentModeParam };
