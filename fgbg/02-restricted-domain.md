# Restricted 域设计

## 成员制

- restricted 域有成员列表（`domain_members` 表，当前预留）
- 成员进域后，域内文件档位**仅**可为 `domain_read(1)` / `domain_write(2)`（见 `01-permission-model.md`「域类型 × 允许的文件档位」）
- 非成员看不到域目录树

## 跨团队协作

- 不想拉外部团队进域时，将文件保持在 `domain_read` / `domain_write`，对圈外人用 **invite**（`read` / `write`）
- 外部人员**无需**成为域成员；通过 **invite**（及若实现的**受控分享链接**，仍须与 invite 鉴权一致）访问
- 被 invite 的外部人员按 **invite 行的 `permission`** 获得读或写（见 `01-permission-model.md`）

## 与 public 域的区别

|        | restricted     | public         |
| ------ | -------------- | -------------- |
| 谁能进域   | 域成员            | 任何人            |
| 文件允许档位 | **仅** domain_read / domain_write | **仅** public_read / public_write |
| 目录树可见性 | 仅成员            | 所有人            |
| 非成员看域内文档 | **invite**（或受控链 + 鉴权）；域内**无** public 档可「任何人可读」绕开 | 按 public 档「任何人」语义 |
