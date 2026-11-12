import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  parseWithSchema,
  requireVisitor,
  requiredQueryString,
  zodBadRequestMessage,
} from "./request.js";
import { mergeContextQuerySchema } from "../../routes/documents.schemas.js";

function mockRes() {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("parseWithSchema", () => {
  it("returns data on success", () => {
    const res = mockRes();
    const data = parseWithSchema(
      res as any,
      z.object({ content: z.string() }),
      { content: "hi" },
    );
    expect(data).toEqual({ content: "hi" });
    expect(res.statusCode).toBe(200);
  });

  it("writes 400 on failure", () => {
    const res = mockRes();
    const data = parseWithSchema(
      res as any,
      z.object({ content: z.string() }),
      {},
    );
    expect(data).toBeNull();
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      error: { code: "BAD_REQUEST" },
    });
  });
});

describe("mergeContextQuerySchema", () => {
  it("requires trimmed commit ids", () => {
    const res = mockRes();
    const data = parseWithSchema(res as any, mergeContextQuerySchema, {
      localBaseCommitId: "  a  ",
      remoteCommitId: "b",
    });
    expect(data).toEqual({
      localBaseCommitId: "a",
      remoteCommitId: "b",
    });
  });

  it("rejects missing remoteCommitId", () => {
    const res = mockRes();
    const data = parseWithSchema(res as any, mergeContextQuerySchema, {
      localBaseCommitId: "a",
    });
    expect(data).toBeNull();
    expect(res.statusCode).toBe(400);
  });
});

describe("requireVisitor", () => {
  it("401 when missing", () => {
    const res = mockRes();
    const visitor = requireVisitor({} as any, res as any);
    expect(visitor).toBeNull();
    expect(res.statusCode).toBe(401);
  });

  it("returns visitor when present", () => {
    const res = mockRes();
    const row = { visitor_id: "v1" };
    const visitor = requireVisitor({ visitor: row } as any, res as any);
    expect(visitor).toBe(row);
  });
});

describe("requiredQueryString", () => {
  it("trims string", () => {
    expect(requiredQueryString.parse("  x ")).toBe("x");
  });
});

describe("zodBadRequestMessage", () => {
  it("includes path", () => {
    const err = z.object({ a: z.string() }).safeParse({});
    expect(err.success).toBe(false);
    if (err.success) return;
    expect(zodBadRequestMessage(err.error)).toContain("a:");
  });
});
