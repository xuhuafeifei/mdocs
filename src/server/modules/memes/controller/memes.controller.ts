import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Response } from "express";
import fs from "node:fs";
import { VisitorId } from "../../../nest/decorators/visitor.decorators.js";
import { RequireVisitorGuard } from "../../../nest/guards/require-visitor.guard.js";
import {
  getSystemMemeMeta,
  listMemesForVisitor,
  patchTenantMeme,
  removeTenantMeme,
  resolveMemeForVisitor,
  syncSystemMemes,
  uploadTenantMeme,
} from "../application/memes.application.js";
import { NestMemeUploadInterceptor } from "../nest-meme-upload.interceptor.js";
import { ListMemesRequest } from "../request/list-memes.request.js";
import { SyncSystemMemesRequest } from "../request/sync-system-memes.request.js";
import { UpdateMemeRequest } from "../request/update-meme.request.js";
import { UploadMemeRequest } from "../request/upload-meme.request.js";

@Controller("api/memes")
@UseGuards(RequireVisitorGuard)
export class MemesController {
  @Get()
  list(@VisitorId() visitorId: string, @Query() query: ListMemesRequest) {
    return listMemesForVisitor(visitorId, query.scope);
  }

  @Get("system/meta")
  systemMeta() {
    return getSystemMemeMeta();
  }

  @Post("system/sync")
  syncSystem(@Body() body: SyncSystemMemesRequest) {
    return syncSystemMemes(body.spec);
  }

  /** 取图：文件流，不包 `{ data }`（见 WrapDataInterceptor 对 StreamableFile 豁免） */
  @Get("image/:id")
  image(
    @VisitorId() visitorId: string,
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response,
  ): StreamableFile {
    const found = resolveMemeForVisitor(visitorId, id);
    res.setHeader("Content-Type", found.mime);
    res.setHeader("Cache-Control", "private, max-age=86400");
    return new StreamableFile(fs.createReadStream(found.filePath));
  }

  @Post()
  @UseInterceptors(NestMemeUploadInterceptor)
  upload(
    @VisitorId() visitorId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadMemeRequest,
  ) {
    return uploadTenantMeme(visitorId, file, {
      desc: body.desc,
      meme_name: body.meme_name,
    });
  }

  @Patch(":id")
  patch(
    @VisitorId() visitorId: string,
    @Param("id") id: string,
    @Body() body: UpdateMemeRequest,
  ) {
    return patchTenantMeme(visitorId, id, { desc: body.desc });
  }

  @Delete(":id")
  remove(@VisitorId() visitorId: string, @Param("id") id: string) {
    return removeTenantMeme(visitorId, id);
  }
}
