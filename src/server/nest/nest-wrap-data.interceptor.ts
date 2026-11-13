import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, map } from "rxjs";
import type { NestApiOk } from "./nest-api-ok.js";

/**
 * controller `return` 的业务结果 → `{ data }`。
 * 不要在 handler 里 `@Res()+res.json`，否则本拦截器不会跑。
 */
@Injectable()
export class NestWrapDataInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<NestApiOk<unknown>> {
    return next.handle().pipe(map((data) => ({ data })));
  }
}
