import { apiRelativePath } from "./visitor-auth.middleware";

describe("apiRelativePath", () => {
  it("normalizes the full request path used by Nest middleware", () => {
    expect(
      apiRelativePath({
        originalUrl: "/api/visitors/register?source=web",
        url: "/visitors/register?source=web",
        path: "/visitors/register",
        baseUrl: "/api",
      } as never),
    ).toBe("/visitors/register");
  });

  it("keeps an already relative API path unchanged", () => {
    expect(
      apiRelativePath({
        originalUrl: "/visitors/login",
        url: "/visitors/login",
        path: "/visitors/login",
        baseUrl: "/api",
      } as never),
    ).toBe("/visitors/login");
  });
});
