import { Router, type Request, type Response } from "express";
import {
  getServerSettingsPublic,
  setMaxUploadBytes,
  MIN_MAX_UPLOAD_BYTES,
  MAX_MAX_UPLOAD_BYTES,
} from "../config/server-settings.js";

export function buildServerSettingsRouter(): ReturnType<typeof Router> {
  const router = Router();

  router.get("/", (_req: Request, res: Response) => {
    res.json({ data: getServerSettingsPublic() });
  });

  router.put("/", (req: Request, res: Response) => {
    const raw = (req.body as { maxUploadBytes?: unknown })?.maxUploadBytes;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: "maxUploadBytes must be a positive number (bytes)" },
      });
      return;
    }
    if (n < MIN_MAX_UPLOAD_BYTES || n > MAX_MAX_UPLOAD_BYTES) {
      res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: `maxUploadBytes must be between ${MIN_MAX_UPLOAD_BYTES} and ${MAX_MAX_UPLOAD_BYTES}`,
        },
      });
      return;
    }
    const maxUploadBytes = setMaxUploadBytes(n);
    res.json({ data: { ...getServerSettingsPublic(), maxUploadBytes } });
  });

  return router;
}
