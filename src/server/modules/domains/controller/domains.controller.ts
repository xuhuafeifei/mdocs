import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { VisitorId } from "../../../nest/decorators/visitor.decorators.js";
import { RequireVisitorGuard } from "../../../nest/guards/require-visitor.guard.js";
import {
  createDomain,
  deleteDomain,
  listDomainMembersForCreator,
  listVisibleDomains,
  renameDomain,
  replaceDomainMembersForCreator,
  updateDomainPermission,
} from "../application/domains.application.js";
import { ChangeDomainPermissionRequest } from "../request/change-domain-permission.request.js";
import { CreateDomainRequest } from "../request/create-domain.request.js";
import { RenameDomainRequest } from "../request/rename-domain.request.js";
import { ReplaceDomainMembersRequest } from "../request/replace-domain-members.request.js";

@Controller("api/domains")
@UseGuards(RequireVisitorGuard)
export class DomainsController {
  @Get()
  list(@VisitorId() visitorId: string) {
    return listVisibleDomains(visitorId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@VisitorId() visitorId: string, @Body() body: CreateDomainRequest) {
    return createDomain({
      actorVisitorId: visitorId,
      domainName: body.domainName,
      permission: body.permission,
    });
  }

  @Get(":id/members")
  members(@VisitorId() visitorId: string, @Param("id") id: string) {
    return listDomainMembersForCreator(visitorId, id);
  }

  @Put(":id/members")
  replaceMembers(
    @VisitorId() visitorId: string,
    @Param("id") id: string,
    @Body() body: ReplaceDomainMembersRequest,
  ) {
    return replaceDomainMembersForCreator(visitorId, id, body);
  }

  @Put(":id/permission")
  setPermission(
    @VisitorId() visitorId: string,
    @Param("id") id: string,
    @Body() body: ChangeDomainPermissionRequest,
  ) {
    return updateDomainPermission(visitorId, id, body.permission);
  }

  @Put(":id")
  rename(
    @VisitorId() visitorId: string,
    @Param("id") id: string,
    @Body() body: RenameDomainRequest,
  ) {
    return renameDomain({
      actorVisitorId: visitorId,
      domainId: id,
      domainName: body.domainName,
    });
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@VisitorId() visitorId: string, @Param("id") id: string): void {
    deleteDomain(visitorId, id);
  }
}
