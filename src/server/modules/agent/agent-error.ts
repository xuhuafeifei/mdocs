/** HTTP 边界错误：ApiExceptionFilter 认 code + status */
export class AgentError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "AgentError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function agentBadRequest(message: string, details?: unknown): never {
  throw new AgentError("BAD_REQUEST", message, 400, details);
}

export function agentNotFound(message: string): never {
  throw new AgentError("NOT_FOUND", message, 404);
}

export function agentForbidden(message: string): never {
  throw new AgentError("FORBIDDEN", message, 403);
}

export function agentConflict(code: string, message: string, details?: unknown): never {
  throw new AgentError(code, message, 409, details);
}
