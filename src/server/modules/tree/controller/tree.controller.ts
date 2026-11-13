import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { TreeNode } from "../../../../shared/types/tree.js";
import { NestCanEnterDomainGuard } from "../../../nest/guards/nest-can-enter-domain.guard.js";
import { getDocumentTree } from "../tree.application.js";
import { GetTreeRequest } from "../request/get-tree.request.js";

@Controller("api/tree")
export class TreeController {
  @Get()
  @UseGuards(NestCanEnterDomainGuard)
  get(@Req() req: Request, @Query() query: GetTreeRequest): TreeNode[] {
    const visitorId = req.visitor?.visitor_id ?? null;
    return getDocumentTree(query.domainId, visitorId);
  }
}
