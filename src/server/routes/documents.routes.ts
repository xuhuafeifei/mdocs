import { Router, type Request, type Response } from "express";
import { DocumentError } from "../access/access-control.js";
import {
  addDocumentInvite,
  createDocument,
  getDocument,
  getDocumentInvites,
  listDocuments,
  removeDocument,
  removeDocumentInvite,
  updateDocument,
} from "../documents/document.service.js";
import { searchDocuments } from "../search/search.service.js";
import { requireDocumentAccess } from "../middleware/document-auth.middleware.js";
import { StoragePathError } from "../storage/paths.js";
import { useLogger } from "../logger/logger.js";

const log = useLogger("documents-route");

/**
 * 构建文档相关路由。
 *
 * 包含以下接口：
 * - GET  /          列出当前访客在指定域下可见的文档列表
 * - POST /          创建新文档（需登录）
 * - GET  /:id       读取单篇文档详情（需 read 权限）
 * - PUT  /:id       更新文档（需 edit 权限）
 * - DELETE /:id     删除文档（需 delete 权限，仅限创建者）
 * - GET  /:id/invites          获取邀请列表（需 edit 权限）
 * - POST /:id/invites          添加邀请（需 edit 权限）
 * - DELETE /:id/invites/:vid   移除邀请（需 edit 权限）
 *
 * @returns Express Router 实例
 */
export function buildDocumentsRouter(): Router {
  const router = Router();

  /**
   * GET /
   * 列出当前访客在指定域下可见的文档列表。
   *
   * 查询参数：
   * - domainId?: string  要查询的域ID，不传则使用默认域
   *
   * 逻辑：从请求中取出 domainId 和当前访客ID，调用 listDocuments 服务函数，
   * 由服务层负责权限过滤，直接返回过滤后的列表。
   */
  router.get("/", (req: Request, res: Response) => {
    // 从 query 中读取 domainId，必须是字符串；不是字符串就当没传
    const domainId = typeof req.query.domainId === "string" ? req.query.domainId : undefined;
    // 从已鉴权的请求上下文中取访客ID；未登录则为 null
    const visitorId = req.visitor?.visitor_id ?? null;
    // 调用服务层获取可见文档列表（服务层内部做权限过滤）
    const docs = listDocuments(domainId, visitorId);
    res.json({ data: docs });
  });

  /**
   * POST /
   * 创建新文档。需已登录。
   *
   * 请求体字段：
   * - relativePath: string  必填，文档相对路径
   * - content: string       必填，文档正文
   * - displayName?: string  可选，展示名
   * - domainId?: string     可选，目标域，不传则默认域
   * - permission?: number   可选，权限档位，不传则按域类型给默认值
   */
  router.post("/", (req: Request, res: Response) => {
    // 创建文档必须先登录
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    // 从请求体中解构可能存在的字段
    const body = (req.body ?? {}) as {
      fileName?: unknown;
      displayName?: unknown;
      content?: unknown;
      domainId?: unknown;
      permission?: unknown;
      parentId?: unknown;
      contentFormat?: unknown;
    };
    // 校验必填字段：文件名和内容必须是字符串
    if (typeof body.fileName !== "string" || typeof body.content !== "string") {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "fileName and content are required" } });
      return;
    }
    try {
      // 调用服务层创建文档，把请求参数映射为服务参数
      const doc = createDocument({
        actorVisitorId: req.visitor.visitor_id,
        fileName: body.fileName,
        displayName: typeof body.displayName === "string" ? body.displayName : undefined,
        content: body.content,
        domainId: typeof body.domainId === "string" ? body.domainId : undefined,
        permission: typeof body.permission === "number" ? body.permission : undefined,
        parentId: typeof body.parentId === "string" ? body.parentId : undefined,
        contentFormat: body.contentFormat === 'markdown' ? 'markdown' : undefined,
      });
      // 201 Created 返回新建文档的完整详情
      res.status(201).json({ data: doc });
    } catch (err) {
      // 统一异常处理：DocumentError 返回对应状态码，其他记日志后返回 500
      respondError(res, err, "documents-route.create");
    }
  });

  /**
   * GET /:documentId
   * 获取单篇文档详情。需具备读取权限。
   *
   * 前置校验：requireDocumentAccess("read") 中间件会先查文档和域信息，
   * 判断当前访客是否有权读取；无权则直接返回 404/403。
   */
  router.get("/:documentId", requireDocumentAccess("read"), (req: Request, res: Response) => {
    // 中间件已通过校验，这里直接从路由参数取文档ID
    const documentId = req.params.documentId!;
    try {
      // 从数据库和磁盘读取完整文档内容
      const doc = getDocument(documentId);
      res.json({ data: doc });
    } catch (err) {
      respondError(res, err, "documents-route.get");
    }
  });

  /**
   * PUT /:documentId
   * 更新文档内容、展示名或权限。需具备编辑权限。
   *
   * 前置校验：requireDocumentAccess("edit") 中间件会先鉴权。
   * 请求体字段：
   * - content: string       必填，新正文
   * - displayName?: string  可选，新展示名
   * - permission?: number   可选，新权限档位
   */
  router.put("/:documentId", requireDocumentAccess("edit"), (req: Request, res: Response) => {
    // 中间件只校验了文档访问权，编辑操作仍需确认已登录（ req.visitor 存在）
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const body = (req.body ?? {}) as { content?: unknown; displayName?: unknown; permission?: unknown; contentFormat?: unknown };
    // 更新时 content 是必填项（即使是空字符串也要显式传）
    if (typeof body.content !== "string") {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "content is required" } });
      return;
    }
    const documentId = req.params.documentId!;
    try {
      const doc = updateDocument({
        actorVisitorId: req.visitor.visitor_id,
        documentId,
        content: body.content,
        displayName: typeof body.displayName === "string" ? body.displayName : undefined,
        permission: typeof body.permission === "number" ? body.permission : undefined,
        contentFormat: body.contentFormat === 'markdown' ? 'markdown' : undefined,
      });
      res.json({ data: doc });
    } catch (err) {
      respondError(res, err, "documents-route.update");
    }
  });

  /**
   * DELETE /:documentId
   * 删除文档。需具备删除权限（仅限创建者）。
   *
   * 前置校验：requireDocumentAccess("delete") 中间件会确保只有创建者能过。
   */
  router.delete("/:documentId", requireDocumentAccess("delete"), (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const documentId = req.params.documentId!;
    try {
      removeDocument({
        actorVisitorId: req.visitor.visitor_id,
        documentId,
      });
      // 删除成功返回 204 No Content，无响应体
      res.status(204).end();
    } catch (err) {
      respondError(res, err, "documents-route.delete");
    }
  });

  /**
   * POST /search
   * 全文检索文档。支持关键词搜索，结果按 BM25 相关性排序，
   * 自动过滤当前访客无权阅读的文档。
   *
   * 请求体字段：
   * - query: string     必填，搜索关键词
   * - domainId?: string  可选，限定搜索域
   * - topN?: number     可选，返回数量，默认 10
   */
  router.post("/search", (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { query?: unknown; domainId?: unknown; topN?: unknown };
    if (typeof body.query !== "string" || !body.query.trim()) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "query is required" } });
      return;
    }
    const visitorId = req.visitor?.visitor_id ?? null;
    const results = searchDocuments({
      query: body.query,
      visitorId,
      domainId: typeof body.domainId === "string" ? body.domainId : undefined,
      topN: typeof body.topN === "number" ? body.topN : undefined,
    });
    res.json({ data: results });
  });

  /**
   * GET /:documentId/invites
   * 获取文档的邀请列表。需具备编辑权限。
   *
   * 只有能编辑文档的访客（创建者或被邀请者等）才能查看邀请列表。
   */
  router.get("/:documentId/invites", requireDocumentAccess("edit"), (req: Request, res: Response) => {
    const documentId = req.params.documentId!;
    try {
      const invites = getDocumentInvites(documentId);
      res.json({ data: invites });
    } catch (err) {
      respondError(res, err, "documents-route.invites.get");
    }
  });

  /**
   * POST /:documentId/invites
   * 为文档添加访客邀请。需具备编辑权限。
   *
   * 请求体字段：
   * - targetVisitorId: string  必填，被邀请的访客ID
   * - targetPermission: string  必填，授予的权限（read / edit）
   *
   * 业务限制：
   * - 仅创建者可邀请。
   * - 目标访客不能已是该域成员（邀请与域成员互斥）。
   */
  router.post("/:documentId/invites", requireDocumentAccess("edit"), (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const targetVisitorId = (req.body as { targetVisitorId?: string }).targetVisitorId;
    const targetPermission = (req.body as { targetPermission?: string }).targetPermission;
    // 校验请求体里是否同时提供了目标访客ID和权限
    if (typeof targetVisitorId !== "string" || !targetPermission) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "targetVisitorId and targetPermission are required" } });
      return;
    }
    const documentId = req.params.documentId!;
    try {
      // 调用服务层插入邀请记录
      addDocumentInvite(req.visitor.visitor_id, documentId, targetVisitorId, targetPermission);
      // 成功返回 204 No Content
      res.status(204).end();
    } catch (err) {
      respondError(res, err, "documents-route.invites.add");
    }
  });

  /**
   * DELETE /:documentId/invites/:targetVisitorId
   * 移除文档对指定访客的邀请。需具备编辑权限。
   *
   * 仅创建者可移除邀请。
   */
  router.delete("/:documentId/invites/:targetVisitorId", requireDocumentAccess("edit"), (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const documentId = req.params.documentId!;
    try {
      // 从 URL 参数中读取要移除邀请的目标访客ID
      removeDocumentInvite(req.visitor.visitor_id, documentId, req.params.targetVisitorId!);
      res.status(204).end();
    } catch (err) {
      respondError(res, err, "documents-route.invites.remove");
    }
  });

  return router;
}

/**
 * 统一处理文档路由中的异常，映射为对应的 HTTP 响应。
 *
 * 异常映射规则：
 * - DocumentError → 返回其自带的 status（400/403/404/409）和错误信息
 * - StoragePathError → 返回 400，表示路径不合法
 * - 其他未知异常 → 记日志后返回 500
 *
 * @param res - Express 响应对象
 * @param err - 捕获到的异常
 * @param context - 日志上下文标识，用于定位哪个路由处理函数出错
 */
function respondError(res: Response, err: unknown, context: string): void {
  // 业务异常：带有明确 HTTP 状态码和错误码
  if (err instanceof DocumentError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  // 路径类异常：统一映射为 400 Bad Request
  if (err instanceof StoragePathError) {
    res.status(400).json({ error: { code: "INVALID_PATH", message: err.message } });
    return;
  }
  // 未识别的异常记录日志后返回 500，避免把内部错误详情暴露给客户端
  log.error("%s failed: %s", context, err instanceof Error ? err.message : String(err));
  res.status(500).json({ error: { code: "INTERNAL", message: "internal error" } });
}
