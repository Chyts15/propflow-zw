import { afterEach, describe, expect, it, vi } from "vitest";
import { isAuthorizedCronRequest, rejectUnauthorizedCron } from "../cron-auth";

const request = (authorization?: string) =>
  new Request("https://propflow.example/api/cron/trial-expiry", {
    headers: authorization ? { authorization } : {},
  });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("isAuthorizedCronRequest", () => {
  it("accepts exactly the bearer secret", () => {
    expect(isAuthorizedCronRequest("Bearer s3cret", "s3cret")).toBe(true);
  });

  it("refuses every request when no secret is configured, even one that sends nothing", () => {
    expect(isAuthorizedCronRequest(null, undefined)).toBe(false);
    expect(isAuthorizedCronRequest("Bearer undefined", undefined)).toBe(false);
    expect(isAuthorizedCronRequest("Bearer ", "")).toBe(false);
    expect(isAuthorizedCronRequest("", "")).toBe(false);
  });

  it("refuses a missing, wrong, differently-cased or differently-sized header", () => {
    expect(isAuthorizedCronRequest(null, "s3cret")).toBe(false);
    expect(isAuthorizedCronRequest("Bearer wrong!", "s3cret")).toBe(false);
    expect(isAuthorizedCronRequest("bearer s3cret", "s3cret")).toBe(false);
    expect(isAuthorizedCronRequest("Bearer s3cret-and-more", "s3cret")).toBe(false);
    expect(isAuthorizedCronRequest("s3cret", "s3cret")).toBe(false);
  });
});

describe("rejectUnauthorizedCron", () => {
  it("lets a correct request through", () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect(rejectUnauthorizedCron(request("Bearer s3cret"))).toBeNull();
  });

  it("answers 401 to a wrong request", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const res = rejectUnauthorizedCron(request("Bearer nope"));
    expect(res?.status).toBe(401);
  });

  it("answers 401 and says why in the log when CRON_SECRET is missing", () => {
    vi.stubEnv("CRON_SECRET", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = rejectUnauthorizedCron(request());
    expect(res?.status).toBe(401);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("CRON_SECRET is not set"));
  });
});
