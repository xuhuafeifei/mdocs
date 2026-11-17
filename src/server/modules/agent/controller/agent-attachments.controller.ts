import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { VisitorId } from "../../../nest/decorators/visitor.decorators.js";
import { RequireVisitorGuard } from "../../../nest/guards/require-visitor.guard.js";
import {
  getAttachmentAccept,
  readAgentAttachment,
  saveAgentAttachment,
} from "../application/agent.application.js";
import { NestAgentAttachmentUploadInterceptor } from "../nest-agent-attachment-upload.interceptor.js";

@Controller("api/agent")
@UseGuards(RequireVisitorGuard)
export class AgentAttachmentsController {
  @Get("attachments/accept")
  accept() {
    return getAttachmentAccept();
  }

  @Post("attachments")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(NestAgentAttachmentUploadInterceptor)
  upload(
    @VisitorId() visitorId: string,
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    const sessionId =
      typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
    return saveAgentAttachment({ visitorId, sessionId, file });
  }

  @Get("attachments/:id")
  async download(
    @VisitorId() visitorId: string,
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { meta, data } = await readAgentAttachment(visitorId, id);
    res.setHeader("Content-Type", meta.mime || "application/octet-stream");
    res.setHeader("Cache-Control", "private, max-age=300");
    return new StreamableFile(Buffer.from(data));
  }
}
