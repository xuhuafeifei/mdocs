import type { VisitorRow } from "../db/repositories/visitor.repo.js";

declare global {
  namespace Express {
    interface Request {
      visitor?: VisitorRow;
    }
  }
}

export {};
