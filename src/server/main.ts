import { buildApp } from "./app.js";
import { getConfig } from "./config/index.js";
import { useLogger } from "./logger/logger.js";

const log = useLogger("server");

/**
 * 启动 HTTP 服务器。
 * 从配置中读取端口和主机地址，构建 Express 应用并监听请求。
 * 若启动失败会将错误写入日志并退出进程。
 */
function start(): void {
  const cfg = getConfig();
  const app = buildApp();

  // 启动监听，绑定到配置指定的 host 与 port
  const server = app.listen(cfg.port, cfg.host, () => {
    log.info("mdocs listening on http://%s:%d", cfg.host, cfg.port);
  });

  // 监听服务器错误事件，发生致命错误时记录日志并退出
  server.on("error", (err) => {
    log.error("server error: %s", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}

start();
