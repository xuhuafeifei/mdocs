/**
 * 步骤类型 / 安装方式 Schema：前端按此渲染表单，避免写死特例。
 * 新增 step type = 这里加定义 + 执行器加 handler。
 */
export type StepFieldType =
  | "text"
  | "textarea"
  | "string_list"
  | "select"
  | "keyvalue"
  | "bool";

export type PipelineStepFieldDef = {
  name: string;
  /** 表单展示名；缺省用 name */
  label?: string;
  type: StepFieldType;
  required?: boolean;
  default?: unknown;
  options?: Array<{ value: string; label: string }>;
  description?: string;
  /** 折叠在「高级参数」里 */
  advanced?: boolean;
  /** 当其它字段等于某值时才显示 */
  visibleWhen?: { field: string; equals: string };
};

export type PipelineStepDefinition = {
  type: string;
  label: string;
  description: string;
  category: "install" | "configure" | "uninstall" | "probe";
  /** 添加步骤面板里的分组名 */
  group: string;
  fields: PipelineStepFieldDef[];
};

export type PipelineInstallModeDefinition = {
  value: "local_binary" | "command" | "remote" | "skill_package";
  label: string;
  description: string;
  /** 默认输出 */
  outputs: Array<"mcp" | "skill">;
  /** 新建向导的起步步骤 */
  starterSteps: Array<Record<string, unknown>>;
};

const WHEN_OPTIONS = [
  { value: "always", label: "总是执行" },
  { value: "first_install", label: "仅首次安装" },
  { value: "probe_passed", label: "检测通过时" },
  { value: "probe_failed", label: "检测未通过时" },
];

export const PIPELINE_INSTALL_MODE_DEFINITIONS: PipelineInstallModeDefinition[] = [
  {
    value: "local_binary",
    label: "本地程序型",
    description: "下载 / 解压本机二进制或运行环境，再以 stdio 注册 MCP。",
    outputs: ["mcp"],
    starterSteps: [
      {
        type: "download",
        url: "",
      },
      {
        type: "extract",
        dest: "bin",
      },
      {
        type: "upsert_mcp",
        name: "My MCP",
        enabled: true,
        transport: "stdio",
        command: "bin/my-mcp",
        args: [],
      },
    ],
  },
  {
    value: "command",
    label: "命令启动型",
    description: "npx / uvx / node / python 等命令直接启动，不下载安装物。",
    outputs: ["mcp"],
    starterSteps: [
      {
        type: "upsert_mcp",
        name: "My MCP",
        enabled: true,
        transport: "stdio",
        command: "npx",
        args: ["-y", "@scope/mcp-server"],
      },
    ],
  },
  {
    value: "remote",
    label: "远程服务型",
    description: "远程 MCP Server（HTTP / Streamable HTTP），只需 URL 与认证头。",
    outputs: ["mcp"],
    starterSteps: [
      {
        type: "upsert_mcp",
        name: "My MCP",
        enabled: true,
        transport: "http",
        url: "https://example.com/mcp",
        headers: {},
      },
    ],
  },
  {
    value: "skill_package",
    label: "Skill 包",
    description: "下载或直接注册一份 Skill（提示词 / 知识 / 工作流）。",
    outputs: ["skill"],
    starterSteps: [
      {
        type: "upsert_skill",
        name: "my_skill",
        description: "",
        body: "# My Skill\n\n说明这个 Skill 何时使用。",
      },
    ],
  },
];

export const PIPELINE_STEP_DEFINITIONS: PipelineStepDefinition[] = [
  {
    type: "download",
    label: "下载文件",
    description:
      "从 URL 获取安装包到插件安装目录。支持 {{version}} / {{goos}} / {{goarch}} 等模板变量；Engram 等系统插件留空由系统选镜像。",
    category: "install",
    group: "下载与安装",
    fields: [
      {
        name: "url",
        label: "下载地址",
        type: "textarea",
        description:
          "例如 https://host/pkg_{{goos}}_{{goarch}}.tar.gz。留空：runtime 有内置下载源时由系统补全。",
      },
      {
        name: "sha256",
        label: "SHA256 校验",
        type: "text",
        description: "可选；填了就会校验，失败即中止。",
        advanced: true,
      },
      {
        name: "dest",
        label: "保存为",
        type: "text",
        description: "相对安装目录，默认 pkg/<文件名>。",
        advanced: true,
      },
    ],
  },
  {
    type: "extract",
    label: "解压文件",
    description: "解压 pkg 目录里的压缩包（.tar.gz / .zip）。",
    category: "install",
    group: "下载与安装",
    fields: [
      {
        name: "dest",
        label: "解压到",
        type: "text",
        description: "相对安装目录，默认安装根目录。常见填 bin。",
        default: ".",
      },
      {
        name: "archive",
        label: "指定压缩包",
        type: "text",
        description: "可选；默认取 pkg 目录里最新的压缩包。",
        advanced: true,
      },
    ],
  },
  {
    type: "copy_file",
    label: "复制文件",
    description: "在安装目录内复制 / 重命名文件（例如把二进制放进 bin/）。",
    category: "install",
    group: "下载与安装",
    fields: [
      { name: "from", label: "源文件", type: "text", required: true },
      { name: "to", label: "目标路径", type: "text", required: true },
    ],
  },
  {
    type: "exec",
    label: "执行命令",
    description:
      "在本机执行安装 / 初始化命令。命令可相对安装目录；输出会实时进入安装日志。",
    category: "install",
    group: "命令与环境",
    fields: [
      {
        name: "command",
        label: "程序",
        type: "text",
        required: true,
        description: "例如 bin/engram 或 npx。",
      },
      {
        name: "args",
        label: "参数（每行一个）",
        type: "string_list",
        default: [],
      },
      {
        name: "cwd",
        label: "工作目录",
        type: "text",
        description: "相对安装目录；也可用 {{plugins_data}}/...。",
        advanced: true,
      },
      {
        name: "env",
        label: "环境变量",
        type: "keyvalue",
        description: "每行 KEY=value。",
        advanced: true,
      },
      {
        name: "timeout_seconds",
        label: "超时（秒）",
        type: "text",
        default: "300",
        advanced: true,
      },
    ],
  },
  {
    type: "upsert_mcp",
    label: "注册 MCP",
    description:
      "告诉 Agent 以后怎么拉起这个 MCP。本地程序填「程序 + 参数」；远程服务填 URL；传输方式只在这里出现。",
    category: "configure",
    group: "注册能力",
    fields: [
      { name: "name", label: "显示名称", type: "text", required: true },
      { name: "enabled", label: "启用", type: "bool", default: true },
      {
        name: "transport",
        label: "传输方式",
        type: "select",
        required: true,
        default: "stdio",
        options: [
          { value: "stdio", label: "stdio（本机进程）" },
          { value: "http", label: "HTTP（远程服务）" },
        ],
      },
      {
        name: "command",
        label: "启动程序",
        type: "text",
        description: "相对安装目录会自动解析成真实路径。",
        visibleWhen: { field: "transport", equals: "stdio" },
      },
      {
        name: "args",
        label: "启动参数（每行一个）",
        type: "string_list",
        description: "访客隔离参数由系统注入，不用你填。",
        visibleWhen: { field: "transport", equals: "stdio" },
      },
      {
        name: "cwd",
        label: "工作目录",
        type: "text",
        advanced: true,
        visibleWhen: { field: "transport", equals: "stdio" },
      },
      {
        name: "env",
        label: "环境变量",
        type: "keyvalue",
        advanced: true,
        visibleWhen: { field: "transport", equals: "stdio" },
      },
      {
        name: "url",
        label: "服务地址",
        type: "text",
        description: "例如 https://host/mcp 或 http://127.0.0.1:3211/mcp",
        visibleWhen: { field: "transport", equals: "http" },
      },
      {
        name: "headers",
        label: "请求头",
        type: "keyvalue",
        advanced: true,
        description: "每行 KEY=value，例如 Authorization=Bearer …",
        visibleWhen: { field: "transport", equals: "http" },
      },
      {
        name: "mcp_server_id",
        label: "MCP 编号",
        type: "text",
        description: "默认 plugin-<流水线 id>，一般不用改。",
        advanced: true,
      },
    ],
  },
  {
    type: "upsert_skill",
    label: "注册 Skill",
    description: "写入当前访客的 agent_user_skills。",
    category: "configure",
    group: "注册能力",
    fields: [
      { name: "name", label: "Skill 名称", type: "text", required: true },
      { name: "description", label: "一句话描述", type: "text" },
      {
        name: "body_file",
        label: "正文文件",
        type: "text",
        description: "相对安装目录；与正文二选一。",
      },
      {
        name: "body",
        label: "正文 Markdown",
        type: "textarea",
      },
    ],
  },
  {
    type: "write_soul_sidecar",
    label: "写入灵魂旁路",
    description: "在 soul/ 下写一份独立 Markdown，随安装注入 Agent 系统提示；卸载可删。",
    category: "configure",
    group: "注册能力",
    fields: [
      {
        name: "scope",
        label: "作用域",
        type: "select",
        required: true,
        default: "global",
        options: [
          { value: "global", label: "全局 soul/" },
          { value: "tenant", label: "个人 tenant/…/soul/" },
        ],
      },
      { name: "file", label: "文件名", type: "text", required: true },
      { name: "content", label: "正文", type: "textarea" },
      {
        name: "from",
        label: "从安装物复制",
        type: "text",
        description: "相对安装目录的 .md；与正文二选一。",
      },
    ],
  },
  {
    type: "delete_soul_sidecar",
    label: "删除灵魂旁路",
    description: "卸载时删除安装时写入的旁路文件。",
    category: "uninstall",
    group: "清理",
    fields: [
      {
        name: "scope",
        label: "作用域",
        type: "select",
        required: true,
        default: "global",
        options: [
          { value: "global", label: "全局" },
          { value: "tenant", label: "个人" },
        ],
      },
      { name: "file", label: "文件名", type: "text", required: true },
    ],
  },
  {
    type: "remove_mcp",
    label: "移除 MCP",
    description: "从 mcp-servers.json 删除对应项；留空按流水线 id 删。",
    category: "uninstall",
    group: "清理",
    fields: [
      {
        name: "mcp_server_id",
        label: "MCP 编号",
        type: "text",
        description: "默认 plugin-<流水线 id>。",
      },
    ],
  },
  {
    type: "remove_skill",
    label: "移除 Skill",
    description: "从当前访客的 agent_user_skills 删除同名项。",
    category: "uninstall",
    group: "清理",
    fields: [{ name: "name", label: "Skill 名称", type: "text", required: true }],
  },
];

export const PIPELINE_PROBE_DEFINITIONS: PipelineStepDefinition[] = [
  {
    type: "file_exists",
    label: "文件存在",
    description: "相对安装目录的路径存在，视为已安装；可跳过下载类步骤。",
    category: "probe",
    group: "安装检测",
    fields: [{ name: "path", label: "相对路径", type: "text", required: true }],
  },
  {
    type: "http_health",
    label: "HTTP 健康检查",
    description: "URL 返回 2xx 视为已就绪。",
    category: "probe",
    group: "安装检测",
    fields: [{ name: "url", label: "URL", type: "text", required: true }],
  },
  {
    type: "npm_global",
    label: "npm 全局包",
    description: "npm list -g 已有该包则视为已就绪。",
    category: "probe",
    group: "安装检测",
    fields: [{ name: "package", label: "包名", type: "text", required: true }],
  },
];

export function listStepDefinitions(): {
  steps: PipelineStepDefinition[];
  probes: PipelineStepDefinition[];
  installModes: PipelineInstallModeDefinition[];
  whenOptions: Array<{ value: string; label: string }>;
} {
  return {
    steps: PIPELINE_STEP_DEFINITIONS,
    probes: PIPELINE_PROBE_DEFINITIONS,
    installModes: PIPELINE_INSTALL_MODE_DEFINITIONS,
    whenOptions: WHEN_OPTIONS,
  };
}
