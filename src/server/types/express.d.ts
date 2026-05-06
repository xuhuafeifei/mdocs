import type { VisitorRow } from "../db/repositories/visitor.repo.js";

declare global {
  namespace Express {
    // 扩展 Express 的 Request 接口，使其携带可选的访客信息
    interface Request {
      /** 当前请求关联的访客对象（由身份认证中间件注入） */
      visitor?: VisitorRow;
    }
  }
}

export {};
