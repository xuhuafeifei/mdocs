import { Router, type Request, type Response } from "express";
import { getDb } from "../db/connection.js";
import {
  deleteDomainMemberTemplate,
  findDomainMemberTemplateById,
  insertDomainMemberTemplate,
  listDomainMemberTemplates,
  normaliseVisitorIdsToCsv,
  updateDomainMemberTemplate,
  visitorIdsFromStoredCsv,
  type DomainMemberTemplateRow,
} from "../db/repositories/domain-member-template.repo.js";

/**
 * 将数据库模板记录转换为对外展示的 DTO。
 * @param row - 数据库中的模板行记录
 * @returns 前端可用的模板对象
 */
function rowToDto(row: DomainMemberTemplateRow) {
  return {
    id: row.id,
    displayName: row.display_name,
    visitorIds: visitorIdsFromStoredCsv(row.domain_visitor_ids),
    createTime: row.create_time,
    updateTime: row.update_time,
  };
}

/**
 * 从请求体中解析访客ID数组。
 * 未提供时返回空数组；格式错误返回 null。
 * @param body - 请求体
 * @returns 访客ID数组，或 null 表示格式不合法
 */
function parseVisitorIdsBody(body: unknown): string[] | null {
  if (!body || typeof body !== "object") return null;
  const v = (body as { visitorIds?: unknown }).visitorIds;
  if (v === undefined) return [];
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") return null;
    out.push(item);
  }
  return out;
}

/**
 * 构建域成员模板相关路由。
 * 包含模板的列表查询、创建、更新、删除等接口。
 * @returns Express Router 实例
 */
export function buildDomainMemberTemplatesRouter(): Router {
  const router = Router();

  /**
   * GET /
   * 获取当前访客创建的所有域成员模板。
   */
  router.get("/", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const db = getDb();
    // 按创建者ID过滤模板列表
    const rows = listDomainMemberTemplates(db, req.visitor.visitor_id);
    res.json({ data: rows.map(rowToDto) });
  });

  /**
   * POST /
   * 创建新的域成员模板。
   */
  router.post("/", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const body = (req.body ?? {}) as { displayName?: unknown };
    // 校验模板展示名
    if (typeof body.displayName !== "string" || !body.displayName.trim()) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "displayName is required" } });
      return;
    }
    const visitorIds = parseVisitorIdsBody(req.body);
    if (visitorIds === null) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "visitorIds must be an array of strings" } });
      return;
    }
    const now = new Date().toISOString();
    const db = getDb();
    // 插入新模板记录
    const id = insertDomainMemberTemplate(db, {
      displayName: body.displayName.trim(),
      domainVisitorIdsCsv: normaliseVisitorIdsToCsv(visitorIds),
      createVisitorId: req.visitor.visitor_id,
      createTime: now,
      updateTime: now,
    });
    // 重新读取刚创建的记录并返回
    const row = findDomainMemberTemplateById(db, id, req.visitor.visitor_id);
    if (!row) {
      res.status(500).json({ error: { code: "INTERNAL", message: "failed to load created template" } });
      return;
    }
    res.status(201).json({ data: rowToDto(row) });
  });

  /**
   * PUT /:id
   * 更新指定域成员模板。
   */
  router.put("/:id", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const id = Number(req.params.id);
    // 校验ID为正整数
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "invalid id" } });
      return;
    }
    const body = (req.body ?? {}) as { displayName?: unknown };
    if (typeof body.displayName !== "string" || !body.displayName.trim()) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "displayName is required" } });
      return;
    }
    const visitorIds = parseVisitorIdsBody(req.body);
    if (visitorIds === null) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "visitorIds must be an array of strings" } });
      return;
    }
    const db = getDb();
    // 执行更新，并校验是否命中记录（同时校验归属权）
    const updated = updateDomainMemberTemplate(db, id, req.visitor.visitor_id, {
      displayName: body.displayName.trim(),
      domainVisitorIdsCsv: normaliseVisitorIdsToCsv(visitorIds),
      updateTime: new Date().toISOString(),
    });
    if (!updated) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "template not found" } });
      return;
    }
    const row = findDomainMemberTemplateById(db, id, req.visitor.visitor_id)!;
    res.json({ data: rowToDto(row) });
  });

  /**
   * DELETE /:id
   * 删除指定域成员模板。
   */
  router.delete("/:id", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "invalid id" } });
      return;
    }
    const db = getDb();
    // 执行删除，并校验是否命中记录（同时校验归属权）
    const deleted = deleteDomainMemberTemplate(db, id, req.visitor.visitor_id);
    if (!deleted) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "template not found" } });
      return;
    }
    res.status(204).end();
  });

  return router;
}
