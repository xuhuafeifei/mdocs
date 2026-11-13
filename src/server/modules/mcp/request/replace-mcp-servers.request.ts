import { Allow } from "class-validator";

/**
 * PUT body：`{ servers: ... }`。
 * 具体校验在 `replaceMcpServers`（store）内完成，这里只保证字段进得来。
 */
export class ReplaceMcpServersRequest {
  @Allow()
  servers!: unknown;
}
