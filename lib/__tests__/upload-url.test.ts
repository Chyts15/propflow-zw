import { describe, expect, it } from "vitest";
import { complaintPhotoPrefix, firstForeignPhoto, isOwnUploadUrl, rentProofPrefix } from "../storage/upload-url";

const BASE = "https://uploads.propflow.co.zw";
const ME = "cmgme0000000000000000000a";
const OTHER = "cmgother00000000000000000b";
const prefix = rentProofPrefix(ME);
const ok = (url: string, base: string | undefined = BASE) => isOwnUploadUrl(url, base, prefix);

describe("isOwnUploadUrl", () => {
  it("accepts a file in this tenant's own folder on the configured host", () => {
    expect(ok(`${BASE}/rent-proof/${ME}/1760000000000-a1b2c3.jpeg`)).toBe(true);
    expect(ok(`${BASE}/rent-proof/${ME}/1760000000000-a1b2c3.png`)).toBe(true);
  });

  it("accepts a base that has a path or a trailing slash", () => {
    expect(ok(`https://cdn.example.com/media/rent-proof/${ME}/x.jpeg`, "https://cdn.example.com/media")).toBe(true);
    expect(ok(`${BASE}/rent-proof/${ME}/x.jpeg`, `${BASE}/`)).toBe(true);
  });

  it("refuses another tenant's folder and the bare folder", () => {
    expect(ok(`${BASE}/rent-proof/${OTHER}/x.jpeg`)).toBe(false);
    expect(ok(`${BASE}/rent-proof/${ME}/`)).toBe(false);
    expect(ok(`${BASE}/rent-proof/${ME}`)).toBe(false);
    expect(ok(`${BASE}/complaints/${ME}/x.jpeg`)).toBe(false);
  });

  it("refuses any other host, including look-alikes and URLs that hide the real one", () => {
    expect(ok(`https://evil.example.com/rent-proof/${ME}/x.jpeg`)).toBe(false);
    expect(ok(`https://uploads.propflow.co.zw.evil.com/rent-proof/${ME}/x.jpeg`)).toBe(false);
    expect(ok(`https://uploads.propflow.co.zw@evil.com/rent-proof/${ME}/x.jpeg`)).toBe(false);
    expect(ok(`https://user:pw@uploads.propflow.co.zw/rent-proof/${ME}/x.jpeg`)).toBe(false);
    expect(ok(`https://uploads.propflow.co.zw:8443/rent-proof/${ME}/x.jpeg`)).toBe(false);
  });

  it("refuses a different scheme", () => {
    expect(ok(`http://uploads.propflow.co.zw/rent-proof/${ME}/x.jpeg`)).toBe(false);
    expect(ok(`javascript:alert(1)`)).toBe(false);
    expect(ok(`data:image/png;base64,AAAA`)).toBe(false);
  });

  it("refuses traversal out of the folder, plain or encoded", () => {
    expect(ok(`${BASE}/rent-proof/${ME}/../${OTHER}/x.jpeg`)).toBe(false);
    expect(ok(`${BASE}/rent-proof/${ME}/%2e%2e/${OTHER}/x.jpeg`)).toBe(false);
    expect(ok(`${BASE}/rent-proof/${ME}/..%2f${OTHER}/x.jpeg`)).toBe(false);
  });

  it("refuses nested paths, odd file names, queries and fragments", () => {
    expect(ok(`${BASE}/rent-proof/${ME}/a/b.jpeg`)).toBe(false);
    expect(ok(`${BASE}/rent-proof/${ME}/.hidden`)).toBe(false);
    expect(ok(`${BASE}/rent-proof/${ME}/x y.jpeg`)).toBe(false);
    expect(ok(`${BASE}/rent-proof/${ME}/x.jpeg?cache=1`)).toBe(false);
    expect(ok(`${BASE}/rent-proof/${ME}/x.jpeg#frag`)).toBe(false);
  });

  it("fails closed when no public base is configured", () => {
    // Called directly: the `ok` helper's default parameter would turn `undefined` into BASE.
    const valid = `${BASE}/rent-proof/${ME}/x.jpeg`;
    expect(isOwnUploadUrl(valid, undefined, prefix)).toBe(false);
    expect(isOwnUploadUrl(valid, "", prefix)).toBe(false);
    expect(isOwnUploadUrl("undefined/rent-proof/x.jpeg", undefined, prefix)).toBe(false);
  });

  it("refuses text that is not a URL at all", () => {
    expect(ok("not a url")).toBe(false);
    expect(ok("")).toBe(false);
  });
});

describe("rentProofPrefix", () => {
  it("is the folder the upload endpoint mints keys under", () => {
    expect(rentProofPrefix(ME)).toBe(`rent-proof/${ME}/`);
  });
});

describe("complaint photos", () => {
  const complaintPrefix = complaintPhotoPrefix(ME);
  const mine = `${BASE}/complaints/${ME}/1760000000000-a1b2c3.jpeg`;
  const pdf = `${BASE}/complaints/${ME}/1760000000000-d4e5f6.pdf`;

  it("has its own folder, apart from payment proofs", () => {
    expect(complaintPrefix).toBe(`complaints/${ME}/`);
    expect(complaintPrefix).not.toBe(prefix);
  });

  it("accepts this tenant's own complaint photos", () => {
    expect(isOwnUploadUrl(mine, BASE, complaintPrefix)).toBe(true);
    expect(isOwnUploadUrl(pdf, BASE, complaintPrefix)).toBe(true);
  });

  it("keeps the two folders apart: a proof cannot be passed off as a complaint photo, or the reverse", () => {
    const proof = `${BASE}/rent-proof/${ME}/1760000000000-a1b2c3.jpeg`;
    expect(isOwnUploadUrl(proof, BASE, complaintPrefix)).toBe(false);
    expect(isOwnUploadUrl(mine, BASE, prefix)).toBe(false);
  });

  it("refuses another tenant's complaint photo and outside hosts", () => {
    expect(isOwnUploadUrl(`${BASE}/complaints/${OTHER}/x.jpeg`, BASE, complaintPrefix)).toBe(false);
    expect(isOwnUploadUrl(`https://evil.example.com/complaints/${ME}/x.jpeg`, BASE, complaintPrefix)).toBe(false);
  });
});

describe("firstForeignPhoto", () => {
  const complaintPrefix = complaintPhotoPrefix(ME);
  const mine = `${BASE}/complaints/${ME}/a.jpeg`;

  it("is null for an empty list and for a list of the tenant's own photos", () => {
    expect(firstForeignPhoto([], BASE, complaintPrefix)).toBeNull();
    expect(firstForeignPhoto([mine, `${BASE}/complaints/${ME}/b.png`], BASE, complaintPrefix)).toBeNull();
  });

  it("names the first photo that is not theirs, however many are fine", () => {
    const stranger = `${BASE}/complaints/${OTHER}/c.jpeg`;
    expect(firstForeignPhoto([mine, stranger, "https://evil.example.com/x.jpeg"], BASE, complaintPrefix)).toBe(stranger);
  });

  it("refuses text that is not a URL, which the old string-only field would have kept", () => {
    expect(firstForeignPhoto(["javascript:alert(1)"], BASE, complaintPrefix)).toBe("javascript:alert(1)");
    expect(firstForeignPhoto(["just some text"], BASE, complaintPrefix)).toBe("just some text");
  });

  it("refuses everything when no public base is configured", () => {
    expect(firstForeignPhoto([mine], undefined, complaintPrefix)).toBe(mine);
  });
});
