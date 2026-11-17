import { Controller, Get } from "@nestjs/common";

/**
 * 健康检查端点，无需认证。
 * VisitorAuthMiddleware 白名单含 /health。
 */
@Controller("api/health")
export class HealthController {
  @Get()
  check() {
    return { status: "ok" };
  }
}
