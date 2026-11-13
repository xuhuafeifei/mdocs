/**
 * 把 Nest 接到已经建好的 Express 上。不新开端口。
 * reflect-metadata 必须先于带装饰器的模块加载。
 */
import "reflect-metadata";
import type { Application } from "express";
import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { NestAppModule } from "./nest-app.module.js";
import { NestApiExceptionFilter } from "./nest-api-exception.filter.js";
import { NestWrapDataInterceptor } from "./nest-wrap-data.interceptor.js";

export async function attachNest(server: Application): Promise<void> {
  const app = await NestFactory.create(NestAppModule, new ExpressAdapter(server), {
    bodyParser: false,
    logger: ["error", "warn"],
  });
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
  app.useGlobalInterceptors(new NestWrapDataInterceptor());
  app.useGlobalFilters(new NestApiExceptionFilter());
  await app.init();
}
