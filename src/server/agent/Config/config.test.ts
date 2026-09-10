import { describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { applySchema } from "../../db/schema.js";
import {
  deleteVisitorAgentConfig,
  getVisitorAgentConfig,
  listVisitorAgentConfigs,
  setVisitorDefaultAgentConfig,
  upsertVisitorAgentConfig,
} from "./config.js";

const testDbRef: { db: Database.Database } = { db: null! };

vi.mock("../../db/connection.js", () => ({
  getDb: () => testDbRef.db,
}));

describe("agent model configs", () => {
  function seedVisitor(db: Database.Database, id: string) {
    db.prepare(
      `INSERT INTO visitors (visitor_id, visitor_name, visitor_token_hash, created_at)
       VALUES (?, ?, ?, ?)`,
    ).run(id, "test", "hash", new Date().toISOString());
  }

  it("deepseek 保存后 baseUrl 落库且为默认", () => {
    const db = new Database(":memory:");
    applySchema(db);
    testDbRef.db = db;
    seedVisitor(db, "v1");

    upsertVisitorAgentConfig({
      ownerVisitorId: "v1",
      visitorName: "张三",
      modelId: "deepseek-flash",
      apiKey: "sk-test-key",
    });

    const cfg = getVisitorAgentConfig("v1");
    expect(cfg?.kind).toBe("deepseek");
    expect(cfg?.baseUrl).toBe("https://api.deepseek.com");
    expect(cfg?.isDefault).toBe(true);
  });

  it("custom 保存自定义字段", () => {
    const db = new Database(":memory:");
    applySchema(db);
    testDbRef.db = db;
    seedVisitor(db, "v2");

    upsertVisitorAgentConfig({
      ownerVisitorId: "v2",
      visitorName: "李四",
      kind: "custom",
      providerId: "acme-gw",
      baseUrl: "https://gw.example/v1",
      apiType: "openai-completions",
      modelId: "qwen",
      apiKey: "sk-custom",
    });

    const cfg = getVisitorAgentConfig("v2");
    expect(cfg?.kind).toBe("custom");
    expect(cfg?.providerId).toBe("acme-gw");
    expect(cfg?.modelId).toBe("qwen");
  });

  it("可保存多条配置并切换默认", () => {
    const db = new Database(":memory:");
    applySchema(db);
    testDbRef.db = db;
    seedVisitor(db, "v3");

    const ds = upsertVisitorAgentConfig({
      ownerVisitorId: "v3",
      visitorName: "王五",
      modelId: "deepseek-flash",
      apiKey: "sk-ds",
    });
    const custom = upsertVisitorAgentConfig({
      ownerVisitorId: "v3",
      visitorName: "王五",
      kind: "custom",
      baseUrl: "https://gw.example/v1",
      modelId: "qwen",
      apiKey: "sk-custom",
    });

    expect(listVisitorAgentConfigs("v3")).toHaveLength(2);
    expect(getVisitorAgentConfig("v3")?.id).toBe(ds.id);

    setVisitorDefaultAgentConfig("v3", custom.id);
    expect(getVisitorAgentConfig("v3")?.id).toBe(custom.id);
    expect(listVisitorAgentConfigs("v3").find((c) => c.id === custom.id)?.isDefault).toBe(true);
  });

  it("删除默认配置会自动提升另一条", () => {
    const db = new Database(":memory:");
    applySchema(db);
    testDbRef.db = db;
    seedVisitor(db, "v4");

    const ds = upsertVisitorAgentConfig({
      ownerVisitorId: "v4",
      visitorName: "赵六",
      modelId: "deepseek-flash",
      apiKey: "sk-ds",
    });
    upsertVisitorAgentConfig({
      ownerVisitorId: "v4",
      visitorName: "赵六",
      kind: "custom",
      baseUrl: "https://gw.example/v1",
      modelId: "qwen",
      apiKey: "sk-custom",
      isDefault: true,
    });

    deleteVisitorAgentConfig("v4", getVisitorAgentConfig("v4")!.id);
    expect(getVisitorAgentConfig("v4")?.id).toBe(ds.id);
    expect(listVisitorAgentConfigs("v4")).toHaveLength(1);
  });

  it("旧 flash 别名保存时归一为 deepseek-flash", () => {
    const db = new Database(":memory:");
    applySchema(db);
    testDbRef.db = db;
    seedVisitor(db, "v5");

    upsertVisitorAgentConfig({
      ownerVisitorId: "v5",
      visitorName: "钱七",
      modelId: "deepseek-v4-flash",
      apiKey: "sk-legacy",
    });
    expect(getVisitorAgentConfig("v5")?.modelId).toBe("deepseek-flash");

    upsertVisitorAgentConfig({
      ownerVisitorId: "v5",
      visitorName: "钱七",
      modelId: "deepseek-v4.1-flash",
      apiKey: "sk-legacy",
    });
    expect(getVisitorAgentConfig("v5")?.modelId).toBe("deepseek-flash");
  });

  it("启动迁移会删除 agent_model_configs.display_name 列", () => {
    const db = new Database(":memory:");
    applySchema(db);
    db.exec(`ALTER TABLE agent_model_configs ADD COLUMN display_name TEXT`);
    applySchema(db);

    const cols = db.prepare(`PRAGMA table_info(agent_model_configs)`).all() as { name: string }[];
    expect(cols.map((c) => c.name)).not.toContain("display_name");
    expect(cols.map((c) => c.name)).toContain("is_default");
  });
});
