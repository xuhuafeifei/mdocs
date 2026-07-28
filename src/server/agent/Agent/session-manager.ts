import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getConfig } from "../../config/index.js";

export type AgentSessionRole = "user" | "assistant";

export interface AgentSessionMessage {
  role: AgentSessionRole;
  content: string;
}

export interface AgentSessionSummary {
  id: string;
  title: string;
  updatedAt: string;
}

type SessionMetaEntry = {
  id: string;
  title?: string;
  updatedAt?: string;
};

type SessionMeta = {
  lastOpenedSessionId: string;
  sessions: SessionMetaEntry[];
};

const SESSION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export class AgentSessionManager {
  private readonly sessionDir: string;
  private readonly metaPath: string;

  private cachedSessionId: string | null = null;

  constructor(private readonly visitorId: string) {
    const { dataDir } = getConfig();
    this.sessionDir = path.join(dataDir, "tenant", visitorId, "agent", "session");
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
      return { lastOpenedSessionId, sessions };
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
    patch?: { title?: string; touchUpdatedAt?: boolean },
  ): void {
    const idx = meta.sessions.findIndex((s) => s.id === sessionId);
    const now = nowIso();
    if (idx < 0) {
      meta.sessions.push({
        id: sessionId,
        title: patch?.title,
        updatedAt: now,
      });
      return;
    }
    const cur = meta.sessions[idx]!;
    meta.sessions[idx] = {
      ...cur,
      title: patch?.title !== undefined ? patch.title : cur.title,
      updatedAt: patch?.touchUpdatedAt === false ? cur.updatedAt ?? now : now,
    };
  }

  private sortSummaries(sessions: SessionMetaEntry[]): AgentSessionSummary[] {
    return sessions
      .map((s) => ({
        id: s.id,
        title: (s.title?.trim() || "新会话"),
        updatedAt: s.updatedAt ?? nowIso(),
      }))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  }

  private async loadTranscript(sessionId: string): Promise<AgentSessionMessage[]> {
    try {
      const txt = await fs.promises.readFile(this.jsonlPath(sessionId), "utf8");
      const lines = txt.split("\n").map((l) => l.trim()).filter(Boolean);
      const messages: AgentSessionMessage[] = [];
      for (const line of lines) {
        try {
          const row = JSON.parse(line) as { role?: unknown; content?: unknown };
          const role = row.role === "user" ? "user" : row.role === "assistant" ? "assistant" : null;
          const content = typeof row.content === "string" ? row.content : null;
          if (!role || content === null) continue;
          messages.push({ role, content });
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

  async ensureLastOpened(): Promise<string> {
    await this.ensureSessionDir();
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

  async listSessions(): Promise<{
    lastOpenedSessionId: string;
    sessions: AgentSessionSummary[];
  }> {
    const lastOpenedSessionId = await this.ensureLastOpened();
    const meta = (await this.readMeta())!;
    return {
      lastOpenedSessionId,
      sessions: this.sortSummaries(meta.sessions),
    };
  }

  async loadLastOpenedMessages(): Promise<{
    sessionId: string;
    messages: AgentSessionMessage[];
  }> {
    const sessionId = await this.ensureLastOpened();
    return { sessionId, messages: await this.loadTranscript(sessionId) };
  }

  /** 新建空会话并设为 lastOpened */
  async createSession(): Promise<{ sessionId: string; messages: AgentSessionMessage[] }> {
    await this.ensureSessionDir();
    const sessionId = randomUUID();
    const meta = (await this.readMeta()) ?? {
      lastOpenedSessionId: sessionId,
      sessions: [],
    };
    meta.lastOpenedSessionId = sessionId;
    this.ensureSessionEntry(meta, sessionId, { title: "新会话", touchUpdatedAt: true });
    await this.writeMeta(meta);
    this.cachedSessionId = sessionId;
    return { sessionId, messages: [] };
  }

  /** 切换 lastOpened 并返回该会话 transcript */
  async openSession(sessionId: string): Promise<{
    sessionId: string;
    messages: AgentSessionMessage[];
  }> {
    if (!isSessionId(sessionId)) throw new Error("invalid_session_id");
    await this.ensureSessionDir();
    const meta = await this.readMeta();
    const inMeta = Boolean(meta?.sessions.some((s) => s.id === sessionId));
    const hasFile = fs.existsSync(this.jsonlPath(sessionId));
    if (!inMeta && !hasFile) throw new Error("session_not_found");

    const next = meta ?? { lastOpenedSessionId: sessionId, sessions: [] };
    next.lastOpenedSessionId = sessionId;
    this.ensureSessionEntry(next, sessionId, { touchUpdatedAt: true });
    await this.writeMeta(next);
    this.cachedSessionId = sessionId;
    return { sessionId, messages: await this.loadTranscript(sessionId) };
  }

  private async touchLastOpened(
    sessionId: string,
    patch?: { titleIfEmpty?: string },
  ): Promise<void> {
    const meta = (await this.readMeta()) ?? {
      lastOpenedSessionId: sessionId,
      sessions: [],
    };
    meta.lastOpenedSessionId = sessionId;
    const existing = meta.sessions.find((s) => s.id === sessionId);
    const needTitle =
      patch?.titleIfEmpty && !(existing?.title && existing.title.trim() && existing.title !== "新会话");
    this.ensureSessionEntry(meta, sessionId, {
      title: needTitle ? patch!.titleIfEmpty : undefined,
      touchUpdatedAt: true,
    });
    await this.writeMeta(meta);
    this.cachedSessionId = sessionId;
  }

  async appendUser(sessionId: string, content: string): Promise<void> {
    if (!isSessionId(sessionId)) throw new Error("invalid_session_id");
    await fs.promises.appendFile(
      this.jsonlPath(sessionId),
      JSON.stringify({ role: "user", content, ts: nowIso() }) + "\n",
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

export async function getAgentSessionForApi(visitorId: string): Promise<{
  sessionId: string;
  messages: AgentSessionMessage[];
}> {
  return new AgentSessionManager(visitorId).loadLastOpenedMessages();
}

export async function listAgentSessionsForApi(visitorId: string) {
  return new AgentSessionManager(visitorId).listSessions();
}

export async function createAgentSessionForApi(visitorId: string) {
  return new AgentSessionManager(visitorId).createSession();
}

export async function openAgentSessionForApi(visitorId: string, sessionId: string) {
  return new AgentSessionManager(visitorId).openSession(sessionId);
}
