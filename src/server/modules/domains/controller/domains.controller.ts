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
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { NestRequireVisitorGuard } from "../../../nest/guards/nest-require-visitor.guard.js";
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
@UseGuards(NestRequireVisitorGuard)
export class DomainsController {
  @Get()
  list(@Req() req: Request) {
    return listVisibleDomains(req.visitor?.visitor_id ?? null);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: Request, @Body() body: CreateDomainRequest) {
    return createDomain({
      actorVisitorId: req.visitor!.visitor_id,
      domainName: body.domainName,
      permission: body.permission,
    });
  }

  @Get(":id/members")
  members(@Req() req: Request, @Param("id") id: string) {
    return listDomainMembersForCreator(req.visitor!.visitor_id, id);
  }

  @Put(":id/members")
  replaceMembers(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: ReplaceDomainMembersRequest,
  ) {
    return replaceDomainMembersForCreator(req.visitor!.visitor_id, id, body);
  }

  @Put(":id/permission")
  setPermission(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: ChangeDomainPermissionRequest,
  ) {
    return updateDomainPermission(req.visitor!.visitor_id, id, body.permission);
  }

  @Put(":id")
  rename(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: RenameDomainRequest,
  ) {
    return renameDomain({
      actorVisitorId: req.visitor!.visitor_id,
      domainId: id,
      domainName: body.domainName,
    });
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: Request, @Param("id") id: string): void {
    deleteDomain(req.visitor!.visitor_id, id);
  }
}
