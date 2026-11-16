import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import {
  OptionalVisitorId,
  VisitorId,
} from "../../../nest/decorators/visitor.decorators.js";
import {
  DocumentDeleteGuard,
  DocumentEditGuard,
  DocumentReadGuard,
} from "../../../nest/guards/document-access.guard.js";
import { RequireVisitorGuard } from "../../../nest/guards/require-visitor.guard.js";
import * as docs from "../application/documents.application.js";
import { ConvertDocumentRequest } from "../request/convert-document.request.js";
import { CreateDocumentRequest } from "../request/create-document.request.js";
import { EmbeddingIndexRequest } from "../request/embedding-index.request.js";
import { EmbeddingRebuildRequest } from "../request/embedding-rebuild.request.js";
import { GetDocumentRequest } from "../request/get-document.request.js";
import { ListDeletedDocumentsRequest } from "../request/list-deleted-documents.request.js";
import { ListDocumentsRequest } from "../request/list-documents.request.js";
import { MergeContextRequest } from "../request/merge-context.request.js";
import { MoveDocumentRequest } from "../request/move-document.request.js";
import { RestoreDocumentRequest } from "../request/restore-document.request.js";
import { SearchDocumentsRequest } from "../request/search-documents.request.js";
import { SuggestCommitMessageRequest } from "../request/suggest-commit-message.request.js";
import { SuggestDocumentMergeRequest } from "../request/suggest-document-merge.request.js";
import { SuggestMergeMessageRequest } from "../request/suggest-merge-message.request.js";
import { SuggestMergeResolutionsRequest } from "../request/suggest-merge-resolutions.request.js";
import { SyncStatusRequest } from "../request/sync-status.request.js";
import { UpdateDocumentRequest } from "../request/update-document.request.js";

@Controller("api/documents")
export class DocumentsController {
  @Get("deleted")
  @UseGuards(RequireVisitorGuard)
  listDeleted(
    @VisitorId() visitorId: string,
    @Query() query: ListDeletedDocumentsRequest,
  ) {
    return docs.listDeletedDocs(visitorId, query.limit);
  }

  @Post("restore")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RequireVisitorGuard)
  restore(
    @VisitorId() visitorId: string,
    @Body() body: RestoreDocumentRequest,
  ) {
    return docs.restoreDocFromAudit(visitorId, body.auditId);
  }

  @Get()
  list(
    @OptionalVisitorId() visitorId: string | null,
    @Query() query: ListDocumentsRequest,
  ) {
    return docs.listDocs({
      domainId: query.domainId,
      domainName: query.domainName,
      visitorId,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RequireVisitorGuard)
  create(
    @VisitorId() visitorId: string,
    @Body() body: CreateDocumentRequest,
  ) {
    return docs.createDoc({
      actorVisitorId: visitorId,
      fileName: body.fileName,
      content: body.content,
      displayName: body.displayName,
      domainId: body.domainId,
      permission: body.permission,
      parentId: body.parentId,
      contentFormat: body.contentFormat === "markdown" ? "markdown" : undefined,
      fileType: body.fileType,
    });
  }

  @Post("convert")
  convert(@Body() body: ConvertDocumentRequest) {
    return docs.convertContent(body);
  }

  @Get("embedding-index")
  embeddingIndex(
    @OptionalVisitorId() visitorId: string | null,
    @Query() query: EmbeddingIndexRequest,
  ) {
    return docs.embeddingIndex(visitorId, query.domainId);
  }

  @Post("embedding-rebuild")
  embeddingRebuild(
    @OptionalVisitorId() visitorId: string | null,
    @Body() body: EmbeddingRebuildRequest,
  ) {
    return docs.embeddingRebuild(visitorId, body.documentIds);
  }

  @Post("search")
  search(
    @OptionalVisitorId() visitorId: string | null,
    @Body() body: SearchDocumentsRequest,
  ) {
    return docs.searchDocs({
      query: body.query,
      visitorId,
      domainId: body.domainId,
      topN: body.topN,
      mode: body.mode,
    });
  }

  @Get("folder/:folderId/children")
  folderChildren(
    @OptionalVisitorId() visitorId: string | null,
    @Param("folderId") folderId: string,
  ) {
    return docs.folderChildren(folderId, visitorId);
  }

  @Get("folder/:folderId/tree")
  folderTree(
    @OptionalVisitorId() visitorId: string | null,
    @Param("folderId") folderId: string,
  ) {
    return docs.folderTree(folderId, visitorId);
  }

  @Delete("folder/:folderDocumentId")
  @UseGuards(RequireVisitorGuard)
  deleteFolder(
    @VisitorId() visitorId: string,
    @Param("folderDocumentId") folderDocumentId: string,
  ) {
    return docs.deleteFolderDoc(visitorId, folderDocumentId);
  }

  @Get(":documentId/sync-status")
  @UseGuards(DocumentReadGuard)
  syncStatus(
    @Param("documentId") documentId: string,
    @Query() query: SyncStatusRequest,
  ) {
    return docs.syncStatus(documentId, query.localBaseCommitId);
  }

  @Get(":documentId/merge-context")
  @UseGuards(DocumentReadGuard)
  mergeContext(
    @Param("documentId") documentId: string,
    @Query() query: MergeContextRequest,
  ) {
    return docs.mergeContext(
      documentId,
      query.localBaseCommitId,
      query.remoteCommitId,
    );
  }

  @Get(":documentId/commits")
  @UseGuards(DocumentReadGuard)
  listCommits(@Param("documentId") documentId: string) {
    return docs.commitsList(documentId);
  }

  @Get(":documentId/commits/:commitId")
  @UseGuards(DocumentReadGuard)
  getCommit(
    @Param("documentId") documentId: string,
    @Param("commitId") commitId: string,
  ) {
    return docs.commitGet(documentId, commitId);
  }

  @Post(":documentId/commits/:commitId/restore")
  @UseGuards(DocumentEditGuard, RequireVisitorGuard)
  restoreCommit(
    @VisitorId() visitorId: string,
    @Param("documentId") documentId: string,
    @Param("commitId") commitId: string,
  ) {
    return docs.commitRestore({
      actorVisitorId: visitorId,
      documentId,
      commitId,
    });
  }

  @Get(":documentId")
  @UseGuards(DocumentReadGuard)
  get(
    @OptionalVisitorId() visitorId: string | null,
    @Param("documentId") documentId: string,
    @Query() query: GetDocumentRequest,
  ) {
    return docs.readDoc(documentId, visitorId, query.format);
  }

  @Post(":documentId/move")
  @UseGuards(RequireVisitorGuard)
  move(
    @VisitorId() visitorId: string,
    @Param("documentId") documentId: string,
    @Body() body: MoveDocumentRequest,
  ) {
    return docs.moveDoc({
      actorVisitorId: visitorId,
      documentId,
      parentId: body.parentId,
    });
  }

  @Put(":documentId")
  @UseGuards(DocumentEditGuard, RequireVisitorGuard)
  update(
    @VisitorId() visitorId: string,
    @Param("documentId") documentId: string,
    @Body() body: UpdateDocumentRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const version = body.version
      ? {
          localBaseCommitId: body.version.localBaseCommitId,
          merge: body.version.merge
            ? {
                remoteCommitId: body.version.merge.remoteCommitId,
                localSnapshotContent: body.version.merge.localSnapshotContent,
                forceLocal:
                  body.version.merge.forceLocal === true
                    ? (true as const)
                    : undefined,
              }
            : undefined,
        }
      : undefined;

    const result = docs.updateDoc({
      actorVisitorId: visitorId,
      documentId,
      content: body.content,
      displayName: body.displayName,
      permission: body.permission,
      contentFormat: body.contentFormat === "markdown" ? "markdown" : undefined,
      version,
      message: body.message,
      source: body.source,
    });

    if (result.kind === "merge") {
      res.status(HttpStatus.NO_CONTENT);
      return;
    }
    return result.doc;
  }

  @Post(":documentId/suggest-commit-message")
  @UseGuards(DocumentEditGuard, RequireVisitorGuard)
  suggestCommitMessage(
    @VisitorId() visitorId: string,
    @Param("documentId") documentId: string,
    @Body() body: SuggestCommitMessageRequest,
  ) {
    return docs.suggestCommit({
      actorVisitorId: visitorId,
      documentId,
      content: body.content,
      contentFormat: body.contentFormat,
    });
  }

  @Post(":documentId/suggest-document-merge")
  @UseGuards(DocumentEditGuard, RequireVisitorGuard)
  suggestDocumentMerge(
    @VisitorId() visitorId: string,
    @Param("documentId") documentId: string,
    @Body() body: SuggestDocumentMergeRequest,
  ) {
    return docs.suggestMerge({
      actorVisitorId: visitorId,
      documentId,
      localContent: body.localContent,
      localBaseCommitId: body.localBaseCommitId,
      contentFormat: body.contentFormat,
    });
  }

  @Post(":documentId/suggest-merge-resolutions")
  @UseGuards(DocumentEditGuard, RequireVisitorGuard)
  suggestMergeResolutions(
    @VisitorId() visitorId: string,
    @Param("documentId") documentId: string,
    @Body() body: SuggestMergeResolutionsRequest,
  ) {
    const conflictMarkdown = body.conflictMarkdown ?? body.markedText;
    if (typeof conflictMarkdown !== "string") {
      throw new BadRequestException("conflictMarkdown is required");
    }
    return docs.suggestResolutions({
      actorVisitorId: visitorId,
      documentId,
      conflictMarkdown,
    });
  }

  @Post(":documentId/suggest-merge-message")
  @UseGuards(DocumentEditGuard, RequireVisitorGuard)
  suggestMergeMessage(
    @VisitorId() visitorId: string,
    @Param("documentId") documentId: string,
    @Body() body: SuggestMergeMessageRequest,
  ) {
    return docs.suggestMergeMsg({
      actorVisitorId: visitorId,
      documentId,
      localContent: body.localContent,
      remoteContent: body.remoteContent,
      mergedContent: body.mergedContent,
      baseContent: body.baseContent,
      contentFormat: body.contentFormat,
    });
  }

  @Delete(":documentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(DocumentDeleteGuard, RequireVisitorGuard)
  remove(
    @VisitorId() visitorId: string,
    @Param("documentId") documentId: string,
  ): void {
    docs.deleteDoc(visitorId, documentId);
  }
}
