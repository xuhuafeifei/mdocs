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

function tenantDir(visitorId: string): string {
  const root = path.join(getConfig().dataDir, "tenant", visitorId);
  cleanupDirs.push(root);
  return root;
}

describe("AgentSessionManager domain / rename / pin", () => {
  it("createSession stores domainId; list puts pinned first", async () => {
    const visitorId = randomUUID();
    tenantDir(visitorId);
    const mgr = new AgentSessionManager(visitorId, { kind: "normal" });

    const a = await mgr.createSession({ domainId: "dom-a" });
    const b = await mgr.createSession({ domainId: "dom-b" });
    await mgr.renameSession(a.sessionId, "Alpha");
    await mgr.setSessionPinned(a.sessionId, true);

    const listed = await mgr.listSessions();
    expect(listed.sessions[0]?.id).toBe(a.sessionId);
    expect(listed.sessions[0]?.pinned).toBe(true);
    expect(listed.sessions[0]?.title).toBe("Alpha");
    expect(listed.sessions[0]?.domainId).toBe("dom-a");
    expect(listed.sessions.find((s) => s.id === b.sessionId)?.domainId).toBe("dom-b");
  });

  it("rename does not change updatedAt; pin does not either", async () => {
    const visitorId = randomUUID();
    tenantDir(visitorId);
    const mgr = new AgentSessionManager(visitorId, { kind: "normal" });
    const { sessionId } = await mgr.createSession({ domainId: "d1" });
    await mgr.appendUser(sessionId, "hello world");

    const before = (await mgr.listSessions()).sessions.find((s) => s.id === sessionId)!;
    await new Promise((r) => setTimeout(r, 20));
    await mgr.renameSession(sessionId, "Manual title");
    await mgr.setSessionPinned(sessionId, true);
    const after = (await mgr.listSessions()).sessions.find((s) => s.id === sessionId)!;

    expect(after.title).toBe("Manual title");
    expect(after.pinned).toBe(true);
    expect(after.updatedAt).toBe(before.updatedAt);
  });

  it("manual title is not overwritten by later appendUser auto-title", async () => {
    const visitorId = randomUUID();
    tenantDir(visitorId);
    const mgr = new AgentSessionManager(visitorId, { kind: "normal" });
    const { sessionId } = await mgr.createSession();
    await mgr.renameSession(sessionId, "Kept name");
    await mgr.appendUser(sessionId, "this should not become title");
    const listed = await mgr.listSessions();
    expect(listed.sessions.find((s) => s.id === sessionId)?.title).toBe("Kept name");
  });

  it("listSessions backfills missing domainId to default", async () => {
    const visitorId = randomUUID();
    const root = tenantDir(visitorId);
    const mgr = new AgentSessionManager(visitorId, { kind: "normal" });
    const { sessionId } = await mgr.createSession({ domainId: "default" });

    const metaPath = path.join(root, "agent", "session", "session.json");
    const raw = JSON.parse(fs.readFileSync(metaPath, "utf8")) as {
      sessions: Array<{ id: string; domainId?: string | null }>;
    };
    const entry = raw.sessions.find((s) => s.id === sessionId)!;
    delete entry.domainId;
    fs.writeFileSync(metaPath, JSON.stringify(raw));

    const listed = await mgr.listSessions();
    expect(listed.sessions.find((s) => s.id === sessionId)?.domainId).toBe("default");
    const after = JSON.parse(fs.readFileSync(metaPath, "utf8")) as {
      sessions: Array<{ id: string; domainId?: string }>;
    };
    expect(after.sessions.find((s) => s.id === sessionId)?.domainId).toBe("default");
  });
});
