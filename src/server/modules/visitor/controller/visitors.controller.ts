import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import {
  CurrentVisitor,
  VisitorId,
} from "../../../nest/decorators/visitor.decorators.js";
import { RequireVisitorGuard } from "../../../nest/guards/require-visitor.guard.js";
import type { VisitorRow } from "../../../infra/db/repositories/visitor.repo.js";
import {
  changeVisitorPassword,
  getCurrentVisitor,
  issueRecoveryCode,
  listCurrentVisitorDocuments,
  listVisitorDirectory,
  loginVisitorAccount,
  recoverVisitorAccount,
  registerVisitorAccount,
} from "../application/visitor.application";
import { ListMyDocumentsRequest } from "../request/list-my-documents.request.js";
import { LoginVisitorRequest } from "../request/login-visitor.request.js";
import { RecoverVisitorRequest } from "../request/recover-visitor.request.js";
import { RegisterVisitorRequest } from "../request/register-visitor.request.js";
import { SetPasswordRequest } from "../request/set-password.request.js";

/** Cookie 约 10 年，与旧 Express 路由一致 */
const VISITOR_TOKEN_COOKIE_MAX_AGE_MS = 10 * 365 * 24 * 60 * 60 * 1000;

@Controller("api/visitors")
export class VisitorsController {
  @Post("register")
  register(
    @Body() body: RegisterVisitorRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const password = body.password?.trim() || undefined;
    const result = registerVisitorAccount(body.visitorName, password);
    setVisitorTokenCookie(res, result.visitorToken);
    return { visitor: result.visitor, recoveryCode: result.recoveryCode };
  }

  @Post("login")
  login(
    @Body() body: LoginVisitorRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = loginVisitorAccount(body.visitorName.trim(), body.password.trim());
    setVisitorTokenCookie(res, result.visitorToken);
    return { visitor: result.visitor };
  }

  @Post("recover")
  recover(
    @Body() body: RecoverVisitorRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = recoverVisitorAccount(body.recoveryCode.trim());
    setVisitorTokenCookie(res, result.visitorToken);
    return { visitor: result.visitor };
  }

  @Post("recovery-code")
  @UseGuards(RequireVisitorGuard)
  recoveryCode(@VisitorId() visitorId: string) {
    return issueRecoveryCode(visitorId);
  }

  @Post("set-password")
  @UseGuards(RequireVisitorGuard)
  setPassword(@VisitorId() visitorId: string, @Body() body: SetPasswordRequest) {
    return changeVisitorPassword(visitorId, (body.password ?? "").trim());
  }

  @Get()
  @UseGuards(RequireVisitorGuard)
  directory() {
    return listVisitorDirectory();
  }

  @Get("me")
  @UseGuards(RequireVisitorGuard)
  me(@CurrentVisitor() visitor: VisitorRow) {
    return getCurrentVisitor(visitor);
  }

  @Get("me/documents")
  @UseGuards(RequireVisitorGuard)
  myDocuments(
    @VisitorId() visitorId: string,
    @Query() query: ListMyDocumentsRequest,
  ) {
    return listCurrentVisitorDocuments(visitorId, {
      offset: query.offset,
      limit: query.limit,
      domainId: query.domainId,
      creatorVisitorId: query.creatorVisitorId,
      fileType: query.fileType,
      groupBy: query.groupBy,
    });
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie("visitor_token", { path: "/" });
    return { ok: true };
  }
}

function setVisitorTokenCookie(res: Response, token: string): void {
  res.cookie("visitor_token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: VISITOR_TOKEN_COOKIE_MAX_AGE_MS,
  });
}
