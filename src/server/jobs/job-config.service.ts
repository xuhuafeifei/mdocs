import { randomUUID } from "node:crypto";
import { DocumentError } from "../access/access-control.js";
import { getDb } from "../db/connection.js";
import { findDocumentById } from "../db/repositories/document.repo.js";
import { updateDocumentContent } from "../db/repositories/document.repo.js";
import { readDocument, writeDocument } from "../storage/file-store.js";
import { FILE_TYPE } from "../../shared/file-types.js";
import { withJobFileLock } from "./job-file-lock.js";
import {
  parseJobFileContent,
  serializeJobFile,
  type JobFileConfig,
  type JobFileDocument,
  type JobMonitorRule,
  type JobTableSchema,
} from "./job-file.js";

export type SaveJobConfigInput = {
  actorVisitorId: string;
  documentId: string;
  cron?: string;
  prompt?: string;
  jobType?: string;
  tableSchema?: Partial<JobTableSchema>;
};

export type SaveMonitorConfigInput = {
  actorVisitorId: string;
  documentId: string;
  rules: Array<Partial<JobMonitorRule> & { rule?: string; threshold?: number }>;
};

function loadJobRow(documentId: string) {
  const db = getDb();
  const row = findDocumentById(db, documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);
  if (row.file_type !== FILE_TYPE.JOB) {
    throw new DocumentError("BAD_REQUEST", "文档不是 Job 类型", 400);
  }
  return row;
}

function readJobDoc(domainId: string, relativePath: string): JobFileDocument {
  const { content } = readDocument(domainId, relativePath);
  return parseJobFileContent(content);
}

function writeJobDoc(params: {
  row: ReturnType<typeof loadJobRow>;
  doc: JobFileDocument;
  actorVisitorId: string;
}): JobFileDocument {
  params.doc.JobConfig.jobId = params.row.document_id;
  const content = serializeJobFile(params.doc);
  const write = writeDocument(
    params.row.domain_id,
    params.row.relative_path,
    content,
  );
  const now = new Date().toISOString();
  updateDocumentContent(getDb(), {
    documentId: params.row.document_id,
    displayName: params.row.display_name,
    contentHash: write.contentHash,
    updatedBy: params.actorVisitorId,
    updatedAt: now,
  });
  return params.doc;
}

export async function saveJobConfig(
  input: SaveJobConfigInput,
): Promise<JobFileConfig> {
  const row = loadJobRow(input.documentId);
  return withJobFileLock(input.documentId, () => {
    const doc = readJobDoc(row.domain_id, row.relative_path);
    const cfg = doc.JobConfig;
    if (input.cron !== undefined) cfg.cron = String(input.cron).trim();
    if (input.prompt !== undefined) cfg.prompt = String(input.prompt);
    if (input.jobType !== undefined) {
      cfg.jobType = String(input.jobType).trim() || "agent";
    }
    if (input.tableSchema) {
      if (input.tableSchema.x !== undefined) {
        cfg.tableSchema.x = String(input.tableSchema.x);
      }
      if (input.tableSchema.y !== undefined) {
        cfg.tableSchema.y = String(input.tableSchema.y);
      }
    }
    doc.JobConfig = cfg;
    return writeJobDoc({
      row,
      doc,
      actorVisitorId: input.actorVisitorId,
    }).JobConfig;
  });
}

export async function saveMonitorConfig(
  input: SaveMonitorConfigInput,
): Promise<JobMonitorRule[]> {
  const row = loadJobRow(input.documentId);
  const rules = normalizeIncomingRules(input.rules);
  return withJobFileLock(input.documentId, () => {
    const doc = readJobDoc(row.domain_id, row.relative_path);
    doc.MonitorConfig = rules;
    return writeJobDoc({
      row,
      doc,
      actorVisitorId: input.actorVisitorId,
    }).MonitorConfig;
  });
}

export async function getJobFile(
  documentId: string,
): Promise<JobFileDocument> {
  const row = loadJobRow(documentId);
  return withJobFileLock(documentId, () =>
    readJobDoc(row.domain_id, row.relative_path),
  );
}

function normalizeIncomingRules(
  rules: SaveMonitorConfigInput["rules"],
): JobMonitorRule[] {
  if (!Array.isArray(rules)) {
    throw new DocumentError("BAD_REQUEST", "rules must be an array", 400);
  }
  return rules.map((r, i) => {
    const monitorId = String(r?.monitorId ?? "").trim() || randomUUID();
    const rule = String(r?.rule ?? "").trim();
    const threshold = Number(r?.threshold);
    if (!rule) {
      throw new DocumentError(
        "BAD_REQUEST",
        `rules[${i}].rule is required`,
        400,
      );
    }
    if (!Number.isFinite(threshold)) {
      throw new DocumentError(
        "BAD_REQUEST",
        `rules[${i}].threshold must be a number`,
        400,
      );
    }
    return { monitorId, rule, threshold };
  });
}
