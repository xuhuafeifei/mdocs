import { bootstrapRuntime } from "./app.js";
import { getConfig } from "./infra/config/index.js";
import { useLogger } from "./infra/logger/logger.js";
import { createNestApp } from "./nest/attach.js";

const log = useLogger("server");

/**
 * 启动 HTTP 服务器。
 * 从配置中读取端口和主机地址，进程引导 → Nest 装配 → listen。
 * 若启动失败会将错误写入日志并退出进程。
 */
async function start(): Promise<void> {
  const cfg = getConfig();
  bootstrapRuntime();
  const app = await createNestApp();

  process.on("uncaughtException", (err) => {
    log.error("uncaughtException: %s", err instanceof Error ? err.stack ?? err.message : String(err));
  });
  process.on("unhandledRejection", (reason) => {
    log.error(
      "unhandledRejection: %s",
      reason instanceof Error ? reason.stack ?? reason.message : String(reason),
    );
  });

  // 监听服务器错误事件，发生致命错误时记录日志并退出
  const server = app.getHttpServer();
  server.on("error", (err: Error) => {
    log.error("server error: %s", err.message);
    process.exit(1);
  });

  // 启动监听，绑定到配置指定的 host 与 port
  await app.listen(cfg.port, cfg.host);
  log.info("mdocs listening on http://%s:%d", cfg.host, cfg.port);
}

start();
