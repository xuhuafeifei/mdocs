import { buildApp } from "./app.js";
import { getConfig } from "./config/index.js";
import { useLogger } from "./logger/logger.js";

const log = useLogger("server");

function start(): void {
  const cfg = getConfig();
  const app = buildApp();
  const server = app.listen(cfg.port, cfg.host, () => {
    log.info("mdocs listening on http://%s:%d", cfg.host, cfg.port);
  });
  server.on("error", (err) => {
    log.error("server error: %s", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}

start();
