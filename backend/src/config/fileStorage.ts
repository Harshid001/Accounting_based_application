import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { MAX_UPLOAD_BYTES } from '../lib/enums.js';
import { notFound } from '../lib/errors.js';
import { env } from './env.js';
import { logger } from './logger.js';

export const PRESIGN_TTL_SECONDS = 60;

export const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

export const bucket = env.R2_BUCKET_NAME;

export interface PresignedUpload {
  uploadUrl: string;
  storageKey: string;
  expiresIn: number;
}

export interface StoredObjectFacts {
  contentType: string | undefined;
  contentLength: number | undefined;
  etag: string | undefined;
}

export interface StoredObjectDownload {
  url: string;
  contentLength: number;
  contentType: string | undefined;
}

export const presignPut = async (
  storageKey: string,
  mimeType: string,
  sizeBytes: number,
): Promise<PresignedUpload> => {
  if (sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) {
    throw new Error('The upload size is outside the accepted range.');
  }
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ContentType: mimeType,
    ContentLength: sizeBytes,
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: PRESIGN_TTL_SECONDS });
  return { uploadUrl, storageKey, expiresIn: PRESIGN_TTL_SECONDS };
};

export const presignGet = async (
  storageKey: string,
  _downloadFilename: string,
): Promise<{ url: string; expiresIn: number }> => {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ResponseContentDisposition: `attachment; filename="${_downloadFilename.replace(/["\r\n]/g, '').slice(0, 200) || 'download'}"`,
  });
  const url = await getSignedUrl(s3, command, { expiresIn: PRESIGN_TTL_SECONDS });
  return { url, expiresIn: PRESIGN_TTL_SECONDS };
};

export const headObject = async (storageKey: string): Promise<StoredObjectFacts | null> => {
  try {
    const result = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: storageKey }));
    return {
      contentType: result.ContentType,
      contentLength: result.ContentLength,
      etag: result.ETag,
    };
  } catch {
    return null;
  }
};

export const openObject = async (storageKey: string): Promise<StoredObjectDownload> => {
  const head = await headObject(storageKey);
  if (!head) throw notFound('file');
  const command = new GetObjectCommand({ Bucket: bucket, Key: storageKey });
  const url = await getSignedUrl(s3, command, { expiresIn: PRESIGN_TTL_SECONDS });
  return {
    url,
    contentLength: head.contentLength ?? 0,
    contentType: head.contentType,
  };
};

export const deleteObject = async (storageKey: string): Promise<void> => {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }));
};

export const deleteObjects = async (storageKeys: readonly string[]): Promise<void> => {
  const uniqueKeys = [...new Set(storageKeys)];
  if (uniqueKeys.length === 0) return;
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: uniqueKeys.map((key) => ({ Key: key })) },
    }),
  );
};

export const storeObject = (): never => {
  throw new Error('storeObject is no longer supported; use presigned uploads directly.');
};

export const closeStorage = (): void => {
  s3.destroy();
  logger.debug({ event: 'storage.closed' }, 'S3/R2 client destroyed');
};

export const verifyUploadTicket = (): never => {
  throw new Error(
    'verifyUploadTicket is no longer needed; clients use presigned URLs directly.',
  );
};

export const verifyDownloadTicket = (): never => {
  throw new Error(
    'verifyDownloadTicket is no longer needed; clients use presigned URLs directly.',
  );
};
