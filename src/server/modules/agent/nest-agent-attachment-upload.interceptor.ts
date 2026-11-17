import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Observable } from "rxjs";
import { createAgentAttachmentUpload } from "./attachments/upload.js";
import { AgentError } from "./agent-error.js";

@Injectable()
export class NestAgentAttachmentUploadInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const upload = createAgentAttachmentUpload();

    return new Observable((subscriber) => {
      upload.single("file")(req, res, (err: unknown) => {
        if (err) {
          subscriber.error(
            new AgentError(
              "BAD_REQUEST",
              err instanceof Error ? err.message : String(err),
              400,
            ),
          );
          return;
        }
        next.handle().subscribe(subscriber);
      });
    });
  }
}
