import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import type { TreeNode } from "../../../../shared/types/tree.js";
import { OptionalVisitorId } from "../../../nest/decorators/visitor.decorators.js";
import { CanEnterDomainGuard } from "../../../nest/guards/can-enter-domain.guard.js";
import { getDocumentTree } from "../tree.application.js";
import { GetTreeRequest } from "../request/get-tree.request.js";

@Controller("api/tree")
export class TreeController {
  @Get()
  @UseGuards(CanEnterDomainGuard)
  get(
    @OptionalVisitorId() visitorId: string | null,
    @Query() query: GetTreeRequest,
  ): TreeNode[] {
    return getDocumentTree(query.domainId, visitorId);
  }
}
