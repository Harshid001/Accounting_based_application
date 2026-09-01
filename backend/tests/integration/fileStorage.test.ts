import { Readable } from 'node:stream';

import request from 'supertest';
import { describe, expect, it } from 'vitest';

import {
  closeStorage,
  deleteObject,
  deleteObjects,
  headObject,
  openObject,
  presignGet,
  presignPut,
  storeObject,
} from '../../src/config/fileStorage.js';
import { app } from '../helpers/auth.js';

const requestPath = (absoluteUrl: string): string => {
  const url = new URL(absoluteUrl);
  return `${url.pathname}${url.search}`;
};

const readStoredObject = async (storageKey: string): Promise<Buffer> => {
  const stored = await openObject(storageKey);
  const chunks: Buffer[] = [];
  for await (const chunk of stored.stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

describe('MongoDB file storage', () => {
  it('uploads, inspects, downloads, and deletes a file through signed transfer URLs', async () => {
    const storageKey = 'clients/storage-test/document.pdf';
    const bytes = Buffer.from('%PDF-1.7\nFirmDesk GridFS integration\n');
    const upload = await presignPut(storageKey, 'application/pdf', bytes.length);

    const uploaded = await request(app())
      .put(requestPath(upload.uploadUrl))
      .set('Content-Type', 'application/pdf')
      .set('Content-Length', bytes.length.toString())
      .send(bytes);

    expect(uploaded.status).toBe(204);
    expect(upload.storageKey).toBe(storageKey);
    expect(upload.expiresIn).toBe(60);

    const facts = await headObject(storageKey);
    expect(facts).toMatchObject({
      contentType: 'application/pdf',
      contentLength: bytes.length,
    });
    expect(facts?.etag).toMatch(/^[a-f0-9]{64}$/);

    const download = await presignGet(storageKey, 'statement.pdf');
    const downloaded = await request(app()).get(requestPath(download.url)).buffer(true);

    expect(downloaded.status).toBe(200);
    expect(downloaded.headers['content-type']).toContain('application/octet-stream');
    expect(downloaded.headers['content-disposition']).toContain('attachment;');
    expect(downloaded.headers['content-disposition']).toContain('statement.pdf');
    expect(downloaded.body).toEqual(bytes);

    await deleteObject(storageKey);
    expect(await headObject(storageKey)).toBeNull();
    closeStorage();
  });

  it('removes multiple stored files in one operation', async () => {
    const firstKey = 'clients/storage-test/first.pdf';
    const secondKey = 'clients/storage-test/second.pdf';
    const first = Buffer.from('first');
    const second = Buffer.from('second');

    await storeObject(firstKey, 'application/pdf', first.length, Readable.from(first));
    await storeObject(secondKey, 'application/pdf', second.length, Readable.from(second));
    expect(await headObject(firstKey)).not.toBeNull();
    expect(await headObject(secondKey)).not.toBeNull();

    await deleteObjects([firstKey, secondKey]);

    expect(await headObject(firstKey)).toBeNull();
    expect(await headObject(secondKey)).toBeNull();
  });

  it('rejects a transfer whose body differs from its signed size', async () => {
    const upload = await presignPut(
      'clients/storage-test/wrong-size.pdf',
      'application/pdf',
      20,
    );

    const response = await request(app())
      .put(requestPath(upload.uploadUrl))
      .set('Content-Type', 'application/pdf')
      .set('Content-Length', '5')
      .send(Buffer.from('short'));

    expect(response.status).toBe(400);
    expect(await headObject('clients/storage-test/wrong-size.pdf')).toBeNull();
  });

  it('settles and removes a partial GridFS upload', async () => {
    const storageKey = 'clients/storage-test/partial.pdf';
    const partial = Buffer.from('short');

    await expect(
      storeObject(storageKey, 'application/pdf', partial.length + 5, Readable.from(partial)),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(await headObject(storageKey)).toBeNull();
  });

  it('keeps one deterministic winner when the same transfer is replayed concurrently', async () => {
    const storageKey = 'clients/storage-test/concurrent.pdf';
    const candidates = [
      Buffer.alloc(300_000, 'a'),
      Buffer.alloc(300_000, 'b'),
      Buffer.alloc(300_000, 'c'),
      Buffer.alloc(300_000, 'd'),
    ];

    await Promise.all(
      candidates.map((bytes) =>
        storeObject(storageKey, 'application/pdf', bytes.length, Readable.from(bytes)),
      ),
    );

    const stored = await readStoredObject(storageKey);
    expect(candidates.some((candidate) => candidate.equals(stored))).toBe(true);
  });

  it('limits replay of one signed download URL', async () => {
    const storageKey = 'clients/storage-test/replayed-download.pdf';
    const bytes = Buffer.from('download once, retry twice');
    await storeObject(storageKey, 'application/pdf', bytes.length, Readable.from(bytes));
    const download = await presignGet(storageKey, 'replayed-download.pdf');
    const path = requestPath(download.url);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await request(app()).get(path);
      expect(response.status).toBe(200);
    }

    const limited = await request(app()).get(path);
    expect(limited.status).toBe(429);
  });
});
