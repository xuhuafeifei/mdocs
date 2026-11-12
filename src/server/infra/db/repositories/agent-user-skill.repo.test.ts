import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import {
  insertAgentUserSkill,
  updateAgentUserSkill,
  type AgentUserSkillRow,
} from "./agent-user-skill.repo.js";

describe("updateAgentUserSkill", () => {
  it("rejects a stale expectedUpdatedAt", () => {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE agent_user_skills (
        id TEXT PRIMARY KEY,
        owner_visitor_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        body TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(owner_visitor_id, name)
      )
    `);
    const original: AgentUserSkillRow = {
      id: "skill-1",
      owner_visitor_id: "visitor-1",
      name: "weekly",
      description: "",
      body: "v1",
      updated_at: "2026-10-13T00:00:00.000Z",
    };
    insertAgentUserSkill(db, original);

    expect(
      updateAgentUserSkill(
        db,
        { ...original, body: "v2", updated_at: "2026-10-13T00:00:01.000Z" },
        original.updated_at,
      ),
    ).toBe(true);
    expect(
      updateAgentUserSkill(
        db,
        { ...original, body: "stale", updated_at: "2026-10-13T00:00:02.000Z" },
        original.updated_at,
      ),
    ).toBe(false);
  });
});
