import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { getDb } from "../db/connection.js";
import {
  findDomainById,
  listDomains,
  insertDomain,
  updateDomainName,
  updateDomainPermission,
  deleteDomainRow,
  addDomainMember,
  listDomainMemberIds,
  replaceDomainMembers,
} from "../db/repositories/domain.repo.js";
import {
  countDocumentsByDomain,
  listDomainIdsWithDocumentInviteForVisitor,
} from "../db/repositories/document.repo.js";
import { findVisitorById } from "../db/repositories/visitor.repo.js";
import { resolveDomainAccess } from "../access/domain-access.js";

/**
 * 规范化请求体中的访客ID数组。
 * 去重、去空字符串，并校验元素类型。
 * @param body - 请求体
 * @returns 规范化后的访客ID数组；格式不合法时返回 null
 */
function normaliseVisitorIdsBody(body: unknown): string[] | null {
  if (!body || typeof body !== "object") return null;
  const v = (body as { visitorIds?: unknown }).visitorIds;
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    if (typeof item !== "string") return null;
    const id = item.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * 构建域（Domain）相关路由。
 * 包含域的列表查询、创建、成员管理、重命名、权限修改及删除等接口。
 * @returns Express Router 实例
 */
export function buildDomainsRouter(): Router {
  const router = Router();

  /**
   * GET /
   * 列出当前访客可见的所有域。
   */
  // list visible domains
  router.get("/", (req: Request, res: Response) => {
    const visitorId = req.visitor?.visitor_id ?? null;
    const db = getDb();
    const rows = listDomains(db);
    // 收集当前访客被邀请的域ID集合，用于后续权限判断
    const documentInviteDomainIds =
      visitorId ? new Set(listDomainIdsWithDocumentInviteForVisitor(db, visitorId)) : undefined;
    // 过滤掉访客完全无权访问的域
    const filtered = rows.filter(
      (r) =>
        resolveDomainAccess(db, r, r.domain_id, visitorId, { documentInviteDomainIds }).kind !== "none",
    );
    res.json({
      data: filtered.map((r) => ({
        domainId: r.domain_id,
        domainName: r.domain_name,
        permission: r.permission,
        creatorVisitorId: r.creator_visitor_id,
        docCount: countDocumentsByDomain(db, r.domain_id),
      })),
    });
  });

  /**
   * POST /
   * 创建新域。仅已登录访客可操作。
   * restricted 权限的域会自动将创建者加入成员列表。
   */
  // create domain
  router.post("/", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const body = (req.body ?? {}) as { domainName?: unknown; permission?: unknown };
    // 校验域名称
    if (typeof body.domainName !== "string" || !body.domainName.trim()) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "domainName is required" } });
      return;
    }
    // 校验并默认权限为 restricted
    const permission = typeof body.permission === "string" ? body.permission : "restricted";
    if (!["public", "restricted", "private"].includes(permission)) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "invalid permission" } });
      return;
    }
    const now = new Date().toISOString();
    const domainId = randomUUID();
    const db = getDb();

    // 检查域名是否已存在
    const existing = db.prepare(`SELECT domain_id FROM domains WHERE domain_name = ?`).get(body.domainName.trim());
    if (existing) {
      res.status(409).json({ error: { code: "DOMAIN_NAME_EXISTS", message: "domain name already exists" } });
      return;
    }

    insertDomain(db, {
      domainId,
      domainName: body.domainName.trim(),
      creatorVisitorId: req.visitor.visitor_id,
      createdAt: now,
      updatedAt: now,
      permission,
    });
    // restricted 域需将创建者自动设为成员，确保其能继续管理该域
    if (permission === "restricted") {
      addDomainMember(db, domainId, req.visitor.visitor_id);
    }
    res.status(201).json({
      data: {
        domainId,
        domainName: body.domainName.trim(),
        permission,
        creatorVisitorId: req.visitor.visitor_id,
        docCount: 0,
      },
    });
  });

  /**
   * GET /:id/members
   * 获取 restricted 域的成员列表。仅域创建者可查看。
   */
  router.get("/:id/members", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const domainId = req.params.id!;
    const db = getDb();
    const domain = findDomainById(db, domainId);
    if (!domain) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "domain not found" } });
      return;
    }
    // 只有域创建者才有权查看成员列表
    if (domain.creator_visitor_id !== req.visitor.visitor_id) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "only the creator can view domain members" } });
      return;
    }
    if (domain.permission !== "restricted") {
      res.status(400).json({
        error: { code: "DOMAIN_NOT_RESTRICTED", message: "member list applies to restricted domains only" },
      });
      return;
    }
    const ids = listDomainMemberIds(db, domainId);
    const members: { visitorId: string; visitorName: string; missing: boolean; disabled: boolean }[] = [];
    for (const id of ids) {
      const v = findVisitorById(db, id);
      if (!v) {
        /* 1) visitors 表中已无此行（物理删除）→ missing，右栏显示「库中无记录」 */
        members.push({ visitorId: id, visitorName: "", missing: true, disabled: false });
      } else {
        members.push({
          visitorId: id,
          visitorName: v.visitor_name,
          missing: false,
          /* 2) disabled_at 非空 → 已停用（被 migrate 合并到了其他访客）*/
          disabled: v.disabled_at != null,
        });
      }
    }
    res.json({ data: { members } });
  });

  /**
   * PUT /:id/members
   * 批量替换 restricted 域的成员列表。仅域创建者可操作，创建者始终保留在成员中。
   */
  router.put("/:id/members", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const domainId = req.params.id!;
    const ids = normaliseVisitorIdsBody(req.body);
    if (ids === null) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "visitorIds must be an array of strings" } });
      return;
    }
    const db = getDb();
    const domain = findDomainById(db, domainId);
    if (!domain) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "domain not found" } });
      return;
    }
    if (domain.creator_visitor_id !== req.visitor.visitor_id) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "only the creator can modify domain members" } });
      return;
    }
    if (domain.permission !== "restricted") {
      res.status(400).json({
        error: { code: "DOMAIN_NOT_RESTRICTED", message: "member list applies to restricted domains only" },
      });
      return;
    }
    /* 无论模板/前端传了哪些成员，域创建者必须保留在成员列表中 */
    const mergedSet = new Set(ids);
    mergedSet.add(domain.creator_visitor_id);
    const merged = [...mergedSet];
    // 校验所有待添加的访客ID是否真实存在
    const invalid: string[] = [];
    for (const vid of merged) {
      const v = findVisitorById(db, vid);
      if (!v) {
        invalid.push(vid);
      }
    }
    if (invalid.length > 0) {
      res.status(400).json({
        error: {
          code: "UNKNOWN_VISITOR_IDS",
          message: "one or more visitor ids do not exist",
          details: { invalidVisitorIds: invalid },
        },
      });
      return;
    }
    const joinedAt = new Date().toISOString();
    replaceDomainMembers(db, domainId, merged, joinedAt);
    res.json({ data: { memberCount: merged.length } });
  });

  /**
   * PUT /:id
   * 重命名域。仅域创建者可操作，且域内不能有文档。
   */
  // rename domain
  router.put("/:id", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const domainId = req.params.id!;
    const body = (req.body ?? {}) as { domainName?: unknown };
    if (typeof body.domainName !== "string" || !body.domainName.trim()) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "domainName is required" } });
      return;
    }
    const db = getDb();
    const domain = findDomainById(db, domainId);
    if (!domain) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "domain not found" } });
      return;
    }
    if (domain.creator_visitor_id !== req.visitor.visitor_id) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "only the creator can modify this domain" } });
      return;
    }
    // 已有文档的域不允许重命名，防止路径引用混乱
    const docCount = countDocumentsByDomain(db, domainId);
    if (docCount > 0) {
      res.status(400).json({ error: { code: "DOMAIN_HAS_DOCUMENTS", message: "cannot modify domain with documents" } });
      return;
    }
    // 检查新名称是否与其他域冲突
    const existing = db.prepare(`SELECT domain_id FROM domains WHERE domain_name = ? AND domain_id != ?`).get(body.domainName.trim(), domainId);
    if (existing) {
      res.status(409).json({ error: { code: "DOMAIN_NAME_EXISTS", message: "domain name already exists" } });
      return;
    }
    updateDomainName(db, domainId, body.domainName.trim());
    res.json({ data: { domainId, domainName: body.domainName.trim() } });
  });

  /**
   * PUT /:id/permission
   * 修改域的访问权限。仅域创建者可操作，且域内不能有文档。
   */
  // change domain permission
  router.put("/:id/permission", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const domainId = req.params.id!;
    const body = (req.body ?? {}) as { permission?: unknown };
    if (typeof body.permission !== "string" || !["public", "restricted", "private"].includes(body.permission)) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "invalid permission" } });
      return;
    }
    const db = getDb();
    const domain = findDomainById(db, domainId);
    if (!domain) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "domain not found" } });
      return;
    }
    if (domain.creator_visitor_id !== req.visitor.visitor_id) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "only the creator can modify this domain" } });
      return;
    }
    // 已有文档的域不允许修改权限
    const docCount = countDocumentsByDomain(db, domainId);
    if (docCount > 0) {
      res.status(400).json({ error: { code: "DOMAIN_HAS_DOCUMENTS", message: "cannot modify domain with documents" } });
      return;
    }
    updateDomainPermission(db, domainId, body.permission);
    res.json({ data: { domainId, permission: body.permission } });
  });

  /**
   * DELETE /:id
   * 删除域。仅域创建者可操作，且域内不能有文档。
   */
  // delete domain
  router.delete("/:id", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const domainId = req.params.id!;
    const db = getDb();
    const domain = findDomainById(db, domainId);
    if (!domain) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "domain not found" } });
      return;
    }
    if (domain.creator_visitor_id !== req.visitor.visitor_id) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "only the creator can delete this domain" } });
      return;
    }
    // 已有文档的域不允许删除
    const docCount = countDocumentsByDomain(db, domainId);
    if (docCount > 0) {
      res.status(400).json({ error: { code: "DOMAIN_HAS_DOCUMENTS", message: "cannot delete domain with documents" } });
      return;
    }
    deleteDomainRow(db, domainId);
    res.status(204).end();
  });

  return router;
}
