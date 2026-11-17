import { Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { VisitorId } from "../../../nest/decorators/visitor.decorators.js";
import { RequireVisitorGuard } from "../../../nest/guards/require-visitor.guard.js";
import {
  addDocumentBookmark,
  checkBookmarked,
  listBookmarks,
  removeDocumentBookmark,
} from "../application/bookmarks.application.js";

@Controller("api/bookmarks")
@UseGuards(RequireVisitorGuard)
export class BookmarksController {
  @Get()
  list(@VisitorId() visitorId: string) {
    return listBookmarks(visitorId);
  }

  @Get(":documentId")
  check(
    @VisitorId() visitorId: string,
    @Param("documentId") documentId: string,
  ) {
    return checkBookmarked(visitorId, documentId);
  }

  @Post(":documentId")
  add(
    @VisitorId() visitorId: string,
    @Param("documentId") documentId: string,
  ) {
    return addDocumentBookmark(visitorId, documentId);
  }

  @Delete(":documentId")
  remove(
    @VisitorId() visitorId: string,
    @Param("documentId") documentId: string,
  ) {
    return removeDocumentBookmark(visitorId, documentId);
  }
}
