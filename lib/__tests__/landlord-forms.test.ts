import { describe, expect, it } from "vitest";
import {
  firstErrorField,
  parseNumber,
  validateInvite,
  validateProperty,
  validateUnit,
} from "../landlord-forms";

describe("parseNumber", () => {
  it("treats empty text as NaN, not 0", () => {
    expect(parseNumber("")).toBeNaN();
    expect(parseNumber("   ")).toBeNaN();
    expect(parseNumber("abc")).toBeNaN();
    expect(parseNumber("250")).toBe(250);
    expect(parseNumber("12.5")).toBe(12.5);
  });
});

describe("validateProperty", () => {
  const ok = { name: "Borrowdale Gardens", address: "45 Borrowdale Road", suburb: "Borrowdale", city: "Harare", province: "Harare" };

  it("accepts a complete property", () => {
    expect(validateProperty(ok)).toEqual({});
  });

  it("flags every empty field with a sentence that says what to enter", () => {
    const errors = validateProperty({ name: " ", address: "", suburb: "", city: "", province: "" });
    expect(Object.keys(errors).sort()).toEqual(["address", "city", "name", "province", "suburb"]);
    expect(errors.name).toMatch(/name/i);
  });
});

describe("validateUnit", () => {
  const ok = { unitNumber: "04", bedrooms: "2", bathrooms: "1", rentAmountUsd: "250", depositAmount: "" };

  it("accepts a unit with no deposit", () => {
    expect(validateUnit(ok)).toEqual({});
  });

  it("requires a unit number and a positive rent", () => {
    const errors = validateUnit({ ...ok, unitNumber: "", rentAmountUsd: "0" });
    expect(errors.unitNumber).toBeDefined();
    expect(errors.rentAmountUsd).toBeDefined();
    expect(validateUnit({ ...ok, rentAmountUsd: "" }).rentAmountUsd).toBeDefined();
    expect(validateUnit({ ...ok, rentAmountUsd: "-5" }).rentAmountUsd).toBeDefined();
  });

  it("wants whole-number bedrooms and bathrooms from 0 to 20", () => {
    expect(validateUnit({ ...ok, bedrooms: "0" })).toEqual({});
    expect(validateUnit({ ...ok, bedrooms: "1.5" }).bedrooms).toBeDefined();
    expect(validateUnit({ ...ok, bathrooms: "21" }).bathrooms).toBeDefined();
    expect(validateUnit({ ...ok, bathrooms: "" }).bathrooms).toBeDefined();
  });

  it("only checks the deposit when one is typed", () => {
    expect(validateUnit({ ...ok, depositAmount: "250" })).toEqual({});
    expect(validateUnit({ ...ok, depositAmount: "0" })).toEqual({});
    expect(validateUnit({ ...ok, depositAmount: "-1" }).depositAmount).toBeDefined();
    expect(validateUnit({ ...ok, depositAmount: "two" }).depositAmount).toBeDefined();
  });
});

describe("validateInvite", () => {
  const ok = { unitId: "cunit1234567890", name: "Chipo Mutasa", email: "chipo@example.co.zw", rentDueDay: "1" };

  it("accepts a complete invitation", () => {
    expect(validateInvite(ok)).toEqual({});
  });

  it("explains a missing unit, name and email separately", () => {
    const errors = validateInvite({ unitId: "", name: "", email: "", rentDueDay: "1" });
    expect(errors.unitId).toMatch(/unit/i);
    expect(errors.name).toMatch(/name/i);
    expect(errors.email).toMatch(/email/i);
  });

  it("rejects an email that can't be right, and accepts one with surrounding spaces", () => {
    expect(validateInvite({ ...ok, email: "chipo" }).email).toBeDefined();
    expect(validateInvite({ ...ok, email: "chipo@" }).email).toBeDefined();
    expect(validateInvite({ ...ok, email: "chipo@example" }).email).toBeDefined();
    expect(validateInvite({ ...ok, email: "chipo @example.co.zw" }).email).toBeDefined();
    expect(validateInvite({ ...ok, email: "  chipo@example.co.zw " })).toEqual({});
  });

  it("keeps the rent day between 1 and 28", () => {
    expect(validateInvite({ ...ok, rentDueDay: "28" })).toEqual({});
    expect(validateInvite({ ...ok, rentDueDay: "0" }).rentDueDay).toBeDefined();
    expect(validateInvite({ ...ok, rentDueDay: "29" }).rentDueDay).toBeDefined();
    expect(validateInvite({ ...ok, rentDueDay: "1.5" }).rentDueDay).toBeDefined();
    expect(validateInvite({ ...ok, rentDueDay: "" }).rentDueDay).toBeDefined();
  });
});

describe("firstErrorField", () => {
  it("returns the first field in form order that has an error", () => {
    const order = ["unitId", "name", "email"] as const;
    expect(firstErrorField({ email: "x", name: "y" }, order)).toBe("name");
    expect(firstErrorField({}, order)).toBeNull();
  });
});
