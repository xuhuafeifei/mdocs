import { createHash, randomBytes, randomUUID } from "node:crypto";

export function newVisitorId(): string {
  return randomUUID();
}

export function newVisitorToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashVisitorToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}
