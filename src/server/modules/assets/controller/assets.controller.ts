import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Request, Response } from "express";
import fs from "node:fs";
import { VisitorId } from "../../../nest/decorators/visitor.decorators.js";
import { RequireVisitorGuard } from "../../../nest/guards/require-visitor.guard.js";
import {
  linkRemoteImageToAsset,
  resolveAssetFile,
  uploadAssetFiles,
} from "../application/assets.application.js";
import { NestAssetUploadInterceptor } from "../nest-asset-upload.interceptor.js";
import { LinkToImgRequest } from "../request/link-to-img.request.js";
import { ServeAssetRequest } from "../request/serve-asset.request.js";

@Controller("api/assets")
export class AssetsController {
  /** 公开取文件（VisitorAuthMiddleware 对该 GET 可选鉴权） */
  @Get(":assetId")
  get(
    @Param("assetId") assetId: string,
    @Query() query: ServeAssetRequest,
    @Res({ passthrough: true }) res: Response,
  ): StreamableFile {
    const found = resolveAssetFile(assetId, query.name);
    res.setHeader("Content-Type", found.contentType);
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    if (found.contentDisposition) {
      res.setHeader("Content-Disposition", found.contentDisposition);
    }
    return new StreamableFile(fs.createReadStream(found.absPath));
  }

  @Post("upload")
  @UseGuards(RequireVisitorGuard)
  @UseInterceptors(NestAssetUploadInterceptor)
  upload(
    @VisitorId() visitorId: string,
    @Req() req: Request,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ) {
    return uploadAssetFiles({
      visitorId,
      documentId: req.body?.documentId,
      files,
    });
  }

  @Post("link-to-img")
  @UseGuards(RequireVisitorGuard)
  linkToImg(
    @VisitorId() visitorId: string,
    @Query("documentId") documentId: string | undefined,
    @Body() body: LinkToImgRequest,
  ) {
    return linkRemoteImageToAsset({
      visitorId,
      documentId,
      url: body.url,
    });
  }
}
