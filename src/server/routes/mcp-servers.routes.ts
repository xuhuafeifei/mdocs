import { Router, type Request, type Response } from "express";
import {
  getMcpServerById,
  listMcpServers,
  replaceMcpServers,
} from "../mcp/mcp-servers-store.js";

export function buildMcpServersRouter(): ReturnType<typeof Router> {
  const router = Router();

  router.get("/", (_req: Request, res: Response) => {
    res.json({
      data: {
        servers: listMcpServers(),
      },
    });
  });

  router.put("/", (req: Request, res: Response) => {
    try {
      const body = req.body as { servers?: unknown };
      const servers = replaceMcpServers(body?.servers);
      res.json({
        data: {
          servers,
        },
      });
    } catch (err) {
      res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : String(err),
        },
      });
    }
  });

  router.post("/:id/test", async (req: Request, res: Response) => {
    const id = String(req.params.id ?? "").trim();
    const server = getMcpServerById(id);
    if (!server) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "mcp server not found" },
      });
      return;
    }
    // 懒加载：缺 @modelcontextprotocol/sdk 时不应拖垮整个 mdocs 启动
    let testMcpServer: typeof import("../mcp/mcp-client.js").testMcpServer;
    try {
      ({ testMcpServer } = await import("../mcp/mcp-client.js"));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "MCP client unavailable";
      res.status(503).json({
        error: { code: "MCP_SDK_MISSING", message },
        data: { ok: false, error: message },
      });
      return;
    }
    const result = await testMcpServer(server);
    if (!result.ok) {
      res.status(502).json({
        error: { code: "MCP_UNREACHABLE", message: result.error },
        data: { ok: false, error: result.error },
      });
      return;
    }
    res.json({ data: { ok: true, tools: result.tools } });
  });

  return router;
}
