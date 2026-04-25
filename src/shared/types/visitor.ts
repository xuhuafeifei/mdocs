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
  visitorToken: string;
}

export interface VisitorMeResponse {
  visitor: VisitorPublic;
}
