import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { NestRequireVisitorGuard } from "../../../nest/guards/nest-require-visitor.guard.js";
import { createFolder, deleteFolder } from "../application/folders.application.js";
import { CreateFolderRequest } from "../request/create-folder.request.js";

@Controller("api/folders")
@UseGuards(NestRequireVisitorGuard)
export class FoldersController {
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: Request, @Body() body: CreateFolderRequest) {
    return createFolder({
      actorVisitorId: req.visitor!.visitor_id,
      name: body.name,
      parentId: body.parentId,
      domainId: body.domainId,
      description: body.description,
      permission: body.permission,
    });
  }

  @Delete(":folderId")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: Request, @Param("folderId") folderId: string): void {
    deleteFolder({
      actorVisitorId: req.visitor!.visitor_id,
      folderId,
    });
  }
}
