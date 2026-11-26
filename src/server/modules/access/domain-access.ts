/**
 * 域入口类型与图谱判定。
 *
 * 入口规则实现在 access.ts 内部（不对外暴露）；业务只用
 * `canEnterDomain` / `canEnterDomains` / `canFullyAccessDomain`。
 */

export type DomainAccessKind = "none" | "full" | "viaDocumentInvites";

export interface DomainAccess {
  kind: DomainAccessKind;
}

/**
 * 能否读/生成该域图谱。
 * 只认协作身份 full；viaDocumentInvites（只借单篇正文）不授图谱。
 * 见 `.mdocs-docs/requirements/knowledge-graph/设计契约-graph-access.md`。
 */
export function canAccessGraph(access: DomainAccess): boolean {
  return access.kind === "full";
}
