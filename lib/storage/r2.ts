import "server-only";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Spec: Security §5 — presigned URLs only, scoped per user, 5-minute expiry.
// Validate content-type/size server-side before issuing the URL. Uploads are
// served directly from the R2 public domain, never proxied through the app.

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const UPLOAD_URL_EXPIRY_SECONDS = 300;

export function isR2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME,
  );
}

let client: S3Client | null = null;
function getClient() {
  if (!isR2Configured()) {
    throw new Error(
      "Cloudflare R2 is not configured — set R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME in .env",
    );
  }
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

export async function createUploadUrl(args: {
  key: string;
  contentType: (typeof ALLOWED_CONTENT_TYPES)[number];
  contentLength: number;
}) {
  if (!ALLOWED_CONTENT_TYPES.includes(args.contentType)) {
    throw new Error(`Unsupported content type: ${args.contentType}`);
  }
  if (args.contentLength > MAX_UPLOAD_BYTES) {
    throw new Error("File exceeds the 5MB limit");
  }

  const s3 = getClient();
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: args.key,
    ContentType: args.contentType,
    ContentLength: args.contentLength,
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: UPLOAD_URL_EXPIRY_SECONDS });

  return { uploadUrl, publicUrl: `${process.env.R2_PUBLIC_URL}/${args.key}` };
}
