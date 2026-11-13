import { Module } from "@nestjs/common";
import { ServerSettingsController } from "../infra/config/server-settings.controller.js";
import { TreeController } from "../modules/tree/controller/tree.controller.js";
import { VisitorsController } from "../modules/visitor/controller/visitors.controller.js";

/**
 * Nest 组合根：只注册 controller，不含业务逻辑。
 * 与 main 同属启动装配，不是业务 module，也不挂在 infra/http 下。
 */
@Module({
  controllers: [ServerSettingsController, TreeController, VisitorsController],
})
export class NestAppModule {}
