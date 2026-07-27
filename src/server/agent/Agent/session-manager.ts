import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getConfig } from "../../config/index.js";

export type AgentSessionRole = "user" | "assistant";

export interface AgentSessionMessage {
  role: AgentSessionRole;
  content: string;
}

type SessionMeta = {
  lastOpenedSessionId: string;
  sessions?: Array<{
    id: string;
    title?: string;
    updatedAt?: string;
  }>;
};

function safeString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class AgentSessionManager {
  private readonly tenantDir: string;
  private readonly sessionDir: string;
  private readonly metaPath: string;

  private cachedSessionId: string | null = null;

  constructor(private readonly visitorId: string) {
    const { dataDir } = getConfig();
    // tenant 仅用于访客私有运行时数据（知识库仍走 files/）
    this.tenantDir = path.join(dataDir, "tenant", visitorId);
    this.sessionDir = path.join(this.tenantDir, "agent", "session");
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
      if (!lastOpenedSessionId) return null;
      return {
        lastOpenedSessionId,
        sessions: Array.isArray(parsed?.sessions) ? parsed!.sessions : undefined,
      };
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && (err as any).code === "ENOENT") return null;
      return null;
    }
  }

  private async writeMeta(meta: SessionMeta): Promise<void> {
    const txt = JSON.stringify(meta, null, 2);
    await fs.promises.writeFile(this.metaPath, txt, "utf8");
  }

  private ensureSessionEntry(meta: SessionMeta, sessionId: string): void {
    if (!meta.sessions) meta.sessions = [];
    const exists = meta.sessions.some((s) => s.id === sessionId);
    if (!exists) meta.sessions.push({ id: sessionId, updatedAt: nowIso() });
    meta.sessions = meta.sessions
      .filter((s) => safeString(s?.id) === s.id)
      .map((s) => (s.id === sessionId ? { ...s, updatedAt: s.updatedAt ?? nowIso() } : s));
  }

  async ensureLastOpened(): Promise<string> {
    await this.ensureSessionDir();
    if (this.cachedSessionId) return this.cachedSessionId;

    const meta = await this.readMeta();
    if (!meta) {
      const sessionId = randomUUID();
      const created: SessionMeta = {
        lastOpenedSessionId: sessionId,
        sessions: [{ id: sessionId, updatedAt: nowIso() }],
      };
      await this.writeMeta(created);
      this.cachedSessionId = sessionId;
      return sessionId;
    }

    const sessionId = meta.lastOpenedSessionId;
    this.ensureSessionEntry(meta, sessionId);
    // 维护 sessions.updatedAt（首次读也做一次轻更新）
    const updatedAt = nowIso();
    meta.sessions = meta.sessions?.map((s) => (s.id === sessionId ? { ...s, updatedAt } : s));
    meta.lastOpenedSessionId = sessionId;
    await this.writeMeta(meta);

    this.cachedSessionId = sessionId;
    return sessionId;
  }

  async loadLastOpenedMessages(): Promise<{ sessionId: string; messages: AgentSessionMessage[] }> {
    const sessionId = await this.ensureLastOpened();
    const jsonlPath = this.jsonlPath(sessionId);

    try {
      const txt = await fs.promises.readFile(jsonlPath, "utf8");
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
      return { sessionId, messages };
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && (err as any).code === "ENOENT") {
        return { sessionId, messages: [] };
      }
      return { sessionId, messages: [] };
    }
  }

  private async touchLastOpened(sessionId: string): Promise<void> {
    const meta = await this.readMeta();
    if (!meta) {
      await this.writeMeta({
        lastOpenedSessionId: sessionId,
        sessions: [{ id: sessionId, updatedAt: nowIso() }],
      });
      return;
    }
    meta.lastOpenedSessionId = sessionId;
    this.ensureSessionEntry(meta, sessionId);
    meta.sessions = meta.sessions?.map((s) => (s.id === sessionId ? { ...s, updatedAt: nowIso() } : s));
    await this.writeMeta(meta);
  }

  async appendUser(sessionId: string, content: string): Promise<void> {
    await fs.promises.appendFile(
      this.jsonlPath(sessionId),
      JSON.stringify({ role: "user", content, ts: nowIso() }) + "\n",
      "utf8",
    );
    await this.touchLastOpened(sessionId);
  }

  async appendAssistant(sessionId: string, content: string): Promise<void> {
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
  const manager = new AgentSessionManager(visitorId);
  return manager.loadLastOpenedMessages();
}

