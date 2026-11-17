import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { VisitorId } from "../../../nest/decorators/visitor.decorators.js";
import { RequireVisitorGuard } from "../../../nest/guards/require-visitor.guard.js";
import type { AgentStreamEvent } from "../Agent/run.js";
import { subscribeAgentRun } from "../Agent/run-manager.js";
import {
  runCancel,
  runGet,
  startChat,
} from "../application/agent.application.js";

function writeSse(res: Response, event: AgentStreamEvent) {
  if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
}

@Controller("api/agent")
@UseGuards(RequireVisitorGuard)
export class AgentChatController {
  /** SSE：绕过 WrapDataInterceptor（@Res 无 passthrough） */
  @Post("chat")
  async chat(
    @VisitorId() visitorId: string,
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ): Promise<void> {
    const started = await startChat(visitorId, body ?? {});

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Agent-Run-Id", started.run.runId);
    res.flushHeaders?.();

    const sub = subscribeAgentRun({
      visitorId,
      runId: started.run.runId,
      afterSeq: 0,
      onEvent: (event) => writeSse(res, event),
      onClose: () => {
        if (!res.writableEnded) res.end();
      },
    });
    res.on("close", () => {
      sub?.unsubscribe();
      if (!res.writableEnded) res.end();
    });
  }

  @Get("runs/:runId")
  getRun(@VisitorId() visitorId: string, @Param("runId") runId: string) {
    return runGet(visitorId, runId);
  }

  @Get("runs/:runId/stream")
  stream(
    @VisitorId() visitorId: string,
    @Param("runId") runId: string,
    @Query("afterSeq") afterSeqRaw: string | undefined,
    @Res() res: Response,
  ): void {
    const afterSeq =
      typeof afterSeqRaw === "string" && /^\d+$/.test(afterSeqRaw)
        ? Number(afterSeqRaw)
        : 0;

    runGet(visitorId, runId);

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Agent-Run-Id", runId);
    res.flushHeaders?.();

    const sub = subscribeAgentRun({
      visitorId,
      runId,
      afterSeq,
      onEvent: (event) => {
        if (!res.writableEnded) writeSse(res, event);
      },
      onClose: () => {
        if (!res.writableEnded) res.end();
      },
    });
    if (!sub) {
      if (!res.writableEnded) res.end();
      return;
    }

    res.on("close", () => {
      sub.unsubscribe();
      if (!res.writableEnded) res.end();
    });
  }

  @Post("runs/:runId/cancel")
  cancel(@VisitorId() visitorId: string, @Param("runId") runId: string) {
    return runCancel(visitorId, runId);
  }
}
