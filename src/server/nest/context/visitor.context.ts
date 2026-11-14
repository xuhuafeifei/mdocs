import { AsyncLocalStorage } from "node:async_hooks";
import type { VisitorRow } from "../../infra/db/repositories/visitor.repo.js";

type Store = {
  visitor: VisitorRow | null;
};

const als = new AsyncLocalStorage<Store>();

/**
 * 请求级访客上下文（ALS）。
 * 由 attach middleware 写入；decorators / guards 读取。
 * modules/application 禁止 import（业务显式传 visitorId）。
 */
export const VisitorContext = {
  run<T>(visitor: VisitorRow | null, fn: () => T): T {
    return als.run({ visitor }, fn);
  },

  visitor(): VisitorRow | null {
    return als.getStore()?.visitor ?? null;
  },

  visitorId(): string | null {
    return als.getStore()?.visitor?.visitor_id ?? null;
  },

  /** 要求已登录；未登录抛错由调用方 Guard/装饰器处理前不应调用 */
  requireVisitor(): VisitorRow {
    const v = VisitorContext.visitor();
    if (!v) {
      throw new Error("VisitorContext: no visitor in scope");
    }
    return v;
  },

  requireVisitorId(): string {
    return VisitorContext.requireVisitor().visitor_id;
  },
};
