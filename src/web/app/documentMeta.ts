import type { ActiveDocumentMeta, DocumentDetail } from "../../shared/types/document";

export function documentDetailToMeta(doc: DocumentDetail): ActiveDocumentMeta {
  const {
    content: _content,
    contentHash: _hash,
    jobRuntime: _jobRuntime,
    ...meta
  } = doc;
  return meta;
}
