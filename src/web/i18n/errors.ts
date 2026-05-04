import type { TranslationKey } from "./types";

export const ERROR_CODE_MAP: Record<string, TranslationKey> = {
  UNAUTHENTICATED: "errUnauthenticated",
  BAD_REQUEST: "errBadRequest",
  INVALID_VISITOR_NAME: "errInvalidVisitorName",
  DOC_EXISTS: "errDocExists",
  DOC_NOT_FOUND: "errDocNotFound",
  FORBIDDEN: "errForbidden",
  INTERNAL: "errInternal",
  INVALID_PATH: "errInvalidPath",
  UNKNOWN: "errUnknown",
  UNKNOWN_VISITOR_IDS: "errUnknownVisitorIds",
  TEMPLATE_NOT_FOUND: "errTemplateNotFound",
  DOMAIN_NOT_RESTRICTED: "errDomainNotRestricted",
};

export const PATH_ERROR_MESSAGE_MAP: Record<string, TranslationKey> = {
  "relative path is required": "pathRequired",
  "path must be relative": "pathMustBeRelative",
  "use forward slashes": "useForwardSlashes",
  "path must not contain ..": "pathNoDotDot",
  "document path must end with .md": "pathMustEndWithMd",
  "path contains unsupported characters": "pathUnsupportedChars",
  "path escapes docs root": "pathEscapesRoot",
};

export const STORAGE_ERROR_MESSAGE_MAP: Record<string, TranslationKey> = {
  "enter a folder name": "enterFolderName",
  "use a single name, not a path": "singleNameNotPath",
  "invalid folder name": "invalidFolderName",
  "folder name is too long": "folderNameTooLong",
  "enter a file name": "enterFileName",
  "use a file name, not a path": "singleFileNameNotPath",
  "invalid file name": "invalidFileName",
  "file name is too long": "fileNameTooLong",
};
