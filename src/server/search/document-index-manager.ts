/**
 * 文档全文检索索引管理器
 *
 * 职责：
 * - 标记 dirty：文档创建/更新时将 is_dirty=1
 * - 定时重建：扫描 is_dirty=1 的文档，读取 .md 文件内容，重建 FTS5 索引
 * - 外部触发：导出 rebuildAllDirty() 供路由或其他模块主动调用
 * - 乐观锁：通过 updated_at 防止 rebuild 期间并发更新导致的索引覆盖
 * - 内存锁：Set<documentId> 防止 timer 与外部触发同时重建同一文档
 */
import { getDb } from "../db/connection.js";
import { readDocument } from "../storage/file-store.js";
import { useLogger } from "../logger/logger.js";

const log = useLogger("document-index-manager");

/** 正在重建索引的文档 ID 集合，防止 concurrent rebuild */
const BUILDING = new Set<string>();

/** 定时器间隔毫秒，可通过环境变量 MDOCS_INDEX_INTERVAL_MS 配置，默认 60000ms */
const INDEX_INTERVAL_MS = Number(process.env.MDOCS_INDEX_INTERVAL_MS) || 60000;

/** 是否已启动定时器 */
let started = false;

/**
 * 启动定时索引重建。
 * 重复调用安全，仅启动一次。
 */
export function startIndexTimer(): void {
  if (started) return;
  started = true;

  // 首次启动时立即执行一次全量扫描
  rebuildAllDirty()
    .then((n) => {
      if (n > 0) log.info("initial index rebuild done, %d documents indexed", n);
    })
    .catch((err) => log.error("initial index rebuild failed: %s", err instanceof Error ? err.message : String(err)));

  // 定时扫描
  setInterval(() => {
    rebuildAllDirty()
      .then((n) => {
        if (n > 0) log.debug("periodic index rebuild done, %d documents indexed", n);
      })
      .catch((err) => log.error("periodic index rebuild failed: %s", err instanceof Error ? err.message : String(err)));
  }, INDEX_INTERVAL_MS);

  log.info("index timer started, interval=%dms", INDEX_INTERVAL_MS);
}

/**
 * 标记文档需要重建索引。
 * 文档创建/更新时调用。
 */
export function markDirty(documentId: string): void {
  getDb()
    .prepare(`UPDATE documents SET is_dirty = 1 WHERE document_id = ?`)
    .run(documentId);
}

/**
 * 从全文索引中移除文档。
 * 文档删除时调用。
 */
export function removeIndex(documentId: string): void {
  const db = getDb();
  // 查 FTS rowid 映射
  const mapRow = db
    .prepare(`SELECT fts_rowid FROM documents_fts_rowid WHERE document_id = ?`)
    .get(documentId) as { fts_rowid: number } | undefined;
  if (mapRow) {
    // FTS5 删除语法：INSERT INTO table(table, rowid) VALUES('delete', ?)
    db.prepare(`INSERT INTO documents_fts(documents_fts, rowid) VALUES('delete', ?)`).run(mapRow.fts_rowid);
    db.prepare(`DELETE FROM documents_fts_rowid WHERE document_id = ?`).run(documentId);
  }
}

/**
 * 扫描所有 is_dirty=1 的文档并重建索引。
 *
 * @returns 本次成功重建的文档数量
 */
export async function rebuildAllDirty(): Promise<number> {
  const db = getDb();
  const dirtyIds = db
    .prepare(`SELECT document_id FROM documents WHERE is_dirty = 1`)
    .all() as { document_id: string }[];

  let count = 0;
  for (const { document_id } of dirtyIds) {
    // 跳过正在被其他流程重建的文档
    if (BUILDING.has(document_id)) continue;
    try {
      rebuildDocument(document_id);
      count += 1;
    } catch (err) {
      log.warn("rebuild failed for %s: %s", document_id, err instanceof Error ? err.message : String(err));
    }
  }
  return count;
}

/**
 * 重建单篇文档的全文索引。
 *
 * 乐观锁流程：
 * 1. 记录当前 updated_at（版本号）
 * 2. 读取磁盘文件内容
 * 3. 删除旧 FTS 条目 → 插入新 FTS 条目
 * 4. 用 updated_at 条件清除 is_dirty，若不匹配说明索引期间文档被更新，保留 dirty
 */
function rebuildDocument(documentId: string): void {
  const db = getDb();

  // ---- 获取文档元数据 ----
  const doc = db
    .prepare(
      `SELECT domain_id, relative_path, display_name, owner_visitor_id, permission, updated_at
       FROM documents WHERE document_id = ?`,
    )
    .get(documentId) as {
    domain_id: string;
    relative_path: string;
    display_name: string;
    owner_visitor_id: string;
    permission: number;
    updated_at: string;
  } | undefined;
  if (!doc) return;

  // 记录本次索引的版本
  const version = doc.updated_at;

  // ---- 读取磁盘文件内容 ----
  const { content } = readDocument(doc.domain_id, doc.relative_path);

  // ---- 重建 FTS 条目 ----
  // 1. 删除旧条目（含映射表记录）
  const oldMap = db
    .prepare(`SELECT fts_rowid FROM documents_fts_rowid WHERE document_id = ?`)
    .get(documentId) as { fts_rowid: number } | undefined;
  if (oldMap) {
    db.prepare(`INSERT INTO documents_fts(documents_fts, rowid) VALUES('delete', ?)`).run(oldMap.fts_rowid);
    db.prepare(`DELETE FROM documents_fts_rowid WHERE document_id = ?`).run(documentId);
  }

  // 2. 插入新条目
  const result = db
    .prepare(
      `INSERT INTO documents_fts(content, document_id, display_name, relative_path, domain_id, owner_visitor_id, permission)
       VALUES(?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      content,
      documentId,
      doc.display_name,
      doc.relative_path,
      doc.domain_id,
      doc.owner_visitor_id,
      doc.permission,
    );
  // 记录 rowid 映射，用于后续删除/更新
  db.prepare(
    `INSERT INTO documents_fts_rowid(document_id, fts_rowid) VALUES(?, ?)`,
  ).run(documentId, result.lastInsertRowid);

  // ---- 乐观锁：确认文档未在索引期间被更新 ----
  const changed = db
    .prepare(
      `UPDATE documents SET is_dirty = 0 WHERE document_id = ? AND updated_at = ?`,
    )
    .run(documentId, version);

  // 如果没有行被修改，说明此文档在索引期间被并发更新了，保留 is_dirty 由下个周期重建
  if (changed.changes === 0) {
    log.debug("index rebuild skipped for %s: document was concurrently updated", documentId);
  }
}
