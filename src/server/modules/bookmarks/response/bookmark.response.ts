/** GET /api/bookmarks 列表项（驼峰）。 */
export type BookmarkResponse = {
  documentId: string;
  domainId: string | null;
  relativePath: string | null;
  displayName: string | null;
  ownerVisitorId: string | null;
  ownerVisitorName: string | null;
  permission: number | null;
  createdAt: string | null;
  bookmarkedAt: string;
  isDeleted: boolean;
};
