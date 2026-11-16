import { DocumentError } from "../../access/access-control.js";
import { findDomainByName } from "../../../infra/db/repositories/domain.repo.js";
import { getDb } from "../../../infra/db/connection.js";
import { treeIncludeTypes } from "../../../../shared/file-type-policy.js";
import {
  addDocumentInvite,
  convertDocumentContent,
  createDocument,
  getDocument,
  getDocumentCommit,
  getDocumentInvites,
  getDocumentMergeContext,
  getDocumentSyncStatus,
  listDeletedDocuments,
  listDocumentCommits,
  listDocuments,
  listFolderChildren,
  moveDocument,
  removeDocument,
  removeDocumentInvite,
  removeFolder,
  restoreDocumentFromAudit,
  restoreDocumentVersion,
  updateDocument,
} from "../document.service.js";
import { suggestCommitMessage } from "../suggest-commit-message.js";
import { suggestDocumentMerge } from "../ai-merge.service.js";
import { suggestMergeMessage } from "../suggest-merge-message.js";
import { suggestMergeResolutions } from "../suggest-merge-resolutions.js";
import { buildFolderSubtree } from "../../tree/tree.application.js";
import { searchDocuments, tokenizeQuery } from "../../search/search.service.js";
import { listEmbeddingIndex, rebuildEmbeddingIndex } from "../../search/embedding-admin.js";
import { isEmbeddingReady } from "../../search/embedding-model.js";
import {
  getJobFile,
  saveJobConfig,
  saveMonitorConfig,
} from "../../jobs/job-config.service.js";
import {
  cancelJobRunForDocument,
  deleteJobData,
  getJobData,
  getJobRuns,
  manualRunJob,
} from "../../jobs/job-run.service.js";

export function listDeletedDocs(actorVisitorId: string, limit?: number) {
  return listDeletedDocuments({
    actorVisitorId,
    limit: limit ?? 50,
  });
}

export function restoreDocFromAudit(actorVisitorId: string, auditId: number) {
  return restoreDocumentFromAudit({ actorVisitorId, auditId });
}

export function listDocs(params: {
  domainId?: string;
  domainName?: string;
  visitorId: string | null;
}) {
  let domainId = params.domainId;
  if (params.domainName) {
    const domain = findDomainByName(getDb(), params.domainName);
    if (!domain) {
      throw new DocumentError(
        "DOMAIN_NOT_FOUND",
        `domain '${params.domainName}' not found`,
        404,
      );
    }
    domainId = domain.domain_id;
  }
  return listDocuments(domainId, params.visitorId);
}

export function createDoc(params: {
  actorVisitorId: string;
  fileName: string;
  content: string;
  displayName?: string;
  domainId?: string;
  permission?: number;
  parentId?: string;
  contentFormat?: "markdown";
  fileType: string;
}) {
  return createDocument(params);
}

export function convertContent(params: {
  content: string;
  from: "markdown" | "lexical";
  to: "markdown" | "lexical";
}) {
  return { content: convertDocumentContent(params) };
}

export function embeddingIndex(visitorId: string | null, domainId?: string) {
  return listEmbeddingIndex({ visitorId, domainId });
}

export function embeddingRebuild(visitorId: string | null, documentIds: string[]) {
  return rebuildEmbeddingIndex({ visitorId, documentIds });
}

export function syncStatus(documentId: string, localBaseCommitId?: string) {
  return getDocumentSyncStatus(documentId, localBaseCommitId);
}

export function mergeContext(
  documentId: string,
  localBaseCommitId: string,
  remoteCommitId: string,
) {
  return getDocumentMergeContext(documentId, localBaseCommitId, remoteCommitId);
}

export function commitsList(documentId: string) {
  return listDocumentCommits(documentId);
}

export function commitGet(documentId: string, commitId: string) {
  return getDocumentCommit(documentId, commitId);
}

export function commitRestore(params: {
  actorVisitorId: string;
  documentId: string;
  commitId: string;
}) {
  return restoreDocumentVersion(params);
}

export function readDoc(
  documentId: string,
  visitorId: string | null,
  format: "json" | "text",
) {
  return getDocument(documentId, visitorId, format);
}

export function moveDoc(params: {
  actorVisitorId: string;
  documentId: string;
  parentId: string | null;
}) {
  return moveDocument(params);
}

export type UpdateDocResult =
  | { kind: "merge" }
  | { kind: "doc"; doc: ReturnType<typeof updateDocument> };

export function updateDoc(params: {
  actorVisitorId: string;
  documentId: string;
  content: string;
  displayName?: string;
  permission?: number;
  contentFormat?: "markdown";
  version?: {
    localBaseCommitId?: string;
    merge?: {
      remoteCommitId: string;
      localSnapshotContent?: string;
      forceLocal?: true;
    };
  };
  message?: string;
  source?: "auto" | "manual" | "agent" | "cli";
}): UpdateDocResult {
  const doc = updateDocument(params);
  if (params.version?.merge) return { kind: "merge" };
  return { kind: "doc", doc };
}

export function deleteDoc(actorVisitorId: string, documentId: string): void {
  removeDocument({ actorVisitorId, documentId });
}

export function deleteFolderDoc(actorVisitorId: string, folderDocumentId: string) {
  return removeFolder({ actorVisitorId, folderDocumentId });
}

export function folderChildren(folderId: string, visitorId: string | null) {
  return listFolderChildren(folderId, visitorId);
}

export function folderTree(folderId: string, visitorId: string | null) {
  return buildFolderSubtree(folderId, visitorId, {
    includeTypes: treeIncludeTypes(),
  });
}

export async function searchDocs(params: {
  query: string;
  visitorId: string | null;
  domainId?: string;
  topN?: number;
  mode: "auto" | "keyword" | "semantic";
}) {
  const results = await searchDocuments(params);
  return {
    results,
    modelReady: isEmbeddingReady(),
    tokens: tokenizeQuery(params.query),
  };
}

export function invitesList(documentId: string) {
  return getDocumentInvites(documentId);
}

export function inviteAdd(
  actorVisitorId: string,
  documentId: string,
  targetVisitorId: string,
  targetPermission: string,
): void {
  addDocumentInvite(
    actorVisitorId,
    documentId,
    targetVisitorId,
    targetPermission,
  );
}

export function inviteRemove(
  actorVisitorId: string,
  documentId: string,
  targetVisitorId: string,
): void {
  removeDocumentInvite(actorVisitorId, documentId, targetVisitorId);
}

export function suggestCommit(
  params: Parameters<typeof suggestCommitMessage>[0],
) {
  return suggestCommitMessage(params);
}

export function suggestMerge(params: Parameters<typeof suggestDocumentMerge>[0]) {
  return suggestDocumentMerge(params);
}

export function suggestResolutions(
  params: Parameters<typeof suggestMergeResolutions>[0],
) {
  return suggestMergeResolutions(params);
}

export function suggestMergeMsg(
  params: Parameters<typeof suggestMergeMessage>[0],
) {
  return suggestMergeMessage(params);
}

export function jobConfigGet(documentId: string) {
  return getJobFile(documentId);
}

export function jobConfigPut(params: {
  actorVisitorId: string;
  documentId: string;
  cron?: string;
  prompt?: string;
  jobType?: string;
  tableSchema?: { x?: string; y?: string };
}) {
  return saveJobConfig(params).then((JobConfig) => ({ JobConfig }));
}

export function monitorConfigPut(params: {
  actorVisitorId: string;
  documentId: string;
  rules: Array<{ monitorId?: string; rule?: string; threshold?: number }>;
}) {
  return saveMonitorConfig(params).then((MonitorConfig) => ({ MonitorConfig }));
}

export function jobRunsGet(documentId: string, limit?: number) {
  return { runs: getJobRuns(documentId, limit) };
}

export function jobDataGet(documentId: string, limit?: number) {
  return { points: getJobData(documentId, limit) };
}

export function jobDataRemove(params: {
  documentId: string;
  ids?: number[];
  all?: boolean;
}) {
  return deleteJobData(params);
}

export function jobRunManual(documentId: string) {
  return manualRunJob(documentId);
}

export function jobRunCancel(documentId: string, runIdRaw: string) {
  const runId = Number(runIdRaw);
  if (!Number.isFinite(runId)) {
    throw new DocumentError("BAD_REQUEST", "invalid runId", 400);
  }
  return cancelJobRunForDocument({
    documentId,
    jobRunningId: runId,
  });
}
