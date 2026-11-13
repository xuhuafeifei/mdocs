/** 表情包 HTTP 错误（Nest ExceptionFilter 识别 code + status） */
export class MemeError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "MemeError";
    this.code = code;
    this.status = status;
  }
}
