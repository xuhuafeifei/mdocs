import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { getConfig } from "../../config/index.js";
import { AgentSessionManager } from "./session-manager.js";

const cleanupDirs: string[] = [];

afterEach(() => {
  for (const d of cleanupDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

describe("repairMetaFromDisk", () => {
  it("restores orphan jsonl into session.json", async () => {
    const visitorId = randomUUID();
    const mgr = new AgentSessionManager(visitorId, { kind: "normal" });
    const dir = path.join(getConfig().dataDir, "tenant", visitorId, "agent", "session");
    cleanupDirs.push(path.join(getConfig().dataDir, "tenant", visitorId));

    fs.mkdirSync(dir, { recursive: true });
    const keepId = randomUUID();
    const orphanId = randomUUID();
    fs.writeFileSync(
      path.join(dir, `${keepId}.jsonl`),
      `${JSON.stringify({ role: "user", content: "keep me" })}\n`,
    );
    fs.writeFileSync(
      path.join(dir, `${orphanId}.jsonl`),
      `${JSON.stringify({ role: "user", content: "orphan chat" })}\n`,
    );
    fs.writeFileSync(
      path.join(dir, "session.json"),
      JSON.stringify(
        {
          lastOpenedSessionId: keepId,
          sessions: [{ id: keepId, title: "keep me", updatedAt: new Date().toISOString() }],
        },
        null,
        2,
      ),
    );

    const dry = await mgr.repairMetaFromDisk({ dryRun: true });
    expect(dry.added).toBe(1);
    expect(dry.after).toBe(2);
    expect(JSON.parse(fs.readFileSync(path.join(dir, "session.json"), "utf8")).sessions).toHaveLength(
      1,
    );

    const done = await mgr.repairMetaFromDisk({ dryRun: false });
    expect(done.added).toBe(1);
    expect(done.after).toBe(2);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, "session.json"), "utf8")) as {
      sessions: Array<{ id: string; title?: string }>;
    };
    expect(meta.sessions.map((s) => s.id).sort()).toEqual([keepId, orphanId].sort());
    expect(meta.sessions.find((s) => s.id === orphanId)?.title).toContain("orphan");
  });
});
