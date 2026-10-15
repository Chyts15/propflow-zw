import { describe, expect, it } from "vitest";
import { landlordReplyPhotos } from "../complaint-photos";

describe("landlordReplyPhotos", () => {
  it("defaults to no photos, and accepts an empty list", () => {
    expect(landlordReplyPhotos.parse(undefined)).toEqual([]);
    expect(landlordReplyPhotos.parse([])).toEqual([]);
  });

  it("refuses any photo on a landlord reply: there is no upload flow for one", () => {
    expect(() => landlordReplyPhotos.parse(["https://uploads.propflow.co.zw/complaints/x/a.jpeg"])).toThrow();
    expect(() => landlordReplyPhotos.parse(["javascript:alert(1)"])).toThrow();
  });
});
