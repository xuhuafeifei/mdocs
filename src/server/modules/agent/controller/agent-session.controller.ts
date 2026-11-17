import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { VisitorId } from "../../../nest/decorators/visitor.decorators.js";
import { RequireVisitorGuard } from "../../../nest/guards/require-visitor.guard.js";
import {
  contextUsage,
  sessionBindDocument,
  sessionCompact,
  sessionGet,
  sessionOpen,
  sessionPin,
  sessionRename,
  sessionsCreate,
  sessionsList,
  systemPromptInspector,
} from "../application/agent.application.js";

@Controller("api/agent")
@UseGuards(RequireVisitorGuard)
export class AgentSessionController {
  @Get("session")
  getSession(
    @VisitorId() visitorId: string,
    @Query("mode") mode?: string,
    @Query("documentId") documentId?: string,
  ) {
    return sessionGet(visitorId, mode, documentId);
  }

  @Get("context-usage")
  usage(@VisitorId() visitorId: string) {
    return contextUsage(visitorId);
  }

  @Get("system-prompt")
  systemPrompt(
    @VisitorId() visitorId: string,
    @Query() query: Record<string, string>,
  ) {
    return systemPromptInspector(visitorId, query);
  }

  @Get("sessions")
  list(
    @VisitorId() visitorId: string,
    @Query("mode") mode?: string,
    @Query("documentId") documentId?: string,
  ) {
    return sessionsList(visitorId, mode, documentId);
  }

  @Post("sessions")
  create(
    @VisitorId() visitorId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return sessionsCreate(visitorId, body ?? {});
  }

  @Post("session/compact")
  compact(
    @VisitorId() visitorId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return sessionCompact(visitorId, body ?? {});
  }

  @Post("session/rename")
  rename(
    @VisitorId() visitorId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return sessionRename(visitorId, body ?? {});
  }

  @Post("session/pin")
  pin(@VisitorId() visitorId: string, @Body() body: Record<string, unknown>) {
    return sessionPin(visitorId, body ?? {});
  }

  @Post("session/open")
  open(@VisitorId() visitorId: string, @Body() body: Record<string, unknown>) {
    return sessionOpen(visitorId, body ?? {});
  }

  @Post("session/bind-document")
  bindDocument(
    @VisitorId() visitorId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return sessionBindDocument(visitorId, body ?? {});
  }
}
