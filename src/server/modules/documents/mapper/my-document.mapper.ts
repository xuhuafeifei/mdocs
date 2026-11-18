import type { DocumentsOwnerRow } from "../entity/document.entity.js";
import type { MyDocumentResponse } from "../response/my-document.response.js";

/** Row → Response（蛇形投影 → 驼峰出参）。 */
export function toMyDocumentResponse(row: DocumentsOwnerRow): MyDocumentResponse {
  return {
    documentId: row.document_id,
    domainId: row.domain_id,
    relativePath: row.relative_path,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    permission: row.permission,
    fileType: row.file_type,
    creatorVisitorId: row.owner_visitor_id,
    creatorName: row.creator_name ?? row.owner_visitor_id,
  };
}
