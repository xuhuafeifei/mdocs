import { randomUUID } from "node:crypto";
import { getConfig } from "../../config/index.js";
import { getDb } from "../../db/connection.js";
import {
  deleteExpiredStagingAttachments,
  findAgentAttachmentById,
  findAgentAttachmentsByIds,
  insertAgentAttachment,
  persistAgentAttachments,
  type AgentAttachmentRow,
} from "../../db/repositories/agent-attachment.repo.js";
import { assertUploadAllowed } from "./capabilities.js";
import { putObject, readObject } from "./object-fs.js";
import {
  STAGING_TTL_MS,
  type AssetMeta,
  type AssetStatus,
} from "./types.js";

function mimeGuess(name: string, fallback?: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".txt")) return "text/plain";
  return fallback?.trim() || "application/octet-stream";
}

function rowToMeta(row: AgentAttachmentRow): AssetMeta {
  return {
    id: row.attachment_id,
    sessionId: row.session_id,
    ownerVisitorId: row.owner_visitor_id,
    sha256: row.sha256,
    name: row.name,
    mime: row.mime,
    bytes: row.byte_size,
    status: row.status as AssetStatus,
    createdAt: row.created_at,
    persistedAt: row.persisted_at,
  };
}

export type AttachmentStore = {
  saveStaging(input: {
    visitorId: string;
    sessionId: string;
    name: string;
    mime?: string;
    data: Uint8Array;
  }): Promise<AssetMeta>;

  persist(input: {
    visitorId: string;
    sessionId: string;
    ids: string[];
  }): Promise<AssetMeta[]>;

  read(input: {
    visitorId: string;
    id: string;
  }): Promise<{ meta: AssetMeta; data: Uint8Array }>;

  purgeExpiredStaging(ttlMs?: number): Promise<number>;
};

let cached: AttachmentStore | null = null;

export function getAttachmentStore(): AttachmentStore {
  if (cached) return cached;
  const cfg = getConfig();
  const objectsDir = `${cfg.agentAttachmentsDir}/objects`;
  cached = createAttachmentStore({ objectsDir });
  return cached;
}

export function createAttachmentStore(deps: {
  objectsDir: string;
  db?: ReturnType<typeof getDb>;
}): AttachmentStore {
  const db = () => deps.db ?? getDb();

  const store: AttachmentStore = {
    async saveStaging(input) {
      const name = input.name.trim() || "file";
      assertUploadAllowed(name, input.data.byteLength);
      // 懒清理：上传时顺带扫过期 staging
      void store.purgeExpiredStaging().catch(() => undefined);

      const sha256 = await putObject(deps.objectsDir, input.data);
      const now = new Date().toISOString();
      const id = randomUUID();
      const row: AgentAttachmentRow = {
        attachment_id: id,
        owner_visitor_id: input.visitorId,
        session_id: input.sessionId,
        sha256,
        name,
        mime: mimeGuess(name, input.mime),
        byte_size: input.data.byteLength,
        status: "staging",
        created_at: now,
        persisted_at: null,
      };
      insertAgentAttachment(db(), row);
      return rowToMeta(row);
    },

    async persist(input) {
      if (input.ids.length === 0) return [];
      const found = findAgentAttachmentsByIds(
        db(),
        input.visitorId,
        input.sessionId,
        input.ids,
      );
      if (found.length !== input.ids.length) {
        throw new Error("attachment_not_found");
      }
      for (const row of found) {
        if (row.status !== "staging" && row.status !== "persisted") {
          throw new Error("invalid_attachment_status");
        }
      }
      const now = new Date().toISOString();
      const stagingIds = found
        .filter((r) => r.status === "staging")
        .map((r) => r.attachment_id);
      if (stagingIds.length > 0) {
        persistAgentAttachments(
          db(),
          input.visitorId,
          input.sessionId,
          stagingIds,
          now,
        );
      }
      const again = findAgentAttachmentsByIds(
        db(),
        input.visitorId,
        input.sessionId,
        input.ids,
      );
      if (again.some((r) => r.status !== "persisted")) {
        throw new Error("persist_failed");
      }
      return again.map(rowToMeta);
    },

    async read(input) {
      const row = findAgentAttachmentById(db(), input.id);
      if (!row || row.owner_visitor_id !== input.visitorId) {
        throw new Error("attachment_not_found");
      }
      const data = await readObject(deps.objectsDir, row.sha256);
      return { meta: rowToMeta(row), data };
    },

    async purgeExpiredStaging(ttlMs = STAGING_TTL_MS) {
      const cutoff = new Date(Date.now() - ttlMs).toISOString();
      const ids = deleteExpiredStagingAttachments(db(), cutoff);
      return ids.length;
    },
  };
  return store;
}
