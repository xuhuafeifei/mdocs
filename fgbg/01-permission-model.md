# 权限模型设计

## 核心原则

- **域限定文件档位（public / restricted）**：**public**、**restricted** 两类域内，文件 `permission` 只能落在各自**固定集合**内（见下表）。**private 域不在此列**——见下节。
- **private 域：文件档位可任意设置**：`private(0)`～`public_write(4)` **均可**；owner 想怎么改就怎么改，服务端**允许**落库。通过**界面文案**在选档时做风险提示（见「private 域选档提示」）。
- **五级权限**：语义如下表；鉴权仍按五档 + **invite** + 域上下文计算。
- **invite**：默认圈外的人按文档单独授予 `read` / `write`；与域成员**互斥**（已是该域成员则禁止 invite）。**每次读、写前**重算鉴权。

## 五级权限（语义参考）

| 数值 | 名称 | 读范围 | 写范围 |
|------|------|--------|--------|
| 0 | private | owner | owner |
| 1 | domain_read | 域成员 | owner |
| 2 | domain_write | 域成员 | 域成员 |
| 3 | public_read | 任何人 | owner |
| 4 | public_write | 任何人 | 任何人 |

## 域类型 × 允许的文件档位

| 域类型 | 允许的文件 `permission` | 说明 |
|--------|--------------------------|------|
| **public** | **仅** `public_read(3)`、`public_write(4)` | 公开域 |
| **restricted** | **仅** `domain_read(1)`、`domain_write(2)` | 不出现 `private` / `public_*` |
| **private** | **`private(0)`～`public_write(4)` 全部** | 不设档位上限；用 UI 提示帮 owner 理解后果 |

## private 域：成员模型（规范）

- **private 域不支持多名域成员**：不引入 `domain_members` 多行；**唯一**域内成员即 **域主**（个人域下 `domain_id === owner_visitor_id` 的那位）。鉴权与产品文案均按此不变量实现。

## private 域选档提示（产品 / 前端）

在 **private 域** 内为某篇文档选择档位时：

1. **`domain_read` / `domain_write`**  
   须提示：**私有域只有您一名域成员**，因此选「域可读 / 域可写」与选 **`private(0)` 对您而言效果没有实质差异**。

2. **`public_read` / `public_write`**（无 `public_edit` 档位名，即 `public_write`）  
   须**说明清楚**五档含义：例如「任何人可读」「任何人可写」——在**名称仍叫 private 域**的上下文中，用户容易误以为全文仍完全私密；**必须**明确告知与 `private(0)` 的差异及外泄面。是否进入**全站搜索 / 发现列表**等与「任何人可读」并列的产品策略可另表，但**鉴权语义**须与五档一致。

## 域级能力 vs 单篇文件权限

- **单篇**：读/写/可见 = 该文件 **`permission`** + **invite** + 域类型上下文；**编辑**只走文件级规则。
- **域**：另管是否**看得到域**、是否**能在域内添加**新文件等（见 `02` 等）。
- **删除**：**仅**资源 **owner（创建者）**。

## 目录节点（dir）与 desc.md

- **`type=dir`** 与自动创建的 **`desc.md`**：**owner = 创建者**；删除、改档、invite 管理与「仅 owner」一致。
- 其 `permission` 须满足**所在域**允许集合（**private 域**下同样 **0～4 均可**，并适用同上「选档提示」）。

## 用户可见范围（列表 / 目录树 / 搜索）

一条文档若满足以下**任一**条件，则对该用户**可见**（打开另由 `canRead` / `canEdit`）：

1. **自己是 owner**。
2. **public 域**：能进入该域时，可见域内全部合法文档（仅 3/4 档）。
3. **restricted 域**：**域成员**见树与合法文档（仅 1/2 档）；非成员不进树，圈外靠 **invite**（及受控链策略，与鉴权一致）。
4. **private 域**：按该文档**实际档位**的五档语义 + **invite** 聚合（例如 `private(0)` 圈外主要靠 invite；`public_read` / `public_write` 则按「任何人」等语义进入可见性）。

## invite

### 适用范围

- **restricted**（仅 1/2 档）：非成员靠 invite。
- **public**（仅 3/4 档）：可对非 owner **补写**等；`public_write` **不建 invite**。
- **private**（0～4）：圈外是否可读/写仍看五档 + invite；**invite 与域成员互斥**。

### 实现约束

- 已是该文档所在域的**域成员** → **禁止**再挂 invite。
- **private 域**：域成员**仅域主一人**（`domain_id` 即其 `visitor_id`）；对该 visitor **禁止**创建 invite（实现上拒绝即可）。

### invite 表

- `(document_id, visitor_id, permission)`，`permission` ∈ { `read`, `write` }（`write` 含读）。
- 初次可直接 `write`；`read` → `write` 同一行更新；可撤销或降权。

> 「申请权限」流程当前不做，见 [`TODO.md`](./TODO.md)。

## 鉴权顺序（读 / 写前必跑）

1. **Owner**
2. **public 域**：仅 3/4 档语义
3. **restricted 域**：成员 → 1/2 档；非成员 → **invite**（域内无 3/4 档）
4. **private 域**：非 owner → 该文件五档语义 + **invite**
5. **Invite** 叠加

```
inviteRead  = 存在 invite 行且 permission ∈ { read, write }
inviteWrite = 存在 invite 行且 permission = write

canRead  = isOwner || permissionAllowsRead || inviteRead
canEdit  = isOwner || permissionAllowsWrite || inviteWrite
```

## 创建默认值

| 域类型 | 默认文件权限 |
|--------|-------------|
| private | 0 (private) |
| restricted | 1 (domain_read) |
| public | 3 (public_read) |

## 答疑（存档）

1. **restricted 里是否还有 public_read？** **无**；非成员靠 invite。
2. **private 域能否设 public 档？** **能**；须 UI 说清语义；鉴权按五档执行。**private 域永不支持多名域成员**（仅域主一人）。
3. **`dir` / `desc.md`？** owner = 创建者；档位遵守所在域允许集合（private 下 0～4 均可）。
