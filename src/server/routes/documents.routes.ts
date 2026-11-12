import { Router, type Request, type Response } from "express";
import { DocumentError } from "../modules/access/access-control.js";
import {
  addDocumentInvite,
  createDocument,
  convertDocumentContent,
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
  removeFolder,
  removeDocumentInvite,
  restoreDocumentFromAudit,
  restoreDocumentVersion,
  updateDocument,
} from "../modules/documents/document.service.js";
import { suggestCommitMessage } from "../modules/documents/suggest-commit-message.js";
import { suggestDocumentMerge } from "../modules/documents/ai-merge.service.js";
import { suggestMergeMessage } from "../modules/documents/suggest-merge-message.js";
import { suggestMergeResolutions } from "../modules/documents/suggest-merge-resolutions.js";
import { findDomainByName } from "../infra/db/repositories/domain.repo.js";
import { getDb } from "../infra/db/connection.js";
import { searchDocuments, tokenizeQuery } from "../modules/search/search.service.js";
import { listEmbeddingIndex, rebuildEmbeddingIndex } from "../modules/search/embedding-admin.js";
import { isEmbeddingReady } from "../modules/search/embedding-model.js";
import { requireDocumentAccess, requireDocumentOwner } from "../middleware/document-auth.middleware.js";
import { StoragePathError } from "../infra/storage/paths.js";
import { treeIncludeTypes } from "../../shared/file-type-policy.js";
import { useLogger } from "../infra/logger/logger.js";
import { buildFolderSubtree } from "../modules/documents/tree.service.js";
import {
  getJobFile,
  saveJobConfig,
  saveMonitorConfig,
} from "../modules/jobs/job-config.service.js";
import {
  cancelJobRunForDocument,
  deleteJobData,
  getJobData,
  getJobRuns,
  manualRunJob,
} from "../modules/jobs/job-run.service.js";
import { parseBody, parseQuery, requireVisitor } from "../infra/http/request.js";
import {
  addInviteBodySchema,
  convertBodySchema,
  createDocumentBodySchema,
  deletedQuerySchema,
  embeddingIndexQuerySchema,
  embeddingRebuildBodySchema,
  getDocumentQuerySchema,
  jobConfigPutBodySchema,
  jobDataDeleteBodySchema,
  jobLimitQuerySchema,
  listDocumentsQuerySchema,
  mergeContextQuerySchema,
  monitorConfigPutBodySchema,
  moveDocumentBodySchema,
  restoreBodySchema,
  searchBodySchema,
  suggestCommitMessageBodySchema,
  suggestDocumentMergeBodySchema,
  suggestMergeMessageBodySchema,
  suggestMergeResolutionsBodySchema,
  syncStatusQuerySchema,
  updateDocumentBodySchema,
} from "./documents.schemas.js";

const log = useLogger("documents-route");

/**
 * 构建文档相关路由。
 *
 * 边界校验见 documents.schemas.ts；业务在 document.service / jobs。
 */
export function buildDocumentsRouter(): Router {
  const router = Router();

  router.get("/deleted", (req: Request, res: Response) => {
    const visitor = requireVisitor(req, res);
    if (!visitor) return;
    const query = parseQuery(req, res, deletedQuerySchema);
    if (!query) return;
    const items = listDeletedDocuments({
      actorVisitorId: visitor.visitor_id,
      limit: query.limit ?? 50,
    });
    res.json({ data: items });
  });

  router.post("/restore", (req: Request, res: Response) => {
    const visitor = requireVisitor(req, res);
    if (!visitor) return;
    const body = parseBody(req, res, restoreBodySchema);
    if (!body) return;
    try {
      const doc = restoreDocumentFromAudit({
        actorVisitorId: visitor.visitor_id,
        auditId: body.auditId,
      });
      res.status(201).json({ data: doc });
    } catch (err) {
      respondError(res, err, "documents-route.restore");
    }
  });

  router.get("/", (req: Request, res: Response) => {
    const query = parseQuery(req, res, listDocumentsQuerySchema);
    if (!query) return;
    let domainId = query.domainId;
    if (query.domainName) {
      const domain = findDomainByName(getDb(), query.domainName);
      if (!domain) {
        res.status(404).json({
          error: {
            code: "DOMAIN_NOT_FOUND",
            message: `domain '${query.domainName}' not found`,
          },
        });
        return;
      }
      domainId = domain.domain_id;
    }
    const visitorId = req.visitor?.visitor_id ?? null;
    const docs = listDocuments(domainId, visitorId);
    res.json({ data: docs });
  });

  router.post("/", (req: Request, res: Response) => {
    const visitor = requireVisitor(req, res);
    if (!visitor) return;
    const body = parseBody(req, res, createDocumentBodySchema);
    if (!body) return;
    try {
      const doc = createDocument({
        actorVisitorId: visitor.visitor_id,
        fileName: body.fileName,
        displayName: body.displayName,
        content: body.content,
        fileType: body.fileType,
        domainId: body.domainId,
        permission: body.permission,
        parentId: body.parentId,
        contentFormat: body.contentFormat,
      });
      res.status(201).json({ data: doc });
    } catch (err) {
      respondError(res, err, "documents-route.create");
    }
  });

  router.post("/convert", (req: Request, res: Response) => {
    const body = parseBody(req, res, convertBodySchema);
    if (!body) return;
    try {
      const out = convertDocumentContent({
        content: body.content,
        from: body.from,
        to: body.to,
      });
      res.json({ data: { content: out } });
    } catch (err) {
      respondError(res, err, "documents-route.convert");
    }
  });

  router.get("/embedding-index", (req: Request, res: Response) => {
    const query = parseQuery(req, res, embeddingIndexQuerySchema);
    if (!query) return;
    const visitorId = req.visitor?.visitor_id ?? null;
    const data = listEmbeddingIndex({ visitorId, domainId: query.domainId });
    res.json({ data });
  });

  router.post("/embedding-rebuild", async (req: Request, res: Response) => {
    const body = parseBody(req, res, embeddingRebuildBodySchema);
    if (!body) return;
    const visitorId = req.visitor?.visitor_id ?? null;
    const data = await rebuildEmbeddingIndex({
      visitorId,
      documentIds: body.documentIds,
    });
    res.json({ data });
  });

  router.get(
    "/:documentId/sync-status",
    requireDocumentAccess("read"),
    (req: Request, res: Response) => {
      const query = parseQuery(req, res, syncStatusQuerySchema);
      if (!query) return;
      try {
        const status = getDocumentSyncStatus(
          req.params.documentId!,
          query.localBaseCommitId,
        );
        res.json({ data: status });
      } catch (err) {
        respondError(res, err, "documents-route.sync-status");
      }
    },
  );

  router.get(
    "/:documentId/merge-context",
    requireDocumentAccess("read"),
    (req: Request, res: Response) => {
      const query = parseQuery(req, res, mergeContextQuerySchema);
      if (!query) return;
      try {
        const ctx = getDocumentMergeContext(
          req.params.documentId!,
          query.localBaseCommitId,
          query.remoteCommitId,
        );
        res.json({ data: ctx });
      } catch (err) {
        respondError(res, err, "documents-route.merge-context");
      }
    },
  );

  router.get(
    "/:documentId/commits",
    requireDocumentAccess("read"),
    (req: Request, res: Response) => {
      try {
        const items = listDocumentCommits(req.params.documentId!);
        res.json({ data: items });
      } catch (err) {
        respondError(res, err, "documents-route.commits.list");
      }
    },
  );

  router.get(
    "/:documentId/commits/:commitId",
    requireDocumentAccess("read"),
    (req: Request, res: Response) => {
      try {
        const detail = getDocumentCommit(
          req.params.documentId!,
          req.params.commitId!,
        );
        res.json({ data: detail });
      } catch (err) {
        respondError(res, err, "documents-route.commits.get");
      }
    },
  );

  router.post(
    "/:documentId/commits/:commitId/restore",
    requireDocumentAccess("edit"),
    (req: Request, res: Response) => {
      const visitor = requireVisitor(req, res);
      if (!visitor) return;
      try {
        const doc = restoreDocumentVersion({
          actorVisitorId: visitor.visitor_id,
          documentId: req.params.documentId!,
          commitId: req.params.commitId!,
        });
        res.json({ data: doc });
      } catch (err) {
        respondError(res, err, "documents-route.commits.restore");
      }
    },
  );

  router.get(
    "/:documentId/job-config",
    requireDocumentAccess("read"),
    async (req: Request, res: Response) => {
      try {
        const doc = await getJobFile(req.params.documentId!);
        res.json({ data: doc });
      } catch (err) {
        respondError(res, err, "documents-route.job-config.get");
      }
    },
  );

  router.put(
    "/:documentId/job-config",
    requireDocumentAccess("edit"),
    async (req: Request, res: Response) => {
      const visitor = requireVisitor(req, res);
      if (!visitor) return;
      const body = parseBody(req, res, jobConfigPutBodySchema);
      if (!body) return;
      try {
        const JobConfig = await saveJobConfig({
          actorVisitorId: visitor.visitor_id,
          documentId: req.params.documentId!,
          cron: body.cron,
          prompt: body.prompt,
          jobType: body.jobType,
          tableSchema: body.tableSchema,
        });
        res.json({ data: { JobConfig } });
      } catch (err) {
        respondError(res, err, "documents-route.job-config.put");
      }
    },
  );

  router.put(
    "/:documentId/monitor-config",
    requireDocumentAccess("edit"),
    async (req: Request, res: Response) => {
      const visitor = requireVisitor(req, res);
      if (!visitor) return;
      const body = parseBody(req, res, monitorConfigPutBodySchema);
      if (!body) return;
      try {
        const MonitorConfig = await saveMonitorConfig({
          actorVisitorId: visitor.visitor_id,
          documentId: req.params.documentId!,
          rules: body.rules,
        });
        res.json({ data: { MonitorConfig } });
      } catch (err) {
        respondError(res, err, "documents-route.monitor-config.put");
      }
    },
  );

  router.get(
    "/:documentId/job-runs",
    requireDocumentAccess("read"),
    (req: Request, res: Response) => {
      const query = parseQuery(req, res, jobLimitQuerySchema);
      if (!query) return;
      try {
        const runs = getJobRuns(req.params.documentId!, query.limit);
        res.json({ data: { runs } });
      } catch (err) {
        respondError(res, err, "documents-route.job-runs.get");
      }
    },
  );

  router.get(
    "/:documentId/job-data",
    requireDocumentAccess("read"),
    (req: Request, res: Response) => {
      const query = parseQuery(req, res, jobLimitQuerySchema);
      if (!query) return;
      try {
        const points = getJobData(req.params.documentId!, query.limit);
        res.json({ data: { points } });
      } catch (err) {
        respondError(res, err, "documents-route.job-data.get");
      }
    },
  );

  router.delete(
    "/:documentId/job-data",
    requireDocumentAccess("edit"),
    (req: Request, res: Response) => {
      const body = parseBody(req, res, jobDataDeleteBodySchema);
      if (!body) return;
      try {
        const data = deleteJobData({
          documentId: req.params.documentId!,
          ids: body.ids,
          all: body.all === true,
        });
        res.json({ data });
      } catch (err) {
        respondError(res, err, "documents-route.job-data.delete");
      }
    },
  );

  router.post(
    "/:documentId/job-run",
    requireDocumentAccess("edit"),
    (req: Request, res: Response) => {
      try {
        const data = manualRunJob(req.params.documentId!);
        res.status(202).json({ data });
      } catch (err) {
        respondError(res, err, "documents-route.job-run.post");
      }
    },
  );

  router.post(
    "/:documentId/job-runs/:runId/cancel",
    requireDocumentAccess("edit"),
    (req: Request, res: Response) => {
      const runId = Number(req.params.runId);
      if (!Number.isFinite(runId)) {
        res.status(400).json({
          error: { code: "BAD_REQUEST", message: "invalid runId" },
        });
        return;
      }
      try {
        const data = cancelJobRunForDocument({
          documentId: req.params.documentId!,
          jobRunningId: runId,
        });
        res.json({ data });
      } catch (err) {
        respondError(res, err, "documents-route.job-run.cancel");
      }
    },
  );

  router.get(
    "/:documentId",
    requireDocumentAccess("read"),
    (req: Request, res: Response) => {
      const query = parseQuery(req, res, getDocumentQuerySchema);
      if (!query) return;
      const visitorId = req.visitor?.visitor_id ?? null;
      try {
        const doc = getDocument(req.params.documentId!, visitorId, query.format);
        res.json({ data: doc });
      } catch (err) {
        respondError(res, err, "documents-route.get");
      }
    },
  );

  router.post("/:documentId/move", (req: Request, res: Response) => {
    const visitor = requireVisitor(req, res);
    if (!visitor) return;
    const body = parseBody(req, res, moveDocumentBodySchema);
    if (!body) return;
    try {
      const doc = moveDocument({
        actorVisitorId: visitor.visitor_id,
        documentId: req.params.documentId!,
        parentId: body.parentId,
      });
      res.json({ data: doc });
    } catch (err) {
      respondError(res, err, "documents-route.move");
    }
  });

  router.put(
    "/:documentId",
    requireDocumentAccess("edit"),
    (req: Request, res: Response) => {
      const visitor = requireVisitor(req, res);
      if (!visitor) return;
      const body = parseBody(req, res, updateDocumentBodySchema);
      if (!body) return;
      try {
        const doc = updateDocument({
          actorVisitorId: visitor.visitor_id,
          documentId: req.params.documentId!,
          content: body.content,
          displayName: body.displayName,
          permission: body.permission,
          contentFormat: body.contentFormat,
          version: body.version,
          message: body.message,
          source: body.source,
        });
        if (body.version?.merge) {
          res.status(204).end();
          return;
        }
        res.json({ data: doc });
      } catch (err) {
        respondError(res, err, "documents-route.update");
      }
    },
  );

  router.post(
    "/:documentId/suggest-commit-message",
    requireDocumentAccess("edit"),
    async (req: Request, res: Response) => {
      const visitor = requireVisitor(req, res);
      if (!visitor) return;
      const body = parseBody(req, res, suggestCommitMessageBodySchema);
      if (!body) return;
      try {
        const data = await suggestCommitMessage({
          actorVisitorId: visitor.visitor_id,
          documentId: req.params.documentId!,
          content: body.content,
          contentFormat: body.contentFormat,
        });
        res.json({ data });
      } catch (err) {
        respondError(res, err, "documents-route.suggest-commit-message");
      }
    },
  );

  router.post(
    "/:documentId/suggest-document-merge",
    requireDocumentAccess("edit"),
    async (req: Request, res: Response) => {
      const visitor = requireVisitor(req, res);
      if (!visitor) return;
      const body = parseBody(req, res, suggestDocumentMergeBodySchema);
      if (!body) return;
      try {
        const data = await suggestDocumentMerge({
          actorVisitorId: visitor.visitor_id,
          documentId: req.params.documentId!,
          localContent: body.localContent,
          localBaseCommitId: body.localBaseCommitId,
          contentFormat: body.contentFormat,
        });
        res.json({ data });
      } catch (err) {
        respondError(res, err, "documents-route.suggest-document-merge");
      }
    },
  );

  router.post(
    "/:documentId/suggest-merge-resolutions",
    requireDocumentAccess("edit"),
    async (req: Request, res: Response) => {
      const visitor = requireVisitor(req, res);
      if (!visitor) return;
      const body = parseBody(req, res, suggestMergeResolutionsBodySchema);
      if (!body) return;
      try {
        const data = await suggestMergeResolutions({
          actorVisitorId: visitor.visitor_id,
          documentId: req.params.documentId!,
          conflictMarkdown: body.conflictMarkdown,
        });
        res.json({ data });
      } catch (err) {
        respondError(res, err, "documents-route.suggest-merge-resolutions");
      }
    },
  );

  router.post(
    "/:documentId/suggest-merge-message",
    requireDocumentAccess("edit"),
    async (req: Request, res: Response) => {
      const visitor = requireVisitor(req, res);
      if (!visitor) return;
      const body = parseBody(req, res, suggestMergeMessageBodySchema);
      if (!body) return;
      try {
        const data = await suggestMergeMessage({
          actorVisitorId: visitor.visitor_id,
          documentId: req.params.documentId!,
          localContent: body.localContent,
          remoteContent: body.remoteContent,
          mergedContent: body.mergedContent,
          baseContent: body.baseContent,
          contentFormat: body.contentFormat,
        });
        res.json({ data });
      } catch (err) {
        respondError(res, err, "documents-route.suggest-merge-message");
      }
    },
  );

  router.delete(
    "/:documentId",
    requireDocumentAccess("delete"),
    (req: Request, res: Response) => {
      const visitor = requireVisitor(req, res);
      if (!visitor) return;
      try {
        removeDocument({
          actorVisitorId: visitor.visitor_id,
          documentId: req.params.documentId!,
        });
        res.status(204).end();
      } catch (err) {
        respondError(res, err, "documents-route.delete");
      }
    },
  );

  router.delete("/folder/:folderDocumentId", (req: Request, res: Response) => {
    const visitor = requireVisitor(req, res);
    if (!visitor) return;
    try {
      const result = removeFolder({
        actorVisitorId: visitor.visitor_id,
        folderDocumentId: req.params.folderDocumentId!,
      });
      res.json({ data: result });
    } catch (err) {
      respondError(res, err, "documents-route.delete-folder");
    }
  });

  router.get("/folder/:folderId/children", (req: Request, res: Response) => {
    const visitorId = req.visitor?.visitor_id ?? null;
    const children = listFolderChildren(req.params.folderId!, visitorId);
    res.json({ data: children });
  });

  router.get("/folder/:folderId/tree", (req: Request, res: Response) => {
    const visitorId = req.visitor?.visitor_id ?? null;
    try {
      const tree = buildFolderSubtree(req.params.folderId!, visitorId, {
        includeTypes: treeIncludeTypes(),
      });
      res.json({ data: tree });
    } catch (err) {
      respondError(res, err, "documents-route.folder-tree");
    }
  });

  router.post("/search", async (req: Request, res: Response) => {
    const body = parseBody(req, res, searchBodySchema);
    if (!body) return;
    const visitorId = req.visitor?.visitor_id ?? null;
    const results = await searchDocuments({
      query: body.query,
      visitorId,
      domainId: body.domainId,
      topN: body.topN,
      mode: body.mode,
    });
    res.json({
      data: {
        results,
        modelReady: isEmbeddingReady(),
        tokens: tokenizeQuery(body.query),
      },
    });
  });

  router.get(
    "/:documentId/invites",
    requireDocumentOwner(),
    (req: Request, res: Response) => {
      try {
        const invites = getDocumentInvites(req.params.documentId!);
        res.json({ data: invites });
      } catch (err) {
        respondError(res, err, "documents-route.invites.get");
      }
    },
  );

  router.post(
    "/:documentId/invites",
    requireDocumentOwner(),
    (req: Request, res: Response) => {
      const visitor = requireVisitor(req, res);
      if (!visitor) return;
      const body = parseBody(req, res, addInviteBodySchema);
      if (!body) return;
      try {
        addDocumentInvite(
          visitor.visitor_id,
          req.params.documentId!,
          body.targetVisitorId,
          body.targetPermission,
        );
        res.status(204).end();
      } catch (err) {
        respondError(res, err, "documents-route.invites.add");
      }
    },
  );

  router.delete(
    "/:documentId/invites/:targetVisitorId",
    requireDocumentOwner(),
    (req: Request, res: Response) => {
      const visitor = requireVisitor(req, res);
      if (!visitor) return;
      try {
        removeDocumentInvite(
          visitor.visitor_id,
          req.params.documentId!,
          req.params.targetVisitorId!,
        );
        res.status(204).end();
      } catch (err) {
        respondError(res, err, "documents-route.invites.remove");
      }
    },
  );

  return router;
}

function respondError(res: Response, err: unknown, context: string): void {
  if (err instanceof DocumentError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }
  if (err instanceof StoragePathError) {
    res.status(400).json({
      error: { code: "INVALID_PATH", message: err.message },
    });
    return;
  }
  log.error(
    "%s failed: %s",
    context,
    err instanceof Error ? err.message : String(err),
  );
  res.status(500).json({
    error: { code: "INTERNAL", message: "internal error" },
  });
}
