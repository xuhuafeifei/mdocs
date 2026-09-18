import { describe, expect, it } from "vitest";
import { domainPermissionChange } from "./domainPermissionRank";

describe("domainPermissionChange", () => {
  it("allows upgrades and rejects downgrades", () => {
    expect(domainPermissionChange("private", "restricted")).toBe("upgrade");
    expect(domainPermissionChange("private", "public")).toBe("upgrade");
    expect(domainPermissionChange("restricted", "public")).toBe("upgrade");
    expect(domainPermissionChange("public", "restricted")).toBe("downgrade");
    expect(domainPermissionChange("public", "private")).toBe("downgrade");
    expect(domainPermissionChange("restricted", "private")).toBe("downgrade");
    expect(domainPermissionChange("public", "public")).toBe("same");
    expect(domainPermissionChange("nope", "public")).toBe("invalid");
  });
});
