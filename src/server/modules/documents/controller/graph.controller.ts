import { Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { NestRequireVisitorGuard } from "../../../nest/guards/nest-require-visitor.guard.js";
import {
  enqueueDomainGraphAnalyze,
  enqueueFolderGraphAnalyze,
  getGraphTask,
  readDomainGraph,
  readFolderGraph,
} from "../application/graph.application.js";

@Controller("api/graph")
@UseGuards(NestRequireVisitorGuard)
export class GraphController {
  @Get("tasks/:taskId")
  task(@Param("taskId") taskId: string) {
    return getGraphTask(taskId);
  }

  @Get("domain/:domainId")
  domain(@Req() req: Request, @Param("domainId") domainId: string) {
    return readDomainGraph(domainId, req.visitor?.visitor_id ?? null);
  }

  @Post("domain/:domainId/analyze")
  analyzeDomain(@Req() req: Request, @Param("domainId") domainId: string) {
    return enqueueDomainGraphAnalyze(domainId, req.visitor?.visitor_id ?? null);
  }

  @Get(":folderId")
  folder(@Req() req: Request, @Param("folderId") folderId: string) {
    return readFolderGraph(folderId, req.visitor?.visitor_id ?? null);
  }

  @Post(":folderId/analyze")
  analyzeFolder(@Req() req: Request, @Param("folderId") folderId: string) {
    return enqueueFolderGraphAnalyze(folderId, req.visitor?.visitor_id ?? null);
  }
}
