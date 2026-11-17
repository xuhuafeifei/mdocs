import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { VisitorId } from "../../../nest/decorators/visitor.decorators.js";
import { RequireVisitorGuard } from "../../../nest/guards/require-visitor.guard.js";
import {
  skillsCreate,
  skillsList,
  skillsRemove,
  skillsUpdate,
} from "../application/agent.application.js";

@Controller("api/agent")
@UseGuards(RequireVisitorGuard)
export class AgentSkillsController {
  @Get("skills")
  list(@VisitorId() visitorId: string) {
    return skillsList(visitorId);
  }

  @Post("skills")
  @HttpCode(HttpStatus.CREATED)
  create(
    @VisitorId() visitorId: string,
    @Body() body: { name?: string; description?: string; body?: string },
  ) {
    return skillsCreate(visitorId, body ?? {});
  }

  @Patch("skills/:id")
  update(
    @VisitorId() visitorId: string,
    @Param("id") id: string,
    @Body() body: { name?: string; description?: string; body?: string },
  ) {
    return skillsUpdate(visitorId, id, body ?? {});
  }

  @Delete("skills/:id")
  remove(@VisitorId() visitorId: string, @Param("id") id: string) {
    return skillsRemove(visitorId, id);
  }
}
