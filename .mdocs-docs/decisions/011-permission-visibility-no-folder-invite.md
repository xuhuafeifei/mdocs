# 011 — 权限可见性粒度：域成员 / 文档邀请，无目录级邀请

> 状态：已采纳（2026-09-10）  
> 背景：产品讨论「能否邀请某人到某目录，使目录下全部文章可见」；结论写入契约，避免 Agent/实现误当成文件夹 ACL。

## 决策

**可见性只有两层「圈人」机制，没有目录级邀请。**

| 机制 | 粒度 | 效果 |
|------|------|------|
| 域成员 `domain_members` | **整个域** | `restricted` 域：成员可见树入口，并按文档档位 `domain_read`/`domain_write` 读/写 |
| 文档邀请 `document_invites` | **单篇文档**（含目录节点自身若被 invite，**不**自动覆盖子树） | 对圈外访客授 `read` 或 `edit`；与域成员互斥 |

**不存在**：`folder_invites`、目录 ACL 继承、「邀请进目录 → 子树全部可见」。

## 若要让某人看见某目录下所有文章

现实选项（按推荐序）：

1. **放进 `restricted` 域并加为域成员**（整域可见，不只一个文件夹）  
2. **对该目录下每篇需要的文档分别 invite**（无批量目录继承）  
3. **调高文档/域公开档位**（`public_read` 等，面向所有人而非某人）

点「目录」在树上不等于对该文件夹做了 ACL；目录行与子文档行各自独立鉴权。

## 与图谱的交叉

> 权威稿：[`../requirements/knowledge-graph/设计契约-graph-access.md`](../requirements/knowledge-graph/设计契约-graph-access.md)（已同意 2026-09-10）

图谱跟 **域协作身份**（`resolveDomainAccess.kind`），**不跟** 单篇 invite：

| 域类型 | 读 / 生成图谱 |
|--------|----------------|
| `private` | 仅 `full`（本人） |
| `restricted` | 仅 `full`（成员/创建者） |
| `public` | 非 `none`（人人可生成，须登录+AI 配置） |

`viaDocumentInvites`：只借正文，**屏蔽图谱**（防残缺写盘中毒 + 全貌读盘泄密）。  
**不改变** 上文「无目录级邀请」的可见性粒度。

## 后果

- UI / CLI / Agent 不得假设「invite 目录 = 子树可读」  
- 树过滤、搜索过滤仍按 **每篇** `canReadDocument`  
- 将来若做「目录邀请」，须新需求 + 显式继承规则，不得 silently 改本决策

## 代码入口

见 [`../map/identity-auth.md`](../map/identity-auth.md)、[`../archive/auth-and-access-control.md`](../archive/auth-and-access-control.md)
