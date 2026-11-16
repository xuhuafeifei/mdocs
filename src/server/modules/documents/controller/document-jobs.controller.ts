import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { VisitorId } from "../../../nest/decorators/visitor.decorators.js";
import {
  DocumentEditGuard,
  DocumentReadGuard,
} from "../../../nest/guards/document-access.guard.js";
import { RequireVisitorGuard } from "../../../nest/guards/require-visitor.guard.js";
import * as docs from "../application/documents.application.js";
import { JobConfigPutRequest } from "../request/job-config.put.request.js";
import { JobDataDeleteRequest } from "../request/job-data-delete.request.js";
import { JobLimitRequest } from "../request/job-limit.request.js";
import { MonitorConfigPutRequest } from "../request/monitor-config.put.request.js";

@Controller("api/documents")
export class DocumentJobsController {
  @Get(":documentId/job-config")
  @UseGuards(DocumentReadGuard)
  getConfig(@Param("documentId") documentId: string) {
    return docs.jobConfigGet(documentId);
  }

  @Put(":documentId/job-config")
  @UseGuards(DocumentEditGuard, RequireVisitorGuard)
  putConfig(
    @VisitorId() visitorId: string,
    @Param("documentId") documentId: string,
    @Body() body: JobConfigPutRequest,
  ) {
    return docs.jobConfigPut({
      actorVisitorId: visitorId,
      documentId,
      cron: body.cron,
      prompt: body.prompt,
      jobType: body.jobType,
      tableSchema: body.tableSchema,
    });
  }

  @Put(":documentId/monitor-config")
  @UseGuards(DocumentEditGuard, RequireVisitorGuard)
  putMonitor(
    @VisitorId() visitorId: string,
    @Param("documentId") documentId: string,
    @Body() body: MonitorConfigPutRequest,
  ) {
    let rules: Array<{ monitorId?: string; rule?: string; threshold?: number }>;
    try {
      rules = body.resolveRules();
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : "rules required",
      );
    }
    return docs.monitorConfigPut({
      actorVisitorId: visitorId,
      documentId,
      rules,
    });
  }

  @Get(":documentId/job-runs")
  @UseGuards(DocumentReadGuard)
  listRuns(
    @Param("documentId") documentId: string,
    @Query() query: JobLimitRequest,
  ) {
    return docs.jobRunsGet(documentId, query.limit);
  }

  @Get(":documentId/job-data")
  @UseGuards(DocumentReadGuard)
  listData(
    @Param("documentId") documentId: string,
    @Query() query: JobLimitRequest,
  ) {
    return docs.jobDataGet(documentId, query.limit);
  }

  @Delete(":documentId/job-data")
  @UseGuards(DocumentEditGuard)
  deleteData(
    @Param("documentId") documentId: string,
    @Body() body: JobDataDeleteRequest,
  ) {
    return docs.jobDataRemove({
      documentId,
      ids: body.ids,
      all: body.all === true,
    });
  }

  @Post(":documentId/job-run")
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(DocumentEditGuard)
  run(@Param("documentId") documentId: string) {
    return docs.jobRunManual(documentId);
  }

  @Post(":documentId/job-runs/:runId/cancel")
  @UseGuards(DocumentEditGuard)
  cancel(
    @Param("documentId") documentId: string,
    @Param("runId") runId: string,
  ) {
    return docs.jobRunCancel(documentId, runId);
  }
}
