/**
 * agent_model_configs 表实体（蛇形，含 ALTER 后的列）。
 */

/** 表 agent_model_configs */
export interface AgentModelConfigs {
  id: string;
  owner_visitor_id: string;
  name: string;
  provider: string;
  kind: string;
  provider_id: string | null;
  base_url: string | null;
  api_type: string;
  compat_json: string | null;
  model_id: string;
  api_key: string;
  context_window: number;
  /** 单次模型输出上限（含思考与工具参数） */
  max_output_tokens: number;
  /** off | low | high | max */
  thinking_level: string;
  /** 单轮 Agent 后台运行超时（秒） */
  run_timeout_seconds: number;
  is_default: number;
  updated_at: string;
}
