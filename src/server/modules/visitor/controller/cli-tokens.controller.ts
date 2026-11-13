import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { NestRequireVisitorGuard } from "../../../nest/guards/nest-require-visitor.guard.js";
import {
  issueCliToken,
  listVisitorCliTokens,
  removeCliToken,
  updateCliTokenRevoked,
} from "../application/cli-token.application.js";
import { CreateCliTokenRequest } from "../request/create-cli-token.request.js";
import { SetCliTokenRevokedRequest } from "../request/set-cli-token-revoked.request.js";

@Controller("api/cli")
@UseGuards(NestRequireVisitorGuard)
export class CliTokensController {
  @Post("tokens")
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: Request, @Body() body: CreateCliTokenRequest) {
    return issueCliToken(req.visitor!.visitor_id, body.name);
  }

  @Get("tokens")
  list(@Req() req: Request) {
    return listVisitorCliTokens(req.visitor!.visitor_id);
  }

  @Patch("tokens/:tokenId")
  @HttpCode(HttpStatus.NO_CONTENT)
  setRevoked(
    @Req() req: Request,
    @Param("tokenId") tokenId: string,
    @Body() body: SetCliTokenRevokedRequest,
  ): void {
    updateCliTokenRevoked(req.visitor!.visitor_id, tokenId, body.revoked);
  }

  @Delete("tokens/:tokenId")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: Request, @Param("tokenId") tokenId: string): void {
    removeCliToken(req.visitor!.visitor_id, tokenId);
  }
}
