/**
 * Nest 为 HTTP 组合根：Express 仅作 platform adapter，不新开端口。
 * reflect-metadata 必须先于带装饰器的模块加载。
 * 访客鉴权 + ALS：AppModule → VisitorAuthMiddleware。
 */
import "reflect-metadata";
import cookieParser from "cookie-parser";
import express from "express";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { ApiExceptionFilter } from "./filters/api-exception.filter.js";
import { WrapDataInterceptor } from "./interceptors/wrap-data.interceptor.js";
import { validationPipeOptions } from "./validation.js";
import { mountApiNotFound, mountWebStatic } from "./web-static.js";

export async function createNestApp(): Promise<INestApplication> {
  const server = express();
  server.disable("x-powered-by");

  // Nest 未匹配路由不 next，静态/SPA 必须先挂；SPA 对 /api 放行
  mountWebStatic(server);

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    bodyParser: false,
    logger: ["error", "warn"],
  });

  // 自定义 32MiB；关掉 Nest 默认 bodyParser 后自行挂
  app.use(express.json({ limit: "32mb" }));
  app.use(cookieParser());

  app.useGlobalPipes(new ValidationPipe(validationPipeOptions));
  app.useGlobalInterceptors(new WrapDataInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();

  // API 未匹配 → JSON 404（静态已在 Nest 之前挂好）
  mountApiNotFound(server);
  return app;
}
