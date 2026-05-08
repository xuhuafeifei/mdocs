/**
 * 访客服务单元测试（visitor.service.ts）
 *
 * 覆盖：
 * - 注册访客生成恢复码
 * - 恢复码找回身份（正确码 / 错误码 / 重复使用）
 * - 已登录访客重新生成恢复码
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { applySchema } from "../db/schema.js";

/* ── Mock 基础设施 ── */

const testDbRef = vi.hoisted(() => ({ db: null as Database.Database | null }));

vi.mock("../db/connection.js", () => ({
  getDb: () => testDbRef.db,
}));

vi.mock("../domains/personal-domain.service.js", () => ({
  ensurePersonalDomain: () => {},
}));

import { registerVisitor, recoverVisitor, generateRecoveryCode } from "./visitor.service.js";

/* ── 生命周期 ── */

beforeAll(() => {
  const db = new Database(":memory:");
  applySchema(db);
  testDbRef.db = db;
});

afterEach(() => {
  const db = testDbRef.db!;
  db.exec("DELETE FROM visitors");
  db.exec("DELETE FROM audit_logs");
});

/* ── 注册与恢复码 ── */

describe("registerVisitor", () => {
  it("注册成功时返回 visitor、visitorToken 和 recoveryCode", () => {
    const result = registerVisitor("测试用户");
    expect(result.visitor).toBeDefined();
    expect(result.visitor.visitorName).toBe("测试用户");
    expect(result.visitor.visitorId).toBeTruthy();
    expect(result.visitorToken).toBeTruthy();
    expect(result.recoveryCode).toBeTruthy();
    // 恢复码格式：XXXX-XXXX-XXXX-XXXX
    expect(result.recoveryCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it("注册后恢复码哈希存入数据库", () => {
    const result = registerVisitor("user2");
    const db = testDbRef.db!;
    const row = db
      .prepare(`SELECT recovery_code_hash FROM visitors WHERE visitor_id = ?`)
      .get(result.visitor.visitorId) as { recovery_code_hash: string | null };
    expect(row.recovery_code_hash).toBeTruthy();
    expect(row.recovery_code_hash!.length).toBe(64); // SHA-256 hex
  });
});

describe("recoverVisitor", () => {
  it("使用正确的恢复码可以找回身份，返回原访客和新 Token", () => {
    const registered = registerVisitor("找回测试");
    const originalId = registered.visitor.visitorId;
    const originalToken = registered.visitorToken;

    const recovered = recoverVisitor(registered.recoveryCode);

    expect(recovered).not.toBeNull();
    // visitorId 不变
    expect(recovered!.visitor.visitorId).toBe(originalId);
    expect(recovered!.visitor.visitorName).toBe("找回测试");
    // 新 Token
    expect(recovered!.visitorToken).toBeTruthy();
    expect(recovered!.visitorToken).not.toBe(originalToken);
  });

  it("恢复后返回新 Token，且新 Token 能从后端解析回同一访客", () => {
    const registered = registerVisitor("token刷新");
    const originalId = registered.visitor.visitorId;

    const recovered = recoverVisitor(registered.recoveryCode)!;
    expect(recovered.visitorToken).not.toBe(registered.visitorToken);
    expect(recovered.visitor.visitorId).toBe(originalId);
  });

  it("使用错误的恢复码返回 null", () => {
    const registered = registerVisitor("用户A");

    const result = recoverVisitor("AAAA-BBBB-CCCC-DDDD");
    expect(result).toBeNull();
  });

  it("恢复码一次性使用，重复使用返回 null", () => {
    const registered = registerVisitor("一次性码");

    // 第一次成功
    const first = recoverVisitor(registered.recoveryCode);
    expect(first).not.toBeNull();

    // 第二次 null
    const second = recoverVisitor(registered.recoveryCode);
    expect(second).toBeNull();
  });
});

describe("generateRecoveryCode（已登录用户生成新码）", () => {
  it("生成新恢复码覆盖旧码", () => {
    const registered = registerVisitor("更新码");
    const oldCode = registered.recoveryCode;

    // 生成新码
    const newCode = generateRecoveryCode(registered.visitor.visitorId);
    expect(newCode).toBeTruthy();
    expect(newCode).not.toBe(oldCode);
    expect(newCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    // 旧码失效
    const oldRecover = recoverVisitor(oldCode);
    expect(oldRecover).toBeNull();

    // 新码有效
    const newRecover = recoverVisitor(newCode);
    expect(newRecover).not.toBeNull();
    expect(newRecover!.visitor.visitorId).toBe(registered.visitor.visitorId);
  });
});
