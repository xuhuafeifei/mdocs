import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { VisitorId } from "../../../nest/decorators/visitor.decorators.js";
import { RequireVisitorGuard } from "../../../nest/guards/require-visitor.guard.js";
import { createFolder, deleteFolder } from "../application/folders.application.js";
import { CreateFolderRequest } from "../request/create-folder.request.js";

@Controller("api/folders")
@UseGuards(RequireVisitorGuard)
export class FoldersController {
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@VisitorId() visitorId: string, @Body() body: CreateFolderRequest) {
    return createFolder({
      actorVisitorId: visitorId,
      name: body.name,
      parentId: body.parentId,
      domainId: body.domainId,
      description: body.description,
      permission: body.permission,
    });
  }

  @Delete(":folderId")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @VisitorId() visitorId: string,
    @Param("folderId") folderId: string,
  ): void {
    deleteFolder({
      actorVisitorId: visitorId,
      folderId,
    });
  }
}
