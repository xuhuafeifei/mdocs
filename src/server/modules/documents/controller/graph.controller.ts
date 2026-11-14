import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { VisitorId } from "../../../nest/decorators/visitor.decorators.js";
import { RequireVisitorGuard } from "../../../nest/guards/require-visitor.guard.js";
import {
  enqueueDomainGraphAnalyze,
  enqueueFolderGraphAnalyze,
  getGraphTask,
  readDomainGraph,
  readFolderGraph,
} from "../application/graph.application.js";

@Controller("api/graph")
@UseGuards(RequireVisitorGuard)
export class GraphController {
  @Get("tasks/:taskId")
  task(@Param("taskId") taskId: string) {
    return getGraphTask(taskId);
  }

  @Get("domain/:domainId")
  domain(@VisitorId() visitorId: string, @Param("domainId") domainId: string) {
    return readDomainGraph(domainId, visitorId);
  }

  @Post("domain/:domainId/analyze")
  analyzeDomain(
    @VisitorId() visitorId: string,
    @Param("domainId") domainId: string,
  ) {
    return enqueueDomainGraphAnalyze(domainId, visitorId);
  }

  @Get(":folderId")
  folder(@VisitorId() visitorId: string, @Param("folderId") folderId: string) {
    return readFolderGraph(folderId, visitorId);
  }

  @Post(":folderId/analyze")
  analyzeFolder(
    @VisitorId() visitorId: string,
    @Param("folderId") folderId: string,
  ) {
    return enqueueFolderGraphAnalyze(folderId, visitorId);
  }
}
