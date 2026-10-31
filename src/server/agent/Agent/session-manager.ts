import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DEFAULT_DOMAIN_ID } from "../../../shared/domainUi.js";
import { getConfig } from "../../config/index.js";
import { atomicWriteJson, withSessionMetaLock } from "./session-meta-lock.js";
import {
  acquireCompactLock,
  assertNotCompacting,
  isSessionCompacting,
} from "./context-compact-lock.js";

export type AgentSessionRole = "user" | "assistant" | "tool";

export type AgentSessionAssetRef = {
  id: string;
  name: string;
  mime: string;
  bytes: number;
};

/** 聊天 UI 可见行（不含 tool 交换） */
export type AgentSessionChatMessage = {
  role: "user" | "assistant";
  content: string;
  /** user 轮引用的私人 skill 名称（唯一键）；assistant 无此字段 */
  skillNames?: string[];
  /** @deprecated 旧 jsonl；读取时并入 skillNames */
  skillIds?: string[];
  /** user 轮附件 Ref（无字节） */
  assets?: AgentSessionAssetRef[];
};

/** 落盘的 toolCall+toolResult，供下一轮 hydrate（当前：get_document / web_*） */
export type AgentSessionToolMessage = {
  role: "tool";
  toolCallId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  resultText: string;
  isError?: boolean;
};

export type AgentSessionMessage = AgentSessionChatMessage | AgentSessionToolMessage;

export function isChatVisibleMessage(
  m: AgentSessionMessage,
): m is AgentSessionChatMessage {
  return m.role === "user" || m.role === "assistant";
}

export function chatVisibleMessages(
  messages: AgentSessionMessage[],
): AgentSessionChatMessage[] {
  return messages.filter(isChatVisibleMessage);
}

export interface AgentSessionSummary {
  id: string;
  title: string;
  updatedAt: string;
  documentId?: string | null;
  domainId?: string | null;
  pinned?: boolean;
}

type SessionMetaEntry = {
  id: string;
  title?: string;
  updatedAt?: string;
  /** coding：所属文档；缺省/null 视为空白帮写桶 */
  documentId?: string | null;
  /** 创建时的工作空间；缺省/空在读取时迁为 default */
  domainId?: string | null;
  pinned?: boolean;
  pinnedAt?: string;
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

function parseAssetRefsField(raw: unknown): AgentSessionAssetRef[] {
  if (!Array.isArray(raw)) return [];
  const out: AgentSessionAssetRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "string" || !o.id.trim()) continue;
    if (typeof o.name !== "string") continue;
    if (typeof o.mime !== "string") continue;
    if (typeof o.bytes !== "number" || !Number.isFinite(o.bytes)) continue;
    out.push({
      id: o.id.trim(),
      name: o.name,
      mime: o.mime,
      bytes: o.bytes,
    });
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
  private readonly kind: AgentSessionKind;

  private cachedSessionId: string | null = null;

  constructor(
    private readonly visitorId: string,
    opts?: { kind?: AgentSessionKind },
  ) {
    const { dataDir } = getConfig();
    this.kind =
      opts?.kind === "coding"
        ? "coding"
        : opts?.kind === "plugin-pipeline"
          ? "plugin-pipeline"
          : "normal";
    const kindDir =
      this.kind === "coding"
        ? "coding-session"
        : this.kind === "plugin-pipeline"
          ? "plugin-pipeline-session"
          : "session";
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
    await atomicWriteJson(this.metaPath, meta);
  }

  /**
   * 从目录内 *.jsonl 重建 sessions 列表（不删文件）。
   * 用于 meta 损坏 / 被写成只剩一条时的恢复。
   */
  async scanTranscriptEntries(): Promise<SessionMetaEntry[]> {
    await this.ensureSessionDir();
    let names: string[] = [];
    try {
      names = await fs.promises.readdir(this.sessionDir);
    } catch {
      return [];
    }
    const out: SessionMetaEntry[] = [];
    for (const name of names) {
      if (!name.endsWith(".jsonl")) continue;
      const id = name.slice(0, -".jsonl".length);
      if (!isSessionId(id)) continue;
      const full = this.jsonlPath(id);
      let updatedAt = nowIso();
      try {
        const st = await fs.promises.stat(full);
        updatedAt = st.mtime.toISOString();
      } catch {
        /* ignore */
      }
      const title = await this.peekTitleFromTranscript(id);
      out.push({ id, title, updatedAt });
    }
    return out;
  }

  private async peekTitleFromTranscript(sessionId: string): Promise<string | undefined> {
    try {
      const txt = await fs.promises.readFile(this.jsonlPath(sessionId), "utf8");
      for (const line of txt.split("\n")) {
        const t = line.trim();
        if (!t) continue;
        try {
          const row = JSON.parse(t) as { role?: unknown; content?: unknown };
          if (row.role === "user" && typeof row.content === "string" && row.content.trim()) {
            return titleFromUserContent(row.content);
          }
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
    return undefined;
  }

  /** readMeta 失败或 sessions 空时，用磁盘 jsonl 拼一份可用 meta（不写盘）。 */
  private async recoverMetaFromDisk(
    preferLastOpened?: string | null,
  ): Promise<SessionMeta | null> {
    const scanned = await this.scanTranscriptEntries();
    if (scanned.length === 0) return null;
    const prefer =
      preferLastOpened && isSessionId(preferLastOpened) && scanned.some((s) => s.id === preferLastOpened)
        ? preferLastOpened
        : scanned.slice().sort((a, b) => (a.updatedAt! < b.updatedAt! ? 1 : -1))[0]!.id;
    return {
      lastOpenedSessionId: prefer,
      sessions: scanned,
      lastOpenedByDocument: {},
    };
  }

  /**
   * Manager 公开方法级串行入口（队列 key = metaPath）。
   * 所有会动磁盘会话状态的路径只应通过这里，禁止队外裸写。
   */
  private runSerialized<T>(fn: () => Promise<T>): Promise<T> {
    return withSessionMetaLock(this.metaPath, fn);
  }

  /**
   * 已在 runSerialized 内：读改写 meta。
   * read 失败时先从 jsonl 恢复，避免再写成「只剩当前一条」。
   */
  private async mutateMetaUnlocked(
    mutator: (meta: SessionMeta) => void | Promise<void>,
  ): Promise<SessionMeta> {
    let meta = await this.readMeta();
    if (!meta) {
      meta =
        (await this.recoverMetaFromDisk()) ?? {
          lastOpenedSessionId: "",
          sessions: [],
          lastOpenedByDocument: {},
        };
    }
    await mutator(meta);
    if (!meta.lastOpenedSessionId || !isSessionId(meta.lastOpenedSessionId)) {
      const fallback = meta.sessions[0]?.id ?? randomUUID();
      meta.lastOpenedSessionId = fallback;
      this.ensureSessionEntry(meta, fallback, { touchUpdatedAt: false });
    }
    await this.writeMeta(meta);
    return meta;
  }

  /**
   * 把磁盘上有 jsonl、但 meta.sessions 里没有的条目补回去。
   * @returns 补入条数
   */
  async repairMetaFromDisk(opts?: { dryRun?: boolean }): Promise<{
    before: number;
    after: number;
    added: number;
    sessionDir: string;
    dryRun: boolean;
  }> {
    const dryRun = opts?.dryRun === true;
    await this.ensureSessionDir();
    return this.runSerialized(async () => {
      const existing = await this.readMeta();
      const scanned = await this.scanTranscriptEntries();
      const byId = new Map<string, SessionMetaEntry>();
      for (const s of existing?.sessions ?? []) byId.set(s.id, { ...s });
      let added = 0;
      for (const s of scanned) {
        if (byId.has(s.id)) {
          const cur = byId.get(s.id)!;
          if (!cur.title?.trim() && s.title) cur.title = s.title;
          if (!cur.updatedAt && s.updatedAt) cur.updatedAt = s.updatedAt;
          continue;
        }
        byId.set(s.id, s);
        added += 1;
      }
      const sessions = Array.from(byId.values());
      const lastOpened =
        existing?.lastOpenedSessionId && byId.has(existing.lastOpenedSessionId)
          ? existing.lastOpenedSessionId
          : sessions.slice().sort((a, b) => ((a.updatedAt ?? "") < (b.updatedAt ?? "") ? 1 : -1))[0]
              ?.id ?? randomUUID();
      if (sessions.length === 0) {
        return {
          before: existing?.sessions.length ?? 0,
          after: 0,
          added: 0,
          sessionDir: this.sessionDir,
          dryRun,
        };
      }
      const next: SessionMeta = {
        lastOpenedSessionId: lastOpened,
        sessions,
        lastOpenedByDocument: existing?.lastOpenedByDocument,
      };
      if (!dryRun) await this.writeMeta(next);
      return {
        before: existing?.sessions.length ?? 0,
        after: sessions.length,
        added,
        sessionDir: this.sessionDir,
        dryRun,
      };
    });
  }

  private ensureSessionEntry(
    meta: SessionMeta,
    sessionId: string,
    patch?: {
      title?: string;
      touchUpdatedAt?: boolean;
      documentId?: string | null;
      domainId?: string | null;
      pinned?: boolean;
      pinnedAt?: string | null;
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
        domainId: patch?.domainId !== undefined ? patch.domainId : undefined,
        pinned: patch?.pinned === true ? true : undefined,
        pinnedAt:
          patch?.pinned === true
            ? patch.pinnedAt ?? now
            : patch?.pinnedAt !== undefined
              ? patch.pinnedAt ?? undefined
              : undefined,
      });
      return;
    }
    const cur = meta.sessions[idx]!;
    let pinned = cur.pinned;
    let pinnedAt = cur.pinnedAt;
    if (patch?.pinned !== undefined) {
      pinned = patch.pinned ? true : undefined;
      pinnedAt = patch.pinned ? (patch.pinnedAt ?? now) : undefined;
    } else if (patch?.pinnedAt !== undefined) {
      pinnedAt = patch.pinnedAt ?? undefined;
    }
    meta.sessions[idx] = {
      ...cur,
      title: patch?.title !== undefined ? patch.title : cur.title,
      updatedAt: patch?.touchUpdatedAt === false ? cur.updatedAt ?? now : now,
      documentId:
        patch?.documentId !== undefined ? patch.documentId : cur.documentId,
      domainId: patch?.domainId !== undefined ? patch.domainId : cur.domainId,
      pinned,
      pinnedAt,
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
    const mapped = sessions.map((s) => ({
      id: s.id,
      title: s.title?.trim() || "新会话",
      updatedAt: s.updatedAt ?? nowIso(),
      documentId: s.documentId ?? null,
      domainId: s.domainId ?? null,
      pinned: s.pinned === true,
      pinnedAt: s.pinnedAt,
    }));
    mapped.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.pinned && b.pinned) {
        const pa = a.pinnedAt ?? a.updatedAt;
        const pb = b.pinnedAt ?? b.updatedAt;
        if (pa !== pb) return pa < pb ? 1 : -1;
      }
      return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0;
    });
    return mapped.map(({ pinnedAt: _p, ...rest }) => rest);
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
            assets?: unknown;
            toolCallId?: unknown;
            toolName?: unknown;
            arguments?: unknown;
            resultText?: unknown;
            isError?: unknown;
          };
          if (row.role === "tool") {
            const toolCallId =
              typeof row.toolCallId === "string" ? row.toolCallId.trim() : "";
            const toolName =
              typeof row.toolName === "string" ? row.toolName.trim() : "";
            const resultText =
              typeof row.resultText === "string" ? row.resultText : "";
            if (!toolCallId || !toolName) continue;
            const args =
              row.arguments &&
              typeof row.arguments === "object" &&
              !Array.isArray(row.arguments)
                ? (row.arguments as Record<string, unknown>)
                : {};
            const msg: AgentSessionToolMessage = {
              role: "tool",
              toolCallId,
              toolName,
              arguments: args,
              resultText,
            };
            if (row.isError === true) msg.isError = true;
            messages.push(msg);
            continue;
          }
          const role =
            row.role === "user" ? "user" : row.role === "assistant" ? "assistant" : null;
          const content = typeof row.content === "string" ? row.content : null;
          if (!role || content === null) continue;
          const fromNames = parseSkillRefsField(row.skillNames);
          const fromIds = parseSkillRefsField(row.skillIds);
          const skillNames =
            fromNames.length > 0 ? fromNames : fromIds.length > 0 ? fromIds : [];
          const assets = parseAssetRefsField(row.assets);
          const msg: AgentSessionChatMessage = { role, content };
          if (role === "user" && skillNames.length > 0) msg.skillNames = skillNames;
          if (role === "user" && assets.length > 0) msg.assets = assets;
          messages.push(msg);
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

  /** 已在 runSerialized 内：确保 lastOpened。 */
  private async ensureLastOpenedUnlocked(documentId?: string | null): Promise<string> {
    if (this.kind !== "coding") {
      const meta = await this.mutateMetaUnlocked((m) => {
        if (!m.lastOpenedSessionId || !isSessionId(m.lastOpenedSessionId)) {
          const sessionId = m.sessions[0]?.id ?? randomUUID();
          m.lastOpenedSessionId = sessionId;
          this.ensureSessionEntry(m, sessionId, { touchUpdatedAt: false });
          return;
        }
        this.ensureSessionEntry(m, m.lastOpenedSessionId, { touchUpdatedAt: false });
      });
      this.cachedSessionId = meta.lastOpenedSessionId;
      return meta.lastOpenedSessionId;
    }

    const key = docScopeKey(documentId);
    const meta = await this.mutateMetaUnlocked((m) => {
      const scoped = this.filterByDocument(m.sessions, documentId);
      const mapped = m.lastOpenedByDocument?.[key];
      const mappedOk =
        mapped && isSessionId(mapped) && scoped.some((s) => s.id === mapped);

      if (mappedOk) {
        m.lastOpenedSessionId = mapped!;
        this.ensureSessionEntry(m, mapped!, { touchUpdatedAt: false });
        return;
      }

      if (scoped[0]) {
        const sessionId = scoped[0].id;
        m.lastOpenedSessionId = sessionId;
        this.setLastOpenedForDoc(m, documentId, sessionId);
        return;
      }

      const sessionId = randomUUID();
      m.lastOpenedSessionId = sessionId;
      this.ensureSessionEntry(m, sessionId, {
        touchUpdatedAt: true,
        documentId: documentId?.trim() ? documentId.trim() : null,
      });
      this.setLastOpenedForDoc(m, documentId, sessionId);
    });
    this.cachedSessionId = meta.lastOpenedSessionId;
    return meta.lastOpenedSessionId;
  }

  /**
   * 确保有可用 lastOpened。
   * coding + documentId：按文档维度；normal：全局 lastOpened。
   */
  async ensureLastOpened(documentId?: string | null): Promise<string> {
    await this.ensureSessionDir();
    if (this.kind !== "coding" && this.cachedSessionId) return this.cachedSessionId;
    return this.runSerialized(() => this.ensureLastOpenedUnlocked(documentId));
  }

  /** 旧条目无 domainId → 归入 default 工作空间，有改动则写回 */
  private backfillDefaultDomain(meta: SessionMeta): boolean {
    let changed = false;
    for (const s of meta.sessions) {
      const id = typeof s.domainId === "string" ? s.domainId.trim() : "";
      if (!id) {
        s.domainId = DEFAULT_DOMAIN_ID;
        changed = true;
      }
    }
    return changed;
  }

  async listSessions(documentId?: string | null): Promise<{
    lastOpenedSessionId: string;
    sessions: AgentSessionSummary[];
  }> {
    await this.ensureSessionDir();
    return this.runSerialized(async () => {
      const lastOpenedSessionId = await this.ensureLastOpenedUnlocked(documentId);
      let meta = await this.readMeta();
      if (meta && this.backfillDefaultDomain(meta)) {
        await this.writeMeta(meta);
      }
      const scoped = this.filterByDocument(meta?.sessions ?? [], documentId);
      return {
        lastOpenedSessionId,
        sessions: this.sortSummaries(scoped),
      };
    });
  }

  async loadLastOpenedMessages(documentId?: string | null): Promise<{
    sessionId: string;
    messages: AgentSessionMessage[];
  }> {
    await this.ensureSessionDir();
    return this.runSerialized(async () => {
      const sessionId = await this.ensureLastOpenedUnlocked(documentId);
      return { sessionId, messages: await this.loadTranscript(sessionId) };
    });
  }

  /** 新建空会话并设为该文档（或空白桶）的 lastOpened */
  async createSession(opts?: {
    documentId?: string | null;
    domainId?: string | null;
  }): Promise<{
    sessionId: string;
    messages: AgentSessionMessage[];
  }> {
    await this.ensureSessionDir();
    const sessionId = randomUUID();
    const documentId = opts?.documentId;
    const doc =
      this.kind === "coding"
        ? documentId?.trim()
          ? documentId.trim()
          : null
        : undefined;
    const domainRaw = typeof opts?.domainId === "string" ? opts.domainId.trim() : "";
    const domainId = domainRaw || DEFAULT_DOMAIN_ID;
    return this.runSerialized(async () => {
      await this.mutateMetaUnlocked((meta) => {
        meta.lastOpenedSessionId = sessionId;
        this.ensureSessionEntry(meta, sessionId, {
          title: "新会话",
          touchUpdatedAt: true,
          documentId: doc,
          domainId,
        });
        if (this.kind === "coding") {
          this.setLastOpenedForDoc(meta, documentId, sessionId);
        }
      });
      this.cachedSessionId = sessionId;
      return { sessionId, messages: [] };
    });
  }

  /** 手动改标题；不 touch updatedAt */
  async renameSession(sessionId: string, title: string): Promise<AgentSessionSummary> {
    if (!isSessionId(sessionId)) throw new Error("invalid_session_id");
    const next = title.trim();
    if (!next) throw new Error("title_required");
    if (next.length > 80) throw new Error("title_too_long");
    await this.ensureSessionDir();
    return this.runSerialized(async () => {
      await this.mutateMetaUnlocked((meta) => {
        const entry = meta.sessions.find((s) => s.id === sessionId);
        if (!entry && !fs.existsSync(this.jsonlPath(sessionId))) {
          throw new Error("session_not_found");
        }
        this.ensureSessionEntry(meta, sessionId, {
          title: next,
          touchUpdatedAt: false,
        });
      });
      const meta = await this.readMeta();
      const entry = meta?.sessions.find((s) => s.id === sessionId)!;
      return this.sortSummaries([entry])[0]!;
    });
  }

  /** 置顶 / 取消；不 touch updatedAt */
  async setSessionPinned(
    sessionId: string,
    pinned: boolean,
  ): Promise<AgentSessionSummary> {
    if (!isSessionId(sessionId)) throw new Error("invalid_session_id");
    await this.ensureSessionDir();
    return this.runSerialized(async () => {
      await this.mutateMetaUnlocked((meta) => {
        const entry = meta.sessions.find((s) => s.id === sessionId);
        if (!entry && !fs.existsSync(this.jsonlPath(sessionId))) {
          throw new Error("session_not_found");
        }
        this.ensureSessionEntry(meta, sessionId, {
          pinned,
          touchUpdatedAt: false,
        });
      });
      const meta = await this.readMeta();
      const entry = meta?.sessions.find((s) => s.id === sessionId)!;
      return this.sortSummaries([entry])[0]!;
    });
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

    return this.runSerialized(async () => {
      await this.mutateMetaUnlocked((meta) => {
        const inMeta = meta.sessions.some((s) => s.id === sessionId);
        const hasFile = fs.existsSync(this.jsonlPath(sessionId));
        if (!inMeta && !hasFile) throw new Error("session_not_found");

        const entry = meta.sessions.find((s) => s.id === sessionId);
        if (this.kind === "coding" && documentId !== undefined) {
          const want = docScopeKey(documentId);
          const have = entry ? entryDocKey(entry) : CODING_BLANK_DOC_KEY;
          if (want !== have) throw new Error("session_document_mismatch");
        }

        meta.lastOpenedSessionId = sessionId;
        this.ensureSessionEntry(meta, sessionId, { touchUpdatedAt: true });
        if (this.kind === "coding") {
          const bindDoc = entry?.documentId ?? (documentId !== undefined ? documentId : null);
          this.setLastOpenedForDoc(meta, bindDoc, sessionId);
        }
      });
      this.cachedSessionId = sessionId;
      return { sessionId, messages: await this.loadTranscript(sessionId) };
    });
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
    return this.runSerialized(async () => {
      await this.mutateMetaUnlocked((meta) => {
        const inMeta = meta.sessions.some((s) => s.id === sessionId);
        const hasFile = fs.existsSync(this.jsonlPath(sessionId));
        if (!inMeta && !hasFile) throw new Error("session_not_found");

        this.ensureSessionEntry(meta, sessionId, {
          documentId: doc,
          touchUpdatedAt: true,
        });
        meta.lastOpenedSessionId = sessionId;
        this.setLastOpenedForDoc(meta, doc, sessionId);
        if (meta.lastOpenedByDocument?.[CODING_BLANK_DOC_KEY] === sessionId) {
          delete meta.lastOpenedByDocument[CODING_BLANK_DOC_KEY];
        }
      });
      this.cachedSessionId = sessionId;
      return { sessionId, documentId: doc };
    });
  }

  private async touchLastOpenedUnlocked(
    sessionId: string,
    patch?: { titleIfEmpty?: string },
  ): Promise<void> {
    await this.mutateMetaUnlocked((meta) => {
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
    });
    this.cachedSessionId = sessionId;
  }

  jsonlFilePath(sessionId: string): string {
    return this.jsonlPath(sessionId);
  }

  isCompacting(sessionId: string): boolean {
    return isSessionCompacting(this.jsonlPath(sessionId));
  }

  async acquireSessionCompactLock(sessionId: string): Promise<() => Promise<void>> {
    if (!isSessionId(sessionId)) throw new Error("invalid_session_id");
    return acquireCompactLock(this.jsonlPath(sessionId), sessionId);
  }

  async loadMessages(sessionId: string): Promise<AgentSessionMessage[]> {
    if (!isSessionId(sessionId)) throw new Error("invalid_session_id");
    return this.loadTranscript(sessionId);
  }

  /**
   * 整文件替换 jsonl（压缩写回）。先备份再原子 rename。
   * markSummary：首条 user 若带压缩前缀则写 kind=context_compact_summary
   */
  async replaceTranscript(
    sessionId: string,
    messages: AgentSessionMessage[],
    opts?: { markSummary?: boolean },
  ): Promise<void> {
    if (!isSessionId(sessionId)) throw new Error("invalid_session_id");
    const jsonl = this.jsonlPath(sessionId);
    await this.runSerialized(async () => {
      // 压缩流程应已持有 compact lock
      if (!isSessionCompacting(jsonl)) {
        throw new Error("compact_lock_required");
      }
      const lines: string[] = [];
      for (let i = 0; i < messages.length; i++) {
        const m = messages[i]!;
        if (m.role === "tool") {
          const row: Record<string, unknown> = {
            role: "tool",
            toolCallId: m.toolCallId,
            toolName: m.toolName,
            arguments: m.arguments,
            resultText: m.resultText,
            ts: nowIso(),
          };
          if (m.isError) row.isError = true;
          lines.push(JSON.stringify(row));
          continue;
        }
        const row: Record<string, unknown> = {
          role: m.role,
          content: m.content,
          ts: nowIso(),
        };
        if (m.role === "user" && m.skillNames?.length) row.skillNames = m.skillNames;
        if (m.role === "user" && m.assets?.length) row.assets = m.assets;
        if (
          opts?.markSummary &&
          i === 0 &&
          m.role === "user" &&
          m.content.startsWith("【系统·上下文压缩】")
        ) {
          row.kind = "context_compact_summary";
        }
        lines.push(JSON.stringify(row));
      }
      const body = lines.length ? `${lines.join("\n")}\n` : "";
      const bak = `${jsonl}.bak-compact-${Date.now()}`;
      try {
        if (fs.existsSync(jsonl)) {
          await fs.promises.rename(jsonl, bak);
          // 只留最近 2 个 bak
          const dir = path.dirname(jsonl);
          const base = path.basename(jsonl);
          const baks = (await fs.promises.readdir(dir))
            .filter((n) => n.startsWith(`${base}.bak-compact-`))
            .sort();
          while (baks.length > 2) {
            const old = baks.shift();
            if (old) await fs.promises.unlink(path.join(dir, old)).catch(() => undefined);
          }
        }
      } catch {
        /* 无原文件亦可 */
      }
      const tmp = `${jsonl}.tmp.${process.pid}.${randomUUID()}`;
      await fs.promises.writeFile(tmp, body, "utf8");
      await fs.promises.rename(tmp, jsonl);
      await this.touchLastOpenedUnlocked(sessionId);
    });
  }

  /** jsonl append + touch meta 同一 Manager 队列任务。 */
  async appendUser(
    sessionId: string,
    content: string,
    skillNames?: string[],
    assets?: AgentSessionAssetRef[],
  ): Promise<void> {
    if (!isSessionId(sessionId)) throw new Error("invalid_session_id");
    assertNotCompacting(this.jsonlPath(sessionId), sessionId);
    const names = Array.isArray(skillNames)
      ? skillNames
          .filter((n) => typeof n === "string" && n.trim())
          .map((n) => n.trim())
      : [];
    const assetRefs = Array.isArray(assets)
      ? assets.filter(
          (a) =>
            a &&
            typeof a.id === "string" &&
            typeof a.name === "string" &&
            typeof a.mime === "string" &&
            typeof a.bytes === "number",
        )
      : [];
    const row: Record<string, unknown> = { role: "user", content, ts: nowIso() };
    if (names.length > 0) row.skillNames = names;
    if (assetRefs.length > 0) row.assets = assetRefs;
    const titleSource =
      content.trim() ||
      (assetRefs[0] ? `附件 ${assetRefs[0].name}` : "");
    await this.runSerialized(async () => {
      await fs.promises.appendFile(
        this.jsonlPath(sessionId),
        JSON.stringify(row) + "\n",
        "utf8",
      );
      await this.touchLastOpenedUnlocked(sessionId, {
        titleIfEmpty: titleFromUserContent(titleSource),
      });
    });
  }

  async appendAssistant(sessionId: string, content: string): Promise<void> {
    if (!isSessionId(sessionId)) throw new Error("invalid_session_id");
    assertNotCompacting(this.jsonlPath(sessionId), sessionId);
    await this.runSerialized(async () => {
      await fs.promises.appendFile(
        this.jsonlPath(sessionId),
        JSON.stringify({ role: "assistant", content, ts: nowIso() }) + "\n",
        "utf8",
      );
      await this.touchLastOpenedUnlocked(sessionId);
    });
  }

  /**
   * 落盘 tool 交换（get_document / web_search / web_fetch 等）。
   * 顺序插在 user 与最终 assistant 之间，下一轮 hydrate 成 toolCall+toolResult。
   */
  async appendToolExchange(
    sessionId: string,
    exchange: {
      toolCallId: string;
      toolName: string;
      arguments: Record<string, unknown>;
      resultText: string;
      isError?: boolean;
    },
  ): Promise<void> {
    if (!isSessionId(sessionId)) throw new Error("invalid_session_id");
    assertNotCompacting(this.jsonlPath(sessionId), sessionId);
    const toolCallId = String(exchange.toolCallId ?? "").trim();
    const toolName = String(exchange.toolName ?? "").trim();
    if (!toolCallId || !toolName) return;
    const row: Record<string, unknown> = {
      role: "tool",
      toolCallId,
      toolName,
      arguments: exchange.arguments ?? {},
      resultText: exchange.resultText ?? "",
      ts: nowIso(),
    };
    if (exchange.isError) row.isError = true;
    await this.runSerialized(async () => {
      await fs.promises.appendFile(
        this.jsonlPath(sessionId),
        JSON.stringify(row) + "\n",
        "utf8",
      );
      await this.touchLastOpenedUnlocked(sessionId);
    });
  }
}

export type AgentSessionKind = "normal" | "coding" | "plugin-pipeline";

export async function getAgentSessionForApi(
  visitorId: string,
  kind: AgentSessionKind = "normal",
  documentId?: string | null,
): Promise<{
  sessionId: string;
  messages: AgentSessionChatMessage[];
}> {
  const { sessionId, messages } = await new AgentSessionManager(visitorId, {
    kind,
  }).loadLastOpenedMessages(kind === "coding" ? documentId : undefined);
  return { sessionId, messages: chatVisibleMessages(messages) };
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
  domainId?: string | null,
) {
  return new AgentSessionManager(visitorId, { kind }).createSession({
    documentId: kind === "coding" ? documentId : undefined,
    domainId: domainId ?? null,
  });
}

export async function renameAgentSessionForApi(
  visitorId: string,
  sessionId: string,
  title: string,
  kind: AgentSessionKind = "normal",
) {
  return new AgentSessionManager(visitorId, { kind }).renameSession(sessionId, title);
}

export async function pinAgentSessionForApi(
  visitorId: string,
  sessionId: string,
  pinned: boolean,
  kind: AgentSessionKind = "normal",
) {
  return new AgentSessionManager(visitorId, { kind }).setSessionPinned(sessionId, pinned);
}

export async function openAgentSessionForApi(
  visitorId: string,
  sessionId: string,
  kind: AgentSessionKind = "normal",
  documentId?: string | null,
) {
  const { sessionId: id, messages } = await new AgentSessionManager(
    visitorId,
    { kind },
  ).openSession(sessionId, kind === "coding" ? documentId : undefined);
  return { sessionId: id, messages: chatVisibleMessages(messages) };
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

export type AgentSessionRepairRow = {
  visitorId: string;
  kind: AgentSessionKind;
  sessionDir: string;
  before: number;
  after: number;
  added: number;
  dryRun: boolean;
};

/** 修复单个访客的 normal / coding session meta（按 kind）。 */
export async function repairAgentSessionsForVisitor(params: {
  visitorId: string;
  kind?: AgentSessionKind | "all";
  dryRun: boolean;
}): Promise<AgentSessionRepairRow[]> {
  const kinds: AgentSessionKind[] =
    params.kind === "coding"
      ? ["coding"]
      : params.kind === "plugin-pipeline"
        ? ["plugin-pipeline"]
        : params.kind === "normal"
          ? ["normal"]
          : ["normal", "coding", "plugin-pipeline"];
  const rows: AgentSessionRepairRow[] = [];
  for (const kind of kinds) {
    const mgr = new AgentSessionManager(params.visitorId, { kind });
    const r = await mgr.repairMetaFromDisk({ dryRun: params.dryRun });
    rows.push({
      visitorId: params.visitorId,
      kind,
      sessionDir: r.sessionDir,
      before: r.before,
      after: r.after,
      added: r.added,
      dryRun: r.dryRun,
    });
  }
  return rows;
}

/** 扫描 dataDir/tenant/*，修复全部（或指定）访客的 session 索引。 */
export async function repairAgentSessionsUnderDataDir(params: {
  visitorId?: string;
  kind?: AgentSessionKind | "all";
  dryRun: boolean;
}): Promise<AgentSessionRepairRow[]> {
  const { dataDir } = getConfig();
  const tenantRoot = path.join(dataDir, "tenant");
  let visitorIds: string[] = [];
  if (params.visitorId) {
    visitorIds = [params.visitorId];
  } else {
    try {
      visitorIds = (await fs.promises.readdir(tenantRoot)).filter((name) => {
        try {
          return fs.statSync(path.join(tenantRoot, name)).isDirectory();
        } catch {
          return false;
        }
      });
    } catch {
      return [];
    }
  }
  const out: AgentSessionRepairRow[] = [];
  for (const visitorId of visitorIds) {
    out.push(
      ...(await repairAgentSessionsForVisitor({
        visitorId,
        kind: params.kind ?? "all",
        dryRun: params.dryRun,
      })),
    );
  }
  return out;
}
