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
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { NestRequireVisitorGuard } from "../../../nest/guards/nest-require-visitor.guard.js";
import {
  createCustomPipeline,
  getPipelineJobStatus,
  getPipelineYaml,
  getSystemPipelineDefaultYaml,
  listLegacyPluginsCatalog,
  listPipelinesMarketplace,
  listPluginStepDefinitions,
  putPipelineYaml,
  removeCustomPipeline,
  resetSystemPipelineYaml,
  startLegacyPluginInstall,
  startPipelineInstallJob,
  startPipelineUninstallJob,
  uninstallLegacyPlugin,
} from "../application/plugins.application.js";
import { CreateCustomPipelineRequest } from "../request/create-custom-pipeline.request.js";
import { GetPipelineJobRequest } from "../request/get-pipeline-job.request.js";
import { LegacyPluginInstallRequest } from "../request/legacy-plugin-install.request.js";
import { PutPipelineYamlRequest } from "../request/put-pipeline-yaml.request.js";

@Controller("api/plugins")
@UseGuards(NestRequireVisitorGuard)
export class PluginsController {
  /** 旧 catalog（Engram 硬编码安装）；新 UI 不使用 */
  @Get()
  listCatalog() {
    return listLegacyPluginsCatalog();
  }

  @Get("pipelines")
  listPipelines(@Req() req: Request) {
    return listPipelinesMarketplace(req.visitor!.visitor_id);
  }

  @Get("step-definitions")
  stepDefinitions() {
    return listPluginStepDefinitions();
  }

  @Get("pipelines/system/:id/default")
  systemDefault(@Param("id") id: string) {
    return getSystemPipelineDefaultYaml(id.trim());
  }

  @Post("pipelines/system/:id/reset")
  resetSystem(@Param("id") id: string) {
    return resetSystemPipelineYaml(id.trim());
  }

  @Post("pipelines/custom")
  @HttpCode(HttpStatus.CREATED)
  createCustom(@Req() req: Request, @Body() body: CreateCustomPipelineRequest) {
    return createCustomPipeline(req.visitor!.visitor_id, {
      name: body.name,
      installMode: body.installMode,
      outputs: body.outputs,
    });
  }

  @Delete("pipelines/custom/:id")
  deleteCustom(@Req() req: Request, @Param("id") id: string) {
    return removeCustomPipeline(req.visitor!.visitor_id, id.trim());
  }

  @Post("pipelines/:scope/:id/install")
  @HttpCode(HttpStatus.ACCEPTED)
  installPipeline(
    @Req() req: Request,
    @Param("scope") scope: string,
    @Param("id") id: string,
  ) {
    return startPipelineInstallJob(scope, id.trim(), req.visitor!.visitor_id);
  }

  @Post("pipelines/:scope/:id/uninstall")
  @HttpCode(HttpStatus.ACCEPTED)
  uninstallPipeline(
    @Req() req: Request,
    @Param("scope") scope: string,
    @Param("id") id: string,
  ) {
    return startPipelineUninstallJob(scope, id.trim(), req.visitor!.visitor_id);
  }

  @Get("pipelines/:scope/:id/job")
  pipelineJob(
    @Req() req: Request,
    @Param("scope") scope: string,
    @Param("id") id: string,
    @Query() query: GetPipelineJobRequest,
  ) {
    return getPipelineJobStatus(
      scope,
      id.trim(),
      req.visitor!.visitor_id,
      query.action,
    );
  }

  @Get("pipelines/:scope/:id")
  getYaml(
    @Req() req: Request,
    @Param("scope") scope: string,
    @Param("id") id: string,
  ) {
    return getPipelineYaml(scope, id.trim(), req.visitor!.visitor_id);
  }

  @Put("pipelines/:scope/:id")
  putYaml(
    @Req() req: Request,
    @Param("scope") scope: string,
    @Param("id") id: string,
    @Body() body: PutPipelineYamlRequest,
  ) {
    return putPipelineYaml(scope, id.trim(), body.yaml, req.visitor!.visitor_id);
  }

  /** 旧 catalog 安装（兼容） */
  @Post(":id/install")
  @HttpCode(HttpStatus.ACCEPTED)
  legacyInstall(@Param("id") id: string, @Body() body: LegacyPluginInstallRequest) {
    return startLegacyPluginInstall(id.trim(), body.headers);
  }

  @Post(":id/uninstall")
  legacyUninstall(@Param("id") id: string) {
    return uninstallLegacyPlugin(id.trim());
  }
}
