import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from "@nestjs/common";
import { Observable, map } from "rxjs";
import type { ApiOk } from "../http/api-envelope.js";

/**
 * controller `return` 的业务结果 → `{ data }`。
 * 不要在 handler 里 `@Res()+res.json`，否则本拦截器不会跑。
 * `StreamableFile`（取图等）原样放行；`undefined`（如 204）也不包信封。
 */
@Injectable()
export class WrapDataInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiOk<unknown> | StreamableFile | undefined> {
    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile) return data;
        if (data === undefined) return undefined;
        return { data };
      }),
    );
  }
}
