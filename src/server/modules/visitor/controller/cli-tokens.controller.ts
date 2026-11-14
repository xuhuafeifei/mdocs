import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { VisitorId } from "../../../nest/decorators/visitor.decorators.js";
import { RequireVisitorGuard } from "../../../nest/guards/require-visitor.guard.js";
import {
  issueCliToken,
  listVisitorCliTokens,
  removeCliToken,
  updateCliTokenRevoked,
} from "../application/cli-token.application.js";
import { CreateCliTokenRequest } from "../request/create-cli-token.request.js";
import { SetCliTokenRevokedRequest } from "../request/set-cli-token-revoked.request.js";

@Controller("api/cli-tokens")
@UseGuards(RequireVisitorGuard)
export class CliTokensController {
  @Post()
  create(@VisitorId() visitorId: string, @Body() body: CreateCliTokenRequest) {
    return issueCliToken(visitorId, body.name);
  }

  @Get()
  list(@VisitorId() visitorId: string) {
    return listVisitorCliTokens(visitorId);
  }

  @Patch(":tokenId")
  setRevoked(
    @VisitorId() visitorId: string,
    @Param("tokenId") tokenId: string,
    @Body() body: SetCliTokenRevokedRequest,
  ): void {
    updateCliTokenRevoked(visitorId, tokenId, body.revoked);
  }

  @Delete(":tokenId")
  remove(@VisitorId() visitorId: string, @Param("tokenId") tokenId: string): void {
    removeCliToken(visitorId, tokenId);
  }
}
