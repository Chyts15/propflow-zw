import { describe, expect, it } from "vitest";
import { tenantErrorMessage } from "../tenant-errors";

describe("tenantErrorMessage", () => {
  it("turns a bare auth code into something a tenant can act on", () => {
    expect(tenantErrorMessage({ message: "UNAUTHORIZED" })).toMatch(/sign in again/);
    expect(tenantErrorMessage({ message: "FORBIDDEN" })).toMatch(/isn't available/);
  });

  it("never shows other bare codes", () => {
    expect(tenantErrorMessage({ message: "INTERNAL_SERVER_ERROR" })).toBe("Something went wrong. Please try again.");
    expect(tenantErrorMessage({ message: "BAD_REQUEST" }, "We couldn't save that.")).toBe("We couldn't save that.");
  });

  it("leaves a deliberate server message alone", () => {
    expect(tenantErrorMessage({ message: "Too many uploads — try again later" })).toBe("Too many uploads — try again later");
    expect(tenantErrorMessage({ message: "Rent record not found" })).toBe("Rent record not found");
  });

  it("still gets friendlyMessage's handling of Zod dumps and dropped connections", () => {
    expect(tenantErrorMessage({ message: '[{"code":"too_big"}]' })).toMatch(/details look wrong/);
    expect(tenantErrorMessage({ message: "Failed to fetch" })).toMatch(/Couldn't reach PropFlow/);
  });

  it("falls back for an empty message", () => {
    expect(tenantErrorMessage({ message: "" }, "Try later.")).toBe("Try later.");
  });
});
