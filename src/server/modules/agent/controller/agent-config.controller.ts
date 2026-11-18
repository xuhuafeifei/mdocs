import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import type { VisitorRow } from "../../visitor/entity/visitor.entity.js";
import {
  CurrentVisitor,
  VisitorId,
} from "../../../nest/decorators/visitor.decorators.js";
import { RequireVisitorGuard } from "../../../nest/guards/require-visitor.guard.js";
import {
  agentStatus,
  getDefaultConfig,
  listConfigs,
  removeConfig,
  setDefaultConfig,
  upsertConfig,
} from "../application/agent.application.js";

@Controller("api/agent")
@UseGuards(RequireVisitorGuard)
export class AgentConfigController {
  @Get("status")
  status(@VisitorId() visitorId: string) {
    return agentStatus(visitorId);
  }

  @Get("configs")
  configs(@VisitorId() visitorId: string) {
    return listConfigs(visitorId);
  }

  @Get("config")
  config(@VisitorId() visitorId: string) {
    return getDefaultConfig(visitorId);
  }

  @Put("config")
  putConfig(
    @CurrentVisitor() visitor: VisitorRow,
    @Body() body: Record<string, unknown>,
  ) {
    return upsertConfig(visitor.visitor_id, visitor.visitor_name, body ?? {});
  }

  @Post("config/:id/default")
  setDefault(@VisitorId() visitorId: string, @Param("id") id: string) {
    return setDefaultConfig(visitorId, id);
  }

  @Delete("config/:id")
  remove(@VisitorId() visitorId: string, @Param("id") id: string) {
    return removeConfig(visitorId, id);
  }
}
