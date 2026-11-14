/**
 * 把 Nest 接到已经建好的 Express 上。不新开端口。
 * reflect-metadata 必须先于带装饰器的模块加载。
 */
import "reflect-metadata";
import type { Application, NextFunction, Request, Response } from "express";
import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { VisitorContext } from "./context/visitor.context.js";
import { ApiExceptionFilter } from "./filters/api-exception.filter.js";
import { WrapDataInterceptor } from "./interceptors/wrap-data.interceptor.js";

export async function attachNest(server: Application): Promise<void> {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    bodyParser: false,
    logger: ["error", "warn"],
  });
  // Guard 早于 Interceptor：用 middleware 写入 ALS，供 Guard / @VisitorId 共用
  app.use(bindVisitorContext);
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
}

function bindVisitorContext(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  VisitorContext.run(req.visitor ?? null, () => next());
}
