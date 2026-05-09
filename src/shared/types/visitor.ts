export type VisitorId = string;

export interface VisitorPublic {
  visitorId: VisitorId;
  visitorName: string;
  createdAt: string;
  lastSeenAt: string | null;
  disabledAt: string | null;
  mergedIntoVisitorId: VisitorId | null;
}

export interface VisitorRegisterRequest {
  visitorName: string;
}

export interface VisitorRegisterResponse {
  visitor: VisitorPublic;
  recoveryCode: string;
}

export interface VisitorRecoverResponse {
  visitor: VisitorPublic;
}

export interface VisitorMeResponse {
  visitor: VisitorPublic;
}

/** 访客目录（勾选成员用）：仅 id + 昵称 */
export interface VisitorDirectoryEntry {
  visitorId: VisitorId;
  visitorName: string;
}
