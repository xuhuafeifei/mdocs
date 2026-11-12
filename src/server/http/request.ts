/**
 * HTTP 边界：Zod 解析 query/body + 收窄 req.visitor。
 * route 里不再手写 typeof / 401 样板。
 */
import type { Request, Response } from "express";
import { z, type ZodTypeAny } from "zod";
import type { VisitorRow } from "../db/repositories/visitor.repo.js";

export function zodBadRequestMessage(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "invalid request";
  const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
}

/**
 * 用 schema 解析 data；失败则写 400 并返回 null。
 */
export function parseWithSchema<T extends ZodTypeAny>(
  res: Response,
  schema: T,
  data: unknown,
): z.infer<T> | null {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: zodBadRequestMessage(parsed.error) },
    });
    return null;
  }
  return parsed.data;
}

export function parseBody<T extends ZodTypeAny>(
  req: Request,
  res: Response,
  schema: T,
): z.infer<T> | null {
  return parseWithSchema(res, schema, req.body ?? {});
}

export function parseQuery<T extends ZodTypeAny>(
  req: Request,
  res: Response,
  schema: T,
): z.infer<T> | null {
  return parseWithSchema(res, schema, req.query ?? {});
}

/** 已通过 authMiddleware 但仍需 actor 的写接口：收窄 visitor 或 401。 */
export function requireVisitor(req: Request, res: Response): VisitorRow | null {
  if (!req.visitor) {
    res.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "no visitor" },
    });
    return null;
  }
  return req.visitor;
}

/** Express query 常为 string；缺省 / 非 string → undefined。 */
export const optionalQueryString = z.preprocess((v) => {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}, z.string().optional());

/** 必填 query string（trim 后非空）。 */
export const requiredQueryString = z.preprocess((v) => {
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v) && typeof v[0] === "string") return v[0].trim();
  return "";
}, z.string().min(1));

/** query 数字；缺省 → undefined。 */
export const optionalQueryNumber = z.preprocess((v) => {
  if (v === undefined || v === null || v === "") return undefined;
  const raw = Array.isArray(v) ? v[0] : v;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : Number.NaN;
}, z.number().finite().optional());
