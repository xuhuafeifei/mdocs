import {
  MiddlewareConsumer,
  Module,
  type NestModule,
} from "@nestjs/common";
import { HealthController } from "../infra/config/health.controller.js";
import { ServerSettingsController } from "../infra/config/server-settings.controller.js";
import { AgentAttachmentsController } from "../modules/agent/controller/agent-attachments.controller.js";
import { AgentChatController } from "../modules/agent/controller/agent-chat.controller.js";
import { AgentConfigController } from "../modules/agent/controller/agent-config.controller.js";
import { AgentInteractionController } from "../modules/agent/controller/agent-interaction.controller.js";
import { AgentSessionController } from "../modules/agent/controller/agent-session.controller.js";
import { AgentSkillsController } from "../modules/agent/controller/agent-skills.controller.js";
import { AssetsController } from "../modules/assets/controller/assets.controller.js";
import { BookmarksController } from "../modules/bookmarks/controller/bookmarks.controller.js";
import { DocumentCommentsController } from "../modules/documents/controller/document-comments.controller.js";
import { DocumentInvitesController } from "../modules/documents/controller/document-invites.controller.js";
import { DocumentJobsController } from "../modules/documents/controller/document-jobs.controller.js";
import { DocumentsController } from "../modules/documents/controller/documents.controller.js";
import { FoldersController } from "../modules/documents/controller/folders.controller.js";
import { GraphController } from "../modules/documents/controller/graph.controller.js";
import { DomainMemberTemplatesController } from "../modules/domains/controller/domain-member-templates.controller.js";
import { DomainsController } from "../modules/domains/controller/domains.controller.js";
import { McpServersController } from "../modules/mcp/controller/mcp-servers.controller.js";
import { MemesController } from "../modules/memes/controller/memes.controller.js";
import { PluginsController } from "../modules/plugins/controller/plugins.controller.js";
import { TreeController } from "../modules/tree/controller/tree.controller.js";
import { CliTokensController } from "../modules/visitor/controller/cli-tokens.controller.js";
import { VisitorsController } from "../modules/visitor/controller/visitors.controller.js";
import { VisitorAuthMiddleware } from "./middleware/visitor-auth.middleware.js";

/**
 * Nest 组合根：只注册 controller + 全局访客鉴权 middleware。
 * 与 main 同属启动装配，不是业务 module，也不挂在 infra/http 下。
 */
@Module({
  controllers: [
    HealthController,
    ServerSettingsController,
    TreeController,
    VisitorsController,
    CliTokensController,
    PluginsController,
    MemesController,
    McpServersController,
    GraphController,
    FoldersController,
    DocumentsController,
    DocumentJobsController,
    DocumentInvitesController,
    DocumentCommentsController,
    BookmarksController,
    AssetsController,
    AgentAttachmentsController,
    AgentConfigController,
    AgentSkillsController,
    AgentSessionController,
    AgentInteractionController,
    AgentChatController,
    DomainsController,
    DomainMemberTemplatesController,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // 只拦 /api；静态页与 /assets 走 Express static，不能进访客鉴权
    // Express 5 / path-to-regexp v8：通配须命名
    consumer.apply(VisitorAuthMiddleware).forRoutes("api", "api/{*splat}");
  }
}
