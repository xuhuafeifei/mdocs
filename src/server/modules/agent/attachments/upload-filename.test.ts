import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agentAttachmentUpload } from "./upload.js";

describe("agentAttachmentUpload filename", () => {
  const app = express();
  app.post("/up", agentAttachmentUpload.single("file"), (req, res) => {
    res.json({ name: req.file?.originalname ?? null });
  });
  const server = http.createServer(app);
  let base = "";

  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address() as AddressInfo;
    base = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("keeps a Chinese filename instead of latin1 mojibake", async () => {
    const boundary = "----mdocsTest";
    const filename = "截图.png";
    const body = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: image/png\r\n\r\n` +
        `PNG\r\n` +
        `--${boundary}--\r\n`,
      "utf8",
    );
    const res = await fetch(`${base}/up`, {
      method: "POST",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      body,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: "截图.png" });
  });
});
