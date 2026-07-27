# 010 — mdocs 上手 Agent：Pi + 包内 Skills + 无写作

- **状态**：accepted（2026-07-24）
- **上下文**：需要产品内上手答疑，但不做写作辅助；手册真源在独立仓库 mdocs-site；多自建实例不宜运行时中心拉取。
- **决策**：
  1. Agent 宿主在 mdocs（非 lobe）；运行时用 Pi；目录倾向 `agent/Config|Agent|Skill`。
  2. 手册：site 真源 → 构建进包内 skills；`skill-loader` 只加载该数据；tools 为 `mdocs_manual_outline` + `mdocs_manual_content`，无 search；system prompt 不嵌入目录。
  3. 仅 DeepSeek；Config 提供 apiKey + endpoint。
  4. **coding 初版砍 multi-session**；无长期记忆；无 UI 高亮；无写作。
- **后果**：发版依赖 site→skills 构建；初版刷新丢对话；写作另期开需求。
- **相关**：[`../requirements/onboarding-ai/需求分析.md`](../requirements/onboarding-ai/需求分析.md)、[`../requirements/onboarding-ai/设计契约.md`](../requirements/onboarding-ai/设计契约.md)
