import { describe, expect, it, vi } from "vitest";
import {
  INVITE_TTL_DAYS,
  RESEND_COOLDOWN_SECONDS,
  clerkErrorCodes,
  inviteFailure,
  noInviteReason,
  parseInviteMetadata,
  resendWaitSeconds,
  scanInvitations,
  toPendingInvites,
  type InvitationLike,
} from "../invites";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 5, 22, 10, 0, 0);

const units = new Map([
  ["unit04", { unitNumber: "04", propertyName: "Borrowdale Flats" }],
  ["unit07", { unitNumber: "07", propertyName: "Avondale Court" }],
]);

function invite(overrides: Partial<InvitationLike> = {}): InvitationLike {
  return {
    id: "inv_1",
    emailAddress: "chipo@example.co.zw",
    status: "pending",
    createdAt: now - 2 * DAY,
    publicMetadata: { role: "TENANT", unitId: "unit04", name: "Chipo Mutasa", rentDueDay: 5 },
    ...overrides,
  };
}

describe("parseInviteMetadata", () => {
  it("reads the unit, name and rent day a landlord set", () => {
    expect(parseInviteMetadata({ role: "TENANT", unitId: "unit04", name: " Chipo Mutasa ", rentDueDay: 5 })).toEqual({
      unitId: "unit04",
      name: "Chipo Mutasa",
      rentDueDay: 5,
    });
  });

  it("ignores any invitation that isn't a tenant-onto-a-unit invitation", () => {
    expect(parseInviteMetadata(null)).toBeNull();
    expect(parseInviteMetadata({})).toBeNull();
    expect(parseInviteMetadata({ role: "LANDLORD", unitId: "unit04" })).toBeNull();
    expect(parseInviteMetadata({ role: "TENANT" })).toBeNull();
    expect(parseInviteMetadata({ role: "TENANT", unitId: "" })).toBeNull();
    expect(parseInviteMetadata({ role: "TENANT", unitId: 12 })).toBeNull();
  });

  it("falls back to the 1st for a missing or out-of-range rent day", () => {
    expect(parseInviteMetadata({ role: "TENANT", unitId: "u" })?.rentDueDay).toBe(1);
    expect(parseInviteMetadata({ role: "TENANT", unitId: "u", rentDueDay: 99 })?.rentDueDay).toBe(28);
    expect(parseInviteMetadata({ role: "TENANT", unitId: "u", rentDueDay: 1.5 })?.rentDueDay).toBe(1);
  });
});

describe("toPendingInvites", () => {
  it("labels the invite with the unit and property and works out the expiry", () => {
    const [result] = toPendingInvites([invite()], units, now);
    expect(result).toMatchObject({
      id: "inv_1",
      name: "Chipo Mutasa",
      email: "chipo@example.co.zw",
      unitId: "unit04",
      unitLabel: "Unit 04 · Borrowdale Flats",
      rentDueDay: 5,
    });
    expect(result.expiresAt - result.invitedAt).toBe(INVITE_TTL_DAYS * DAY);
  });

  it("drops invitations for units that aren't this landlord's vacant units", () => {
    const foreign = invite({ id: "inv_2", publicMetadata: { role: "TENANT", unitId: "someone-elses", name: "Tendai" } });
    expect(toPendingInvites([foreign], units, now)).toEqual([]);
  });

  it("drops accepted, revoked and expired invitations and landlord-style invitations", () => {
    const list = [
      invite({ id: "a", status: "accepted" }),
      invite({ id: "b", status: "revoked" }),
      invite({ id: "c", status: "expired" }),
      invite({ id: "d", publicMetadata: { role: "LANDLORD" } }),
      invite({ id: "e", createdAt: now - (INVITE_TTL_DAYS + 1) * DAY }),
    ];
    expect(toPendingInvites(list, units, now)).toEqual([]);
  });

  it("uses the email when the invitation has no name, and lists the newest first", () => {
    const older = invite({ id: "old", createdAt: now - 5 * DAY });
    const newer = invite({
      id: "new",
      emailAddress: "tendai@example.co.zw",
      createdAt: now - DAY,
      publicMetadata: { role: "TENANT", unitId: "unit07" },
    });
    const result = toPendingInvites([older, newer], units, now);
    expect(result.map((r) => r.id)).toEqual(["new", "old"]);
    expect(result[0].name).toBe("tendai@example.co.zw");
  });
});

describe("resendWaitSeconds", () => {
  it("makes a landlord wait out the cooldown after a send", () => {
    expect(resendWaitSeconds(now, now)).toBe(RESEND_COOLDOWN_SECONDS);
    expect(resendWaitSeconds(now - 30_000, now)).toBe(RESEND_COOLDOWN_SECONDS - 30);
  });

  it("allows a resend once the cooldown has passed", () => {
    expect(resendWaitSeconds(now - RESEND_COOLDOWN_SECONDS * 1000, now)).toBe(0);
    expect(resendWaitSeconds(now - DAY, now)).toBe(0);
  });

  it("doesn't let a clock-skewed future timestamp lock a resend for longer than the cooldown", () => {
    expect(resendWaitSeconds(now + 60_000, now)).toBe(RESEND_COOLDOWN_SECONDS);
  });
});

describe("noInviteReason", () => {
  it("explains each way the button can be off", () => {
    expect(noInviteReason({ unitCount: 0, vacantCount: 0, pendingCount: 0 })).toMatch(/add a unit/i);
    expect(noInviteReason({ unitCount: 5, vacantCount: 0, pendingCount: 0 })).toMatch(/already has a tenant/i);
    expect(noInviteReason({ unitCount: 5, vacantCount: 2, pendingCount: 2 })).toMatch(/invitation waiting/i);
  });

  it("is null while at least one vacant unit has no invitation", () => {
    expect(noInviteReason({ unitCount: 5, vacantCount: 2, pendingCount: 1 })).toBeNull();
    expect(noInviteReason({ unitCount: 5, vacantCount: 3, pendingCount: 0 })).toBeNull();
  });
});

describe("clerkErrorCodes", () => {
  it("returns only the machine codes", () => {
    expect(clerkErrorCodes({ errors: [{ code: "form_param_format_invalid", longMessage: "chipo@x is bad" }, { message: "x" }] })).toEqual([
      "form_param_format_invalid",
    ]);
    expect(clerkErrorCodes(new Error("boom"))).toEqual([]);
    expect(clerkErrorCodes(null)).toEqual([]);
  });
});

describe("inviteFailure", () => {
  it("never repeats Clerk's own wording, which can contain the tenant's email", () => {
    const err = Object.assign(new Error("Unprocessable Entity"), {
      status: 422,
      errors: [{ code: "form_param_format_invalid", message: "chipo@example.co.zw is not valid", longMessage: "chipo@example.co.zw is not a valid email" }],
    });
    const failure = inviteFailure(err);
    expect(failure.message).not.toContain("chipo");
    expect(failure.message).not.toContain("Unprocessable");
    expect(failure.trpcCode).toBe("BAD_REQUEST");
    expect(JSON.stringify(failure.log)).not.toContain("chipo");
    expect(failure.log).toEqual({ status: 422, codes: ["form_param_format_invalid"] });
  });

  it("says plainly when the email already has an account or invitation", () => {
    const failure = inviteFailure({ status: 422, errors: [{ code: "duplicate_record" }] });
    expect(failure.trpcCode).toBe("CONFLICT");
    expect(failure.message).toMatch(/already has a PropFlow account or a pending invitation/);
  });

  it("tells the landlord what to do when Clerk refuses the address under a code we do not know", () => {
    const failure = inviteFailure(
      Object.assign(new Error("Unprocessable Entity"), {
        status: 422,
        errors: [{ code: "some_code_clerk_has_not_documented", message: "chipo@example.co.zw is taken" }],
      }),
    );
    expect(failure.trpcCode).toBe("BAD_REQUEST");
    expect(failure.message).toMatch(/already have a PropFlow account or a pending invitation/);
    expect(failure.message).not.toContain("chipo");
    // The unknown code is kept in the log, which is how the real one gets found.
    expect(failure.log).toEqual({ status: 422, codes: ["some_code_clerk_has_not_documented"] });
  });

  it("keeps the specific messages ahead of the 422 fallback", () => {
    expect(inviteFailure({ status: 422, errors: [{ code: "form_identifier_exists" }] }).trpcCode).toBe("CONFLICT");
    expect(inviteFailure({ status: 422, errors: [{ code: "form_param_format_invalid" }] }).message).toMatch(/doesn't look right/);
  });

  it("maps a rate limit and falls back to a calm generic message for anything else", () => {
    expect(inviteFailure({ status: 429 }).trpcCode).toBe("TOO_MANY_REQUESTS");
    const unknown = inviteFailure(Object.assign(new Error("Forbidden"), { status: 403 }));
    expect(unknown.trpcCode).toBe("INTERNAL_SERVER_ERROR");
    expect(unknown.message).not.toContain("Forbidden");
    expect(unknown.message).toMatch(/try again/i);
  });
});

describe("scanInvitations", () => {
  // A stand-in for Clerk: `total` invitations, newest first, handed out a page at a time.
  const clerk = (total: number) => {
    const rows = Array.from({ length: total }, (_, i) => invite({ id: `inv_${i}` }));
    const fetchPage = vi.fn(async (offset: number, limit: number) => ({ data: rows.slice(offset, offset + limit), totalCount: total }));
    return fetchPage;
  };
  const options = { pageSize: 100, maxPages: 5 };

  it("reads everything and says the list is complete when it fits", async () => {
    const result = await scanInvitations(clerk(250), options);
    expect(result.all).toHaveLength(250);
    expect(result.truncated).toBe(false);
  });

  it("stops after one request when the first page is the last", async () => {
    const fetchPage = clerk(40);
    const result = await scanInvitations(fetchPage, options);
    expect(result.all).toHaveLength(40);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("handles an empty instance", async () => {
    expect(await scanInvitations(clerk(0), options)).toEqual({ all: [], truncated: false });
  });

  it("is complete, not truncated, when the invitations exactly fill the ceiling", async () => {
    const result = await scanInvitations(clerk(500), options);
    expect(result.all).toHaveLength(500);
    expect(result.truncated).toBe(false);
  });

  it("says the list is incomplete when the ceiling stops the scan with invitations left", async () => {
    const fetchPage = clerk(501);
    const result = await scanInvitations(fetchPage, options);
    expect(result.all).toHaveLength(500);
    expect(result.truncated).toBe(true);
    expect(fetchPage).toHaveBeenCalledTimes(5);
  });

  it("asks for each page at the right offset, newest first", async () => {
    const fetchPage = clerk(250);
    await scanInvitations(fetchPage, options);
    expect(fetchPage.mock.calls).toEqual([
      [0, 100],
      [100, 100],
      [200, 100],
    ]);
  });
});
