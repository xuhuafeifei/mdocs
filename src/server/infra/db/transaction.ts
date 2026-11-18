/**
 * 函数式事务：业务层不碰 Database，只包一层回调。
 * 单例连接下，回调里 repo 再 getDb() 仍属同一事务。
 */
import { getDb } from "./connection.js";

export function runInTransaction<T>(fn: () => T): T {
  const db = getDb();
  return db.transaction(fn)();
}
