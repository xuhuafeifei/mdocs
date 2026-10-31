/** 流水线 YAML 结构（执行器/编排器共用）。 */

export type PipelineKind = "system" | "user" | "tenant";

export type PipelineOutput = "mcp" | "skill";

/** 面向用户的「怎么装」；transport（stdio/http）不是安装方式。 */
export type PipelineInstallMode =
  | "local_binary"
  | "command"
  | "remote"
  | "skill_package";

export const PIPELINE_INSTALL_MODES: PipelineInstallMode[] = [
  "local_binary",
  "command",
  "remote",
  "skill_package",
];

export function isPipelineInstallMode(v: string): v is PipelineInstallMode {
  return (PIPELINE_INSTALL_MODES as string[]).includes(v);
}

/** 步骤执行条件 */
export type PipelineStepCondition =
  | "always"
  | "first_install"
  | "probe_passed"
  | "probe_failed";

type StepCommon = {
  /** 缺省 always */
  when?: PipelineStepCondition;
  /** probe 通过时跳过（缺省：download/extract/copy_file 为 true） */
  skip_on_probe?: boolean;
  /** true 时执行器跳过该步骤（编排器可见；避免与 upsert_mcp.enabled 混淆） */
  disabled?: boolean;
};

export type PipelineStep = StepCommon &
  (
    | { type: "download"; url?: string; sha256?: string; dest?: string }
    | { type: "extract"; dest?: string; archive?: string }
    | { type: "copy_file"; from: string; to: string }
    | {
        type: "git_clone";
        url: string;
        /** 相对 {{install_root}}；默认 "."（仓库根 = plugins-home/<name>/） */
        dest?: string;
        branch?: string;
        depth?: number;
      }
    | {
        type: "exec";
        command: string;
        args?: string[];
        cwd?: string;
        env?: Record<string, string>;
        timeout_seconds?: number;
      }
    | {
        type: "upsert_mcp";
        mcp_server_id?: string;
        name: string;
        enabled?: boolean;
        transport: "http" | "stdio";
        url?: string;
        headers?: Record<string, string>;
        command?: string;
        args?: string[];
        cwd?: string;
        env?: Record<string, string>;
      }
    | {
        type: "upsert_skill";
        name: string;
        description?: string;
        body?: string;
        body_file?: string;
      }
    | {
        type: "write_soul_sidecar";
        scope: "global" | "tenant";
        file: string;
        content?: string;
        from?: string;
      }
    | {
        type: "delete_soul_sidecar";
        scope: "global" | "tenant";
        file: string;
      }
    | { type: "remove_mcp"; mcp_server_id?: string }
    | { type: "remove_skill"; name: string }
  );

export type PipelineProbe = {
  type: "file_exists" | "http_health" | "npm_global";
  path?: string;
  url?: string;
  package?: string;
};

export type PluginPipeline = {
  id: string;
  name: string;
  kind: PipelineKind;
  runtime?: string;
  data_key?: string;
  version?: string;
  description?: string;
  install_mode?: PipelineInstallMode;
  outputs: PipelineOutput[];
  probe?: PipelineProbe[];
  steps: PipelineStep[];
  uninstall?: PipelineStep[];
};
