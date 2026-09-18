/** 开放程度：private < restricted < public。升级 = 变得更开放。 */
const RANK: Record<string, number> = {
  private: 0,
  restricted: 1,
  public: 2,
};

export function domainPermissionRank(permission: string): number | null {
  return Object.prototype.hasOwnProperty.call(RANK, permission) ? RANK[permission]! : null;
}

/** same：不变；upgrade：更开放；downgrade：更封闭；invalid：未知值。 */
export function domainPermissionChange(
  from: string,
  to: string,
): "same" | "upgrade" | "downgrade" | "invalid" {
  const a = domainPermissionRank(from);
  const b = domainPermissionRank(to);
  if (a === null || b === null) return "invalid";
  if (b > a) return "upgrade";
  if (b < a) return "downgrade";
  return "same";
}
