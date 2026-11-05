// Which photo URLs the server will accept back from a tenant: payment proofs and complaint
// photos. Pure, so the rule can be tested on its own (the R2 client in r2.ts is server-only).
//
// rent.submitProof used to accept ANY url as proofImageUrl, and the complaint endpoints took any
// string at all as a photo. The landlord's screen loads those addresses in an <img>, so a tenant
// could point one at an external host (tracking the landlord, showing unrelated content) or at
// another tenant's upload. Photos are only ever created by the getUploadUrl procedures, which mint
// keys under the prefixes below, so that is all that is accepted back.

/** Where a tenant's proof uploads live in the bucket. The one place this shape is written. */
export const rentProofPrefix = (tenantId: string) => `rent-proof/${tenantId}/`;

/** Where a tenant's complaint photos live in the bucket. */
export const complaintPhotoPrefix = (tenantId: string) => `complaints/${tenantId}/`;

/**
 * True only for `<publicBase>/<prefix><file name>`: the configured public host, this tenant's own
 * folder, and a single plain file name. With no base configured nothing is accepted, so a
 * deployment missing R2_PUBLIC_URL fails closed instead of trusting whatever was sent.
 */
export function isOwnUploadUrl(candidate: string, publicBase: string | undefined, prefix: string): boolean {
  if (!publicBase) return false;
  let url: URL;
  let base: URL;
  try {
    url = new URL(candidate);
    base = new URL(publicBase);
  } catch {
    return false;
  }
  // `host` includes the port, so https://uploads.example.com@evil.com/ and look-alike hosts both fail.
  if (url.protocol !== base.protocol || url.host !== base.host) return false;
  if (url.username || url.password || url.search || url.hash) return false;

  // The URL parser has already resolved `..` and `%2e%2e`, so a traversal cannot leave the prefix.
  const wanted = `${base.pathname.replace(/\/+$/, "")}/${prefix}`;
  if (!url.pathname.startsWith(wanted)) return false;
  const fileName = url.pathname.slice(wanted.length);
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(fileName);
}

/** The first photo URL that is not an upload of this tenant's own, or null when every one is. */
export function firstForeignPhoto(urls: string[], publicBase: string | undefined, prefix: string): string | null {
  return urls.find((url) => !isOwnUploadUrl(url, publicBase, prefix)) ?? null;
}
