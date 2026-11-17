import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { VisitorId } from "../../../nest/decorators/visitor.decorators.js";
import { RequireVisitorGuard } from "../../../nest/guards/require-visitor.guard.js";
import {
  resolveChoice,
  resolveDraft,
  resolveSkillFormBody,
} from "../application/agent.application.js";

@Controller("api/agent")
@UseGuards(RequireVisitorGuard)
export class AgentInteractionController {
  @Post("choice")
  choice(
    @VisitorId() visitorId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return resolveChoice(visitorId, body ?? {});
  }

  @Post("editor-draft")
  editorDraft(
    @VisitorId() visitorId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return resolveDraft(visitorId, body ?? {});
  }

  @Post("skill-form")
  skillForm(
    @VisitorId() visitorId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return resolveSkillFormBody(visitorId, body ?? {});
  }
}
