/**
 * Shared API error type for HTTP-style failures (used by real fetch and Demo mock).
 */
export class ApiRequestError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
