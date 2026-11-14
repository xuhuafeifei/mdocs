import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { RequireVisitorGuard } from "../../../nest/guards/require-visitor.guard.js";
import {
  listMcpServersPayload,
  replaceMcpServersPayload,
  testMcpServerById,
} from "../application/mcp-servers.application.js";
import { ReplaceMcpServersRequest } from "../request/replace-mcp-servers.request.js";

@Controller("api/mcp-servers")
@UseGuards(RequireVisitorGuard)
export class McpServersController {
  @Get()
  list() {
    return listMcpServersPayload();
  }

  @Put()
  replace(@Body() body: ReplaceMcpServersRequest) {
    return replaceMcpServersPayload(body.servers);
  }

  @Post(":id/test")
  test(@Param("id") id: string) {
    return testMcpServerById(id);
  }
}
