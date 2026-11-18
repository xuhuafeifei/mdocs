import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import type { VisitorRow } from "../../visitor/entity/visitor.entity.js";
import {
  CurrentVisitor,
  VisitorId,
} from "../../../nest/decorators/visitor.decorators.js";
import { RequireVisitorGuard } from "../../../nest/guards/require-visitor.guard.js";
import {
  createDocumentComment,
  deleteDocumentComment,
  listDocumentComments,
} from "../application/document-comments.application.js";
import { CreateDocumentCommentRequest } from "../request/create-document-comment.request.js";

@Controller("api/documents")
export class DocumentCommentsController {
  /** 列表：无需登录（VisitorAuthMiddleware 对该 GET 可选鉴权） */
  @Get(":documentId/comments")
  list(@Param("documentId") documentId: string) {
    return listDocumentComments(documentId);
  }

  @Post(":documentId/comments")
  @UseGuards(RequireVisitorGuard)
  create(
    @CurrentVisitor() visitor: VisitorRow,
    @Param("documentId") documentId: string,
    @Body() body: CreateDocumentCommentRequest,
  ) {
    return createDocumentComment({
      documentId,
      visitorId: visitor.visitor_id,
      visitorName: visitor.visitor_name,
      content: body.content,
      parentId: body.parentId,
      replyToVisitorId: body.replyToVisitorId,
      replyToVisitorName: body.replyToVisitorName,
    });
  }

  @Delete(":documentId/comments/:commentId")
  @UseGuards(RequireVisitorGuard)
  remove(
    @VisitorId() visitorId: string,
    @Param("commentId") commentId: string,
  ) {
    return deleteDocumentComment(commentId, visitorId);
  }
}
