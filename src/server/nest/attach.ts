/**
 * Nest 为 HTTP 组合根：Express 仅作 platform adapter，不新开端口。
 * reflect-metadata 必须先于带装饰器的模块加载。
 * 访客鉴权 + ALS：AppModule → VisitorAuthMiddleware。
 */
import "reflect-metadata";
import cookieParser from "cookie-parser";
import express from "express";
import {
  BadRequestException,
  type INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { ApiExceptionFilter } from "./filters/api-exception.filter.js";
import { WrapDataInterceptor } from "./interceptors/wrap-data.interceptor.js";
import { mountApiNotFound, mountWebStatic } from "./web-static.js";

export async function createNestApp(): Promise<INestApplication> {
  const server = express();
  server.disable("x-powered-by");

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    bodyParser: false,
    logger: ["error", "warn"],
  });

  // 自定义 32MiB；关掉 Nest 默认 bodyParser 后自行挂
  app.use(express.json({ limit: "32mb" }));
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) => {
        const message =
          errors
            .flatMap((e) => Object.values(e.constraints ?? {}))
            .join("; ") || "validation failed";
        return new BadRequestException(message);
      },
    }),
  );
  app.useGlobalInterceptors(new WrapDataInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();

  // Nest 路由注册完成后再挂。提前挂会把 Nest 的接口先答成 404。
  // API 未匹配 → JSON 404；再挂静态 / SPA（避免 /* 抢答 /api）
  mountApiNotFound(server);
  mountWebStatic(server);
  return app;
}
