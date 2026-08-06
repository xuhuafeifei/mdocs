import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getConfig } from "../../config/index.js";

export type AgentSessionRole = "user" | "assistant";

export interface AgentSessionMessage {
  role: AgentSessionRole;
  content: string;
  /** user 轮引用的私人 skill 名称（唯一键）；assistant 无此字段 */
  skillNames?: string[];
  /** @deprecated 旧 jsonl；读取时并入 skillNames */
  skillIds?: string[];
}

export interface AgentSessionSummary {
  id: string;
  title: string;
  updatedAt: string;
  documentId?: string | null;
}

type SessionMetaEntry = {
  id: string;
  title?: string;
  updatedAt?: string;
  /** coding：所属文档；缺省/null 视为空白帮写桶 */
  documentId?: string | null;
};

type SessionMeta = {
  lastOpenedSessionId: string;
  /** coding：按文档维度的 lastOpened；key 见 docScopeKey */
  lastOpenedByDocument?: Record<string, string>;
  sessions: SessionMetaEntry[];
};

const SESSION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 空白帮写（无 documentId）的 lastOpened 键 */
export const CODING_BLANK_DOC_KEY = "__blank__";

function safeString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function isSessionId(id: string): boolean {
  return SESSION_ID_RE.test(id);
}

function titleFromUserContent(content: string): string {
  const oneLine = content.replace(/\s+/g, " ").trim();
  if (!oneLine) return "新会话";
  return oneLine.length > 36 ? `${oneLine.slice(0, 36)}…` : oneLine;
}

function parseSkillRefsField(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** 新字段 skillNames；兼容旧 skillIds */
export function skillRefsOfMessage(m: {
  skillNames?: string[];
  skillIds?: string[];
}): string[] {
  if (m.skillNames && m.skillNames.length > 0) return m.skillNames;
  return m.skillIds ?? [];
}

/** null/空 → 空白桶；有 id → 该文档 */
export function docScopeKey(documentId: string | null | undefined): string {
  const id = typeof documentId === "string" ? documentId.trim() : "";
  return id || CODING_BLANK_DOC_KEY;
}

function entryDocKey(entry: SessionMetaEntry): string {
  return docScopeKey(entry.documentId);
}

export class AgentSessionManager {
  private readonly sessionDir: string;
  private readonly metaPath: string;
  private readonly kind: "normal" | "coding";

  private cachedSessionId: string | null = null;

  constructor(
    private readonly visitorId: string,
    opts?: { kind?: "normal" | "coding" },
  ) {
    const { dataDir } = getConfig();
    this.kind = opts?.kind === "coding" ? "coding" : "normal";
    const kindDir = this.kind === "coding" ? "coding-session" : "session";
    this.sessionDir = path.join(dataDir, "tenant", visitorId, "agent", kindDir);
    this.metaPath = path.join(this.sessionDir, "session.json");
  }

  private jsonlPath(sessionId: string): string {
    return path.join(this.sessionDir, `${sessionId}.jsonl`);
  }

  private async ensureSessionDir(): Promise<void> {
    await fs.promises.mkdir(this.sessionDir, { recursive: true });
  }

  private async readMeta(): Promise<SessionMeta | null> {
    try {
      const txt = await fs.promises.readFile(this.metaPath, "utf8");
      const parsed = JSON.parse(txt) as Partial<SessionMeta> | null;
      const lastOpenedSessionId = safeString(parsed?.lastOpenedSessionId);
      if (!lastOpenedSessionId || !isSessionId(lastOpenedSessionId)) return null;
      const sessions = Array.isArray(parsed?.sessions)
        ? parsed!.sessions.filter((s) => s && isSessionId(String(s.id ?? "")))
        : [];
      const lastOpenedByDocument =
        parsed?.lastOpenedByDocument && typeof parsed.lastOpenedByDocument === "object"
          ? Object.fromEntries(
              Object.entries(parsed.lastOpenedByDocument).filter(
                ([, id]) => typeof id === "string" && isSessionId(id),
              ),
            )
          : undefined;
      return { lastOpenedSessionId, sessions, lastOpenedByDocument };
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "ENOENT") {
        return null;
      }
      return null;
    }
  }

  private async writeMeta(meta: SessionMeta): Promise<void> {
    await fs.promises.writeFile(this.metaPath, JSON.stringify(meta, null, 2), "utf8");
  }

  private ensureSessionEntry(
    meta: SessionMeta,
    sessionId: string,
    patch?: {
      title?: string;
      touchUpdatedAt?: boolean;
      documentId?: string | null;
    },
  ): void {
    const idx = meta.sessions.findIndex((s) => s.id === sessionId);
    const now = nowIso();
    if (idx < 0) {
      meta.sessions.push({
        id: sessionId,
        title: patch?.title,
        updatedAt: now,
        documentId: patch?.documentId !== undefined ? patch.documentId : undefined,
      });
      return;
    }
    const cur = meta.sessions[idx]!;
    meta.sessions[idx] = {
      ...cur,
      title: patch?.title !== undefined ? patch.title : cur.title,
      updatedAt: patch?.touchUpdatedAt === false ? cur.updatedAt ?? now : now,
      documentId:
        patch?.documentId !== undefined ? patch.documentId : cur.documentId,
    };
  }

  private setLastOpenedForDoc(
    meta: SessionMeta,
    documentId: string | null | undefined,
    sessionId: string,
  ): void {
    if (this.kind !== "coding") return;
    const key = docScopeKey(documentId);
    meta.lastOpenedByDocument = {
      ...(meta.lastOpenedByDocument ?? {}),
      [key]: sessionId,
    };
  }

  private sortSummaries(sessions: SessionMetaEntry[]): AgentSessionSummary[] {
    return sessions
      .map((s) => ({
        id: s.id,
        title: s.title?.trim() || "新会话",
        updatedAt: s.updatedAt ?? nowIso(),
        documentId: s.documentId ?? null,
      }))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  }

  private filterByDocument(
    sessions: SessionMetaEntry[],
    documentId: string | null | undefined,
  ): SessionMetaEntry[] {
    if (this.kind !== "coding") return sessions;
    const key = docScopeKey(documentId);
    return sessions.filter((s) => entryDocKey(s) === key);
  }

  private async loadTranscript(sessionId: string): Promise<AgentSessionMessage[]> {
    try {
      const txt = await fs.promises.readFile(this.jsonlPath(sessionId), "utf8");
      const lines = txt.split("\n").map((l) => l.trim()).filter(Boolean);
      const messages: AgentSessionMessage[] = [];
      for (const line of lines) {
        try {
          const row = JSON.parse(line) as {
            role?: unknown;
            content?: unknown;
            skillNames?: unknown;
            skillIds?: unknown;
          };
          const role = row.role === "user" ? "user" : row.role === "assistant" ? "assistant" : null;
          const content = typeof row.content === "string" ? row.content : null;
          if (!role || content === null) continue;
          const fromNames = parseSkillRefsField(row.skillNames);
          const fromIds = parseSkillRefsField(row.skillIds);
          const skillNames =
            fromNames.length > 0 ? fromNames : fromIds.length > 0 ? fromIds : [];
          messages.push(
            role === "user" && skillNames.length > 0
              ? { role, content, skillNames }
              : { role, content },
          );
        } catch {
          /* ignore invalid line */
        }
      }
      return messages;
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "ENOENT") {
        return [];
      }
      return [];
    }
  }

  /**
   * 确保有可用 lastOpened。
   * coding + documentId：按文档维度；normal：全局 lastOpened。
   */
  async ensureLastOpened(documentId?: string | null): Promise<string> {
    await this.ensureSessionDir();

    if (this.kind !== "coding") {
      if (this.cachedSessionId) return this.cachedSessionId;
      const meta = await this.readMeta();
      if (!meta) {
        const sessionId = randomUUID();
        await this.writeMeta({
          lastOpenedSessionId: sessionId,
          sessions: [{ id: sessionId, updatedAt: nowIso() }],
        });
        this.cachedSessionId = sessionId;
        return sessionId;
      }
      this.ensureSessionEntry(meta, meta.lastOpenedSessionId, { touchUpdatedAt: false });
      await this.writeMeta(meta);
      this.cachedSessionId = meta.lastOpenedSessionId;
      return meta.lastOpenedSessionId;
    }

    const key = docScopeKey(documentId);
    const meta = (await this.readMeta()) ?? {
      lastOpenedSessionId: "",
      sessions: [],
      lastOpenedByDocument: {},
    };
    const scoped = this.filterByDocument(meta.sessions, documentId);
    const mapped = meta.lastOpenedByDocument?.[key];
    const mappedOk =
      mapped &&
      isSessionId(mapped) &&
      scoped.some((s) => s.id === mapped);

    if (mappedOk) {
      meta.lastOpenedSessionId = mapped!;
      this.ensureSessionEntry(meta, mapped!, { touchUpdatedAt: false });
      await this.writeMeta(meta);
      this.cachedSessionId = mapped!;
      return mapped!;
    }

    if (scoped[0]) {
      const sessionId = scoped[0].id;
      meta.lastOpenedSessionId = sessionId;
      this.setLastOpenedForDoc(meta, documentId, sessionId);
      await this.writeMeta(meta);
      this.cachedSessionId = sessionId;
      return sessionId;
    }

    const sessionId = randomUUID();
    meta.lastOpenedSessionId = sessionId;
    this.ensureSessionEntry(meta, sessionId, {
      touchUpdatedAt: true,
      documentId: documentId?.trim() ? documentId.trim() : null,
    });
    this.setLastOpenedForDoc(meta, documentId, sessionId);
    await this.writeMeta(meta);
    this.cachedSessionId = sessionId;
    return sessionId;
  }

  async listSessions(documentId?: string | null): Promise<{
    lastOpenedSessionId: string;
    sessions: AgentSessionSummary[];
  }> {
    const lastOpenedSessionId = await this.ensureLastOpened(documentId);
    const meta = (await this.readMeta())!;
    const scoped = this.filterByDocument(meta.sessions, documentId);
    return {
      lastOpenedSessionId,
      sessions: this.sortSummaries(scoped),
    };
  }

  async loadLastOpenedMessages(documentId?: string | null): Promise<{
    sessionId: string;
    messages: AgentSessionMessage[];
  }> {
    const sessionId = await this.ensureLastOpened(documentId);
    return { sessionId, messages: await this.loadTranscript(sessionId) };
  }

  /** 新建空会话并设为该文档（或空白桶）的 lastOpened */
  async createSession(documentId?: string | null): Promise<{
    sessionId: string;
    messages: AgentSessionMessage[];
  }> {
    await this.ensureSessionDir();
    const sessionId = randomUUID();
    const meta = (await this.readMeta()) ?? {
      lastOpenedSessionId: sessionId,
      sessions: [],
      lastOpenedByDocument: {},
    };
    meta.lastOpenedSessionId = sessionId;
    const doc =
      this.kind === "coding"
        ? documentId?.trim()
          ? documentId.trim()
          : null
        : undefined;
    this.ensureSessionEntry(meta, sessionId, {
      title: "新会话",
      touchUpdatedAt: true,
      documentId: doc,
    });
    if (this.kind === "coding") {
      this.setLastOpenedForDoc(meta, documentId, sessionId);
    }
    await this.writeMeta(meta);
    this.cachedSessionId = sessionId;
    return { sessionId, messages: [] };
  }

  /** 切换 lastOpened；coding 时可校验属于同一 documentId */
  async openSession(
    sessionId: string,
    documentId?: string | null,
  ): Promise<{
    sessionId: string;
    messages: AgentSessionMessage[];
  }> {
    if (!isSessionId(sessionId)) throw new Error("invalid_session_id");
    await this.ensureSessionDir();
    const meta = await this.readMeta();
    const inMeta = Boolean(meta?.sessions.some((s) => s.id === sessionId));
    const hasFile = fs.existsSync(this.jsonlPath(sessionId));
    if (!inMeta && !hasFile) throw new Error("session_not_found");

    const next = meta ?? { lastOpenedSessionId: sessionId, sessions: [], lastOpenedByDocument: {} };
    const entry = next.sessions.find((s) => s.id === sessionId);

    if (this.kind === "coding" && documentId !== undefined) {
      const want = docScopeKey(documentId);
      const have = entry ? entryDocKey(entry) : CODING_BLANK_DOC_KEY;
      if (want !== have) throw new Error("session_document_mismatch");
    }

    next.lastOpenedSessionId = sessionId;
    this.ensureSessionEntry(next, sessionId, { touchUpdatedAt: true });
    if (this.kind === "coding") {
      const bindDoc = entry?.documentId ?? (documentId !== undefined ? documentId : null);
      this.setLastOpenedForDoc(next, bindDoc, sessionId);
    }
    await this.writeMeta(next);
    this.cachedSessionId = sessionId;
    return { sessionId, messages: await this.loadTranscript(sessionId) };
  }

  /**
   * 空白帮写写回成文后：把 session 绑到新 documentId，并设为该文 lastOpened。
   */
  async bindSessionDocument(
    sessionId: string,
    documentId: string,
  ): Promise<{ sessionId: string; documentId: string }> {
    if (this.kind !== "coding") throw new Error("bind_only_coding");
    if (!isSessionId(sessionId)) throw new Error("invalid_session_id");
    const doc = documentId.trim();
    if (!doc) throw new Error("document_id_required");

    await this.ensureSessionDir();
    const meta = (await this.readMeta()) ?? {
      lastOpenedSessionId: sessionId,
      sessions: [],
      lastOpenedByDocument: {},
    };
    const inMeta = meta.sessions.some((s) => s.id === sessionId);
    const hasFile = fs.existsSync(this.jsonlPath(sessionId));
    if (!inMeta && !hasFile) throw new Error("session_not_found");

    this.ensureSessionEntry(meta, sessionId, {
      documentId: doc,
      touchUpdatedAt: true,
    });
    meta.lastOpenedSessionId = sessionId;
    this.setLastOpenedForDoc(meta, doc, sessionId);
    // 从空白桶 lastOpened 清掉自己（若仍指向本 session）
    if (meta.lastOpenedByDocument?.[CODING_BLANK_DOC_KEY] === sessionId) {
      delete meta.lastOpenedByDocument[CODING_BLANK_DOC_KEY];
    }
    await this.writeMeta(meta);
    this.cachedSessionId = sessionId;
    return { sessionId, documentId: doc };
  }

  private async touchLastOpened(
    sessionId: string,
    patch?: { titleIfEmpty?: string },
  ): Promise<void> {
    const meta = (await this.readMeta()) ?? {
      lastOpenedSessionId: sessionId,
      sessions: [],
      lastOpenedByDocument: {},
    };
    meta.lastOpenedSessionId = sessionId;
    const existing = meta.sessions.find((s) => s.id === sessionId);
    const needTitle =
      patch?.titleIfEmpty &&
      !(existing?.title && existing.title.trim() && existing.title !== "新会话");
    this.ensureSessionEntry(meta, sessionId, {
      title: needTitle ? patch!.titleIfEmpty : undefined,
      touchUpdatedAt: true,
    });
    if (this.kind === "coding") {
      this.setLastOpenedForDoc(meta, existing?.documentId ?? null, sessionId);
    }
    await this.writeMeta(meta);
    this.cachedSessionId = sessionId;
  }

  async appendUser(
    sessionId: string,
    content: string,
    skillNames?: string[],
  ): Promise<void> {
    if (!isSessionId(sessionId)) throw new Error("invalid_session_id");
    const names = Array.isArray(skillNames)
      ? skillNames
          .filter((n) => typeof n === "string" && n.trim())
          .map((n) => n.trim())
      : [];
    const row: Record<string, unknown> = { role: "user", content, ts: nowIso() };
    if (names.length > 0) row.skillNames = names;
    await fs.promises.appendFile(
      this.jsonlPath(sessionId),
      JSON.stringify(row) + "\n",
      "utf8",
    );
    await this.touchLastOpened(sessionId, { titleIfEmpty: titleFromUserContent(content) });
  }

  async appendAssistant(sessionId: string, content: string): Promise<void> {
    if (!isSessionId(sessionId)) throw new Error("invalid_session_id");
    await fs.promises.appendFile(
      this.jsonlPath(sessionId),
      JSON.stringify({ role: "assistant", content, ts: nowIso() }) + "\n",
      "utf8",
    );
    await this.touchLastOpened(sessionId);
  }
}

export type AgentSessionKind = "normal" | "coding";

export async function getAgentSessionForApi(
  visitorId: string,
  kind: AgentSessionKind = "normal",
  documentId?: string | null,
): Promise<{
  sessionId: string;
  messages: AgentSessionMessage[];
}> {
  return new AgentSessionManager(visitorId, { kind }).loadLastOpenedMessages(
    kind === "coding" ? documentId : undefined,
  );
}

export async function listAgentSessionsForApi(
  visitorId: string,
  kind: AgentSessionKind = "normal",
  documentId?: string | null,
) {
  return new AgentSessionManager(visitorId, { kind }).listSessions(
    kind === "coding" ? documentId : undefined,
  );
}

export async function createAgentSessionForApi(
  visitorId: string,
  kind: AgentSessionKind = "normal",
  documentId?: string | null,
) {
  return new AgentSessionManager(visitorId, { kind }).createSession(
    kind === "coding" ? documentId : undefined,
  );
}

export async function openAgentSessionForApi(
  visitorId: string,
  sessionId: string,
  kind: AgentSessionKind = "normal",
  documentId?: string | null,
) {
  return new AgentSessionManager(visitorId, { kind }).openSession(
    sessionId,
    kind === "coding" ? documentId : undefined,
  );
}

export async function bindCodingSessionDocumentForApi(
  visitorId: string,
  sessionId: string,
  documentId: string,
) {
  return new AgentSessionManager(visitorId, { kind: "coding" }).bindSessionDocument(
    sessionId,
    documentId,
  );
}
