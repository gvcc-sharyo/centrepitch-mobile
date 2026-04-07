import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const cloudflareConfig = {
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
  secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  bucketName: process.env.CLOUDFLARE_BUCKET_NAME,
  region: process.env.CLOUDFLARE_BUCKET_REGION || "auto",
};

const requiredConfig = [
  "accountId",
  "accessKeyId",
  "secretAccessKey",
  "bucketName",
];

const missingConfig = requiredConfig.filter((key) => !cloudflareConfig[key]);
if (missingConfig.length > 0) {
  console.warn(
    `Cloudflare R2 config missing: ${missingConfig.join(", ")}. Uploads may fail.`,
  );
}

const getR2Endpoint = () => {
  return `https://${cloudflareConfig.accountId}.r2.cloudflarestorage.com`;
};

export const r2Client = new S3Client({
  region: cloudflareConfig.region,
  endpoint: getR2Endpoint(),
  credentials: {
    accessKeyId: cloudflareConfig.accessKeyId,
    secretAccessKey: cloudflareConfig.secretAccessKey,
  },
});

export const getPublicUrl = (key) => {
  const publicDomain = process.env.CLOUDFLARE_PUBLIC_DOMAIN
    || (process.env.CLOUDFLARE_PUBLIC_KEY
      ? `https://pub-${process.env.CLOUDFLARE_PUBLIC_KEY}.r2.dev`
      : `https://${cloudflareConfig.bucketName}.${cloudflareConfig.accountId}.r2.dev`);
  return `${publicDomain}/${key}`;
};

export default {
  ...cloudflareConfig,
  r2Client,
  getPublicUrl,
  endpoint: getR2Endpoint(),
};
