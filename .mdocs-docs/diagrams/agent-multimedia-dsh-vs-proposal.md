# Agent 多媒体：DSH 做法 vs mdocs 提议

> 对比 DeepSeek Harness 的 attachment 链路，与 mdocs「Asset + 解析 + 接入」设想。  
> **定稿补充**：不依赖 MarkItDown；解析在 mdocs 内置。正式契约见 [`../requirements/agent-multimedia-assets/`](../requirements/agent-multimedia-assets/)。

## 总览对比

```mermaid
flowchart LR
  subgraph dsh["DSH 现状"]
    D1[上传/提交] --> D2[仅图片进 AttachmentStore]
    D2 --> D3[Session 只存 ImageRef]
    D3 --> D4[发请求前 readImage]
    D4 --> D5["LLM: text + image"]
    D6[工作区普通文件] --> D7[fs / read 工具按需读]
    D7 --> D5
  end

  subgraph prop["mdocs 提议"]
    P1[上传] --> P2[AssetStore staging]
    P2 --> P3[发送时 persisted + Ref]
    P3 --> P4[UI 引用显示]
    P3 --> P5[内置 Parser]
    P5 --> P6{接入 Bridge}
    P6 -->|图| P7[image part]
    P6 -->|小文本| P8[text part]
    P6 -->|太大| P9[read_attachment]
    P7 --> P10["LLM: text + image"]
    P8 --> P10
    P9 --> P10
  end
```

## DSH：图片附件主路径

```mermaid
flowchart TD
  U[用户选图 / 粘贴] --> Draft[浏览器草稿<br/>尚未持久]
  Draft -->|提交 prompt| Save["attachments.saveImage<br/>完整解码 + 校验"]
  Save --> Store[("DSH_HOME/attachments/v1<br/>内容寻址 sha256")]
  Save --> Ref["ImageAttachmentRef<br/>id / mediaType / w×h / bytes"]
  Ref --> Log["Session 日志<br/>content: text | image+ref"]
  Log --> UI[聊天里显示缩略图<br/>按需 RPC 读字节]
  Log --> Prompt[组装模型请求]
  Prompt --> Read["attachments.readImage(ref)"]
  Read --> B64[base64 + mime]
  B64 --> LLM["Provider: image_url / input_image"]

  Note1[非图片文件<br/>不进 attachment 族] -.-> Fs[工作区 fs / read 工具]
  Fs -.-> LLM
```

要点：

- **Store 只服务图片**；会话里永不写宿主路径或 raw bytes
- **发请求时才物化**；历史重放靠 Ref + `readImage`
- **PDF/docx 等**：走工具读工作区，不是「后缀处理器 → 塞进每轮 prompt」

## mdocs 提议：统一 Asset + Adapter

```mermaid
flowchart TD
  Up[用户上传 图/PDF/txt/…] --> Asset[("session/.../assets<br/>或全局 AssetStore")]
  Asset --> Ref2["messages.jsonl<br/>asset_ref + 后缀/mime"]
  Ref2 --> ChatUI[对话框：缩略图 / 文件卡片]

  Ref2 --> Send[本轮发 Agent 请求]
  Send --> Adapt{MediaAdapter<br/>按 kind / 后缀}

  Adapt -->|png jpeg webp gif| Img[→ image ContentPart<br/>原生 Vision]
  Adapt -->|短 txt md csv| Txt[→ text ContentPart<br/>抽文本嵌入]
  Adapt -->|大 PDF/docx 等| Lazy[→ 仅挂 Ref<br/>暴露 read_attachment]
  Adapt -->|未知类型| Skip[UI 可下载<br/>LLM 占位或不支持]

  Img --> Parts["标准 ContentPart<br/>仅 text | image"]
  Txt --> Parts
  Lazy -->|模型调用工具再解析| Parts
  Parts --> DS[DeepSeek / 其它 LLM]
```

与 DSH 的同异：

| | DSH | mdocs 提议 |
|--|-----|------------|
| 落盘对象 | 几乎只有图 | 任意 Asset |
| 会话持久化 | Ref 元数据 | 同：只存 Ref |
| 进 LLM 前 | `readImage` → image part | Adapter → text\|image，或 tool |
| 非图文件 | fs 工具，非 attachment | Asset + 懒 tool / 抽文本 |

## 发请求时序（两边共性）

```mermaid
sequenceDiagram
  participant UI as Chat UI
  participant Sess as Session 日志
  participant Store as Asset / Attachment Store
  participant Adapt as Adapter / Provider
  participant LLM as 模型 API

  UI->>Store: 上传字节（提交时）
  Store-->>UI: Ref
  UI->>Sess: append user message（text + refs）
  Note over Sess: 不写 base64 / 宿主路径

  UI->>Adapt: 开始本轮 prompt
  Adapt->>Sess: 读历史消息（含 Ref）
  Adapt->>Store: 按需 read(ref)
  Store-->>Adapt: 字节
  Adapt->>Adapt: 物化为 text / image parts
  Adapt->>LLM: 标准多模态请求
  LLM-->>UI: 流式回复
```
