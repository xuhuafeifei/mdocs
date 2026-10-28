import { Router, type Request, type Response } from "express";
import {
  getMcpServerById,
  listMcpServers,
  replaceMcpServers,
} from "../mcp/mcp-servers-store.js";
import { testMcpServer } from "../mcp/mcp-client.js";

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
