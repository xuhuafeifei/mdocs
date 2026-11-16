import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { VisitorId } from "../../../nest/decorators/visitor.decorators.js";
import { DocumentOwnerGuard } from "../../../nest/guards/document-access.guard.js";
import { RequireVisitorGuard } from "../../../nest/guards/require-visitor.guard.js";
import * as docs from "../application/documents.application.js";
import { AddDocumentInviteRequest } from "../request/add-document-invite.request.js";

@Controller("api/documents")
@UseGuards(DocumentOwnerGuard, RequireVisitorGuard)
export class DocumentInvitesController {
  @Get(":documentId/invites")
  list(@Param("documentId") documentId: string) {
    return docs.invitesList(documentId);
  }

  @Post(":documentId/invites")
  @HttpCode(HttpStatus.NO_CONTENT)
  add(
    @VisitorId() visitorId: string,
    @Param("documentId") documentId: string,
    @Body() body: AddDocumentInviteRequest,
  ): void {
    docs.inviteAdd(
      visitorId,
      documentId,
      body.targetVisitorId,
      body.targetPermission,
    );
  }

  @Delete(":documentId/invites/:targetVisitorId")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @VisitorId() visitorId: string,
    @Param("documentId") documentId: string,
    @Param("targetVisitorId") targetVisitorId: string,
  ): void {
    docs.inviteRemove(visitorId, documentId, targetVisitorId);
  }
}
