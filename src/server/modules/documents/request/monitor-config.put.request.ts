import { IsArray, IsOptional } from "class-validator";

export class MonitorConfigPutRequest {
  @IsOptional()
  @IsArray()
  rules?: Array<{ monitorId?: string; rule?: string; threshold?: number }>;

  @IsOptional()
  @IsArray()
  MonitorConfig?: Array<{ monitorId?: string; rule?: string; threshold?: number }>;

  resolveRules(): Array<{ monitorId?: string; rule?: string; threshold?: number }> {
    const rules = this.rules ?? this.MonitorConfig;
    if (!Array.isArray(rules)) {
      throw new Error("rules (or MonitorConfig) array is required");
    }
    return rules;
  }
}
