import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { once } from 'node:events';
import type { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

import { GridFSBucket } from 'mongodb';
import type { GridFSBucketReadStream, GridFSFile } from 'mongodb';
import { z } from 'zod';

import { MAX_UPLOAD_BYTES } from '../lib/enums.js';
import { forbidden, notFound, validationFailed } from '../lib/errors.js';
import { getDb } from './db.js';
import { env } from './env.js';
import { logger } from './logger.js';

export const PRESIGN_TTL_SECONDS = 60;

const COLLECTION_PREFIX = 'firmdesk_storage';
const UPLOAD_PATH = '/api/v1/storage/transfers/upload';
const DOWNLOAD_PATH = '/api/v1/storage/transfers/download';

const uploadTicketSchema = z.object({
  version: z.literal(1),
  operation: z.literal('upload'),
  storageKey: z.string().min(1).max(300),
  mimeType: z.string().min(1).max(200),
  sizeBytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
  expiresAt: z.number().int().positive(),
});

const downloadTicketSchema = z.object({
  version: z.literal(1),
  operation: z.literal('download'),
  storageKey: z.string().min(1).max(300),
  downloadFilename: z.string().min(1).max(200),
  expiresAt: z.number().int().positive(),
});

export type UploadTransferTicket = z.infer<typeof uploadTicketSchema>;
export type DownloadTransferTicket = z.infer<typeof downloadTicketSchema>;

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
  stream: GridFSBucketReadStream;
  contentLength: number;
}

const gridFiles = (): GridFSBucket =>
  new GridFSBucket(getDb(), { bucketName: COLLECTION_PREFIX });

const expiry = (): number => Math.floor(Date.now() / 1000) + PRESIGN_TTL_SECONDS;

const sign = (payload: UploadTransferTicket | DownloadTransferTicket): string => {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', env.BETTER_AUTH_SECRET)
    .update(body)
    .digest('base64url');
  return `${body}.${signature}`;
};

const transferUrl = (path: string, token: string): string => {
  const url = new URL(path, `${env.BETTER_AUTH_URL.replace(/\/+$/, '')}/`);
  url.searchParams.set('token', token);
  return url.toString();
};

const invalidTicket = () =>
  forbidden(
    'This file transfer link is invalid or has expired. Request a new link and try again.',
  );

const decode = (token: string): unknown => {
  if (token.length > 2_000) throw invalidTicket();
  const parts = token.split('.');
  const body = parts[0];
  const suppliedText = parts[1];
  if (parts.length !== 2 || body === undefined || suppliedText === undefined) {
    throw invalidTicket();
  }

  const expected = createHmac('sha256', env.BETTER_AUTH_SECRET).update(body).digest();
  const supplied = Buffer.from(suppliedText, 'base64url');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw invalidTicket();
  }

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as unknown;
  } catch {
    throw invalidTicket();
  }
};

const assertUnexpired = <T extends { expiresAt: number }>(ticket: T): T => {
  if (ticket.expiresAt < Math.floor(Date.now() / 1000)) throw invalidTicket();
  return ticket;
};

export const verifyUploadTicket = (token: string): UploadTransferTicket => {
  const parsed = uploadTicketSchema.safeParse(decode(token));
  if (!parsed.success) throw invalidTicket();
  return assertUnexpired(parsed.data);
};

export const verifyDownloadTicket = (token: string): DownloadTransferTicket => {
  const parsed = downloadTicketSchema.safeParse(decode(token));
  if (!parsed.success) throw invalidTicket();
  return assertUnexpired(parsed.data);
};

export const presignPut = (
  storageKey: string,
  mimeType: string,
  sizeBytes: number,
): Promise<PresignedUpload> => {
  const ticket = uploadTicketSchema.parse({
    version: 1,
    operation: 'upload',
    storageKey,
    mimeType,
    sizeBytes,
    expiresAt: expiry(),
  });
  return Promise.resolve({
    uploadUrl: transferUrl(UPLOAD_PATH, sign(ticket)),
    storageKey,
    expiresIn: PRESIGN_TTL_SECONDS,
  });
};

export const presignGet = (
  storageKey: string,
  downloadFilename: string,
): Promise<{ url: string; expiresIn: number }> => {
  const safeName = downloadFilename.replace(/["\r\n]/g, '').slice(0, 200) || 'download';
  const ticket = downloadTicketSchema.parse({
    version: 1,
    operation: 'download',
    storageKey,
    downloadFilename: safeName,
    expiresAt: expiry(),
  });
  return Promise.resolve({
    url: transferUrl(DOWNLOAD_PATH, sign(ticket)),
    expiresIn: PRESIGN_TTL_SECONDS,
  });
};

const bufferFrom = (chunk: unknown): Buffer => {
  if (Buffer.isBuffer(chunk)) return chunk;
  if (typeof chunk === 'string') return Buffer.from(chunk);
  if (chunk instanceof Uint8Array) return Buffer.from(chunk);
  throw validationFailed('The uploaded file contained an unsupported byte sequence.');
};

const removeFiles = async (files: readonly GridFSFile[]): Promise<void> => {
  const filesApi = gridFiles();
  await Promise.all(files.map((file) => filesApi.delete(file._id)));
};

const FILE_RECENCY_SORT = { uploadDate: -1, _id: -1 } as const;

const removeSupersededCopies = async (storageKey: string): Promise<void> => {
  const copies = await gridFiles()
    .find({ filename: storageKey })
    .sort(FILE_RECENCY_SORT)
    .toArray();
  const superseded = copies.slice(1);
  if (superseded.length === 0) return;
  try {
    await removeFiles(superseded);
  } catch (error) {
    logger.warn(
      { event: 'storage.cleanup_failed', storageKey, err: error },
      'superseded file revisions could not be removed',
    );
  }
};

export const storeObject = async (
  storageKey: string,
  mimeType: string,
  expectedSizeBytes: number,
  source: Readable,
): Promise<StoredObjectFacts> => {
  if (
    !Number.isSafeInteger(expectedSizeBytes) ||
    expectedSizeBytes <= 0 ||
    expectedSizeBytes > MAX_UPLOAD_BYTES
  ) {
    throw validationFailed('The upload size is outside the accepted range.');
  }

  const bucket = gridFiles();
  const upload = bucket.openUploadStream(storageKey, {
    metadata: { contentType: mimeType },
  });
  const completion = finished(upload);
  void completion.catch(() => undefined);
  const hash = createHash('sha256');
  let received = 0;

  try {
    for await (const chunk of source) {
      const bytes = bufferFrom(chunk);
      received += bytes.length;
      if (received > expectedSizeBytes) {
        throw validationFailed('The uploaded file is larger than the size declared for it.');
      }
      hash.update(bytes);
      if (!upload.write(bytes)) await once(upload, 'drain');
    }

    if (received !== expectedSizeBytes) {
      throw validationFailed('The uploaded file size does not match the size declared for it.');
    }

    upload.end();
    await completion;
    const checksum = hash.digest('hex');
    await getDb()
      .collection(`${COLLECTION_PREFIX}.files`)
      .updateOne({ _id: upload.id }, { $set: { 'metadata.checksum': checksum } });
    await removeSupersededCopies(storageKey);
    return { contentType: mimeType, contentLength: received, etag: checksum };
  } catch (error) {
    if (!upload.writableFinished) {
      await upload.abort().catch(() => undefined);
      upload.destroy();
    }
    await completion.catch(() => undefined);
    throw error;
  }
};

const latestFile = async (storageKey: string): Promise<GridFSFile | null> =>
  gridFiles().find({ filename: storageKey }).sort(FILE_RECENCY_SORT).limit(1).next();

const metadataString = (file: GridFSFile, field: string): string | undefined => {
  const metadata: unknown = file.metadata;
  if (metadata === null || typeof metadata !== 'object') return undefined;
  const value = (metadata as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : undefined;
};

export const headObject = async (storageKey: string): Promise<StoredObjectFacts | null> => {
  try {
    const file = await latestFile(storageKey);
    if (!file) return null;
    return {
      contentType: metadataString(file, 'contentType'),
      contentLength: file.length,
      etag: metadataString(file, 'checksum') ?? file._id.toHexString(),
    };
  } catch {
    return null;
  }
};

export const openObject = async (storageKey: string): Promise<StoredObjectDownload> => {
  const file = await latestFile(storageKey);
  if (!file) throw notFound('file');
  return {
    stream: gridFiles().openDownloadStream(file._id),
    contentLength: file.length,
  };
};

export const deleteObject = async (storageKey: string): Promise<void> => {
  const files = await gridFiles().find({ filename: storageKey }).toArray();
  await removeFiles(files);
};

export const deleteObjects = async (storageKeys: readonly string[]): Promise<void> => {
  const uniqueKeys = [...new Set(storageKeys)];
  if (uniqueKeys.length === 0) return;
  const files = await gridFiles()
    .find({ filename: { $in: uniqueKeys } })
    .toArray();
  await removeFiles(files);
};

export const closeStorage = (): void => {
  logger.debug(
    { event: 'storage.closed' },
    'file storage uses the shared database connection lifecycle',
  );
};
