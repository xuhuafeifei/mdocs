import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Request, Response } from "express";
import fs from "node:fs";
import { NestRequireVisitorGuard } from "../../../nest/guards/nest-require-visitor.guard.js";
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
@UseGuards(NestRequireVisitorGuard)
export class MemesController {
  @Get()
  list(@Req() req: Request, @Query() query: ListMemesRequest) {
    return listMemesForVisitor(req.visitor!.visitor_id, query.scope);
  }

  @Get("system/meta")
  systemMeta() {
    return getSystemMemeMeta();
  }

  @Post("system/sync")
  syncSystem(@Body() body: SyncSystemMemesRequest) {
    return syncSystemMemes(body.spec);
  }

  /** 取图：文件流，不包 `{ data }`（见 NestWrapDataInterceptor 对 StreamableFile 豁免） */
  @Get("image/:id")
  image(
    @Req() req: Request,
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response,
  ): StreamableFile {
    const found = resolveMemeForVisitor(req.visitor!.visitor_id, id);
    res.setHeader("Content-Type", found.mime);
    res.setHeader("Cache-Control", "private, max-age=86400");
    return new StreamableFile(fs.createReadStream(found.filePath));
  }

  @Post()
  @UseInterceptors(NestMemeUploadInterceptor)
  upload(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadMemeRequest,
  ) {
    return uploadTenantMeme(req.visitor!.visitor_id, file, {
      desc: body.desc,
      meme_name: body.meme_name,
    });
  }

  @Patch(":id")
  patch(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: UpdateMemeRequest,
  ) {
    return patchTenantMeme(req.visitor!.visitor_id, id, { desc: body.desc });
  }

  @Delete(":id")
  remove(@Req() req: Request, @Param("id") id: string) {
    return removeTenantMeme(req.visitor!.visitor_id, id);
  }
}
