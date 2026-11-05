import { z } from "zod";

// The landlord's reply form has no photo upload and there is no landlord upload endpoint, so a
// reply carries no photos. The field used to take up to three arbitrary strings, which the tenant's
// screen would then have shown as images.
export const landlordReplyPhotos = z.array(z.string()).max(0).default([]);
