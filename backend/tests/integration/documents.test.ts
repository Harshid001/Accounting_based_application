import request from 'supertest';
import type { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface StoredObject {
  contentType: string;
  contentLength: number;
}

const objects = new Map<string, StoredObject>();

vi.mock('../../src/config/fileStorage.js', () => ({
  PRESIGN_TTL_SECONDS: 60,
  presignPut: (storageKey: string, mimeType: string, sizeBytes: number) => {
    objects.set(storageKey, { contentType: mimeType, contentLength: sizeBytes });
    return Promise.resolve({
      uploadUrl: `https://storage.test/${storageKey}?signed=1`,
      storageKey,
      expiresIn: 60,
    });
  },
  presignGet: (storageKey: string) =>
    Promise.resolve({ url: `https://storage.test/${storageKey}?download=1`, expiresIn: 60 }),
  headObject: (storageKey: string) => {
    const found = objects.get(storageKey);
    return Promise.resolve(
      found === undefined
        ? null
        : { contentType: found.contentType, contentLength: found.contentLength, etag: 'etag' },
    );
  },
  deleteObject: (storageKey: string) => {
    objects.delete(storageKey);
    return Promise.resolve();
  },
  deleteObjects: (keys: readonly string[]) => {
    for (const key of keys) objects.delete(key);
    return Promise.resolve();
  },
  closeStorage: () => undefined,
}));

const { DocumentModel } = await import('../../src/models/document.model.js');
const { assignStaff, makeClient, makeDocumentRequest } = await import('../helpers/factories.js');
const { app, auth, authWithClient, createAccount, linkClients } = await import(
  '../helpers/auth.js'
);
type TestAccount = Awaited<ReturnType<typeof createAccount>>;

let admin: TestAccount;
let staff: TestAccount;
let client: TestAccount;
let clientId: Types.ObjectId;

beforeEach(async () => {
  objects.clear();
  admin = await createAccount({ role: 'admin' });
  staff = await createAccount({ role: 'staff' });
  client = await createAccount({ role: 'client' });
  clientId = await makeClient({ displayName: 'Document Client' });
  await assignStaff(clientId, [staff.id]);
  await linkClients(client, [clientId]);
});

const headersFor = (account: TestAccount) =>
  account.role === 'client' ? authWithClient(account, clientId) : auth(account);

const presign = (account: TestAccount, body: Record<string, unknown>) =>
  request(app())
    .post('/api/v1/documents/presign-upload')
    .set(headersFor(account))
    .send({ clientId: clientId.toString(), ...body });

const upload = async (
  account: TestAccount,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; storageKey: string }> => {
  const signed = await presign(account, {
    filename: 'statement.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 4096,
  });
  const storageKey = (signed.body.data as { storageKey: string }).storageKey;
  const created = await request(app())
    .post('/api/v1/documents')
    .set(headersFor(account))
    .send({
      clientId: clientId.toString(),
      storageKey,
      filename: 'statement.pdf',
      mimeType: 'application/pdf',
      title: 'Bank statement',
      documentType: 'bank_statement',
      ...overrides,
    });
  expect(created.status).toBe(201);
  return { id: (created.body.data as { id: string }).id, storageKey };
};

describe('presign limits', () => {
  it('issues a signed URL under a random key that never carries the filename', async () => {
    const response = await presign(staff, {
      filename: 'my personal statement.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 4096,
    });
    expect(response.status).toBe(200);
    const key = (response.body.data as { storageKey: string }).storageKey;
    expect(key).not.toContain('personal');
    expect(key.startsWith(`clients/${clientId.toString()}/`)).toBe(true);
  });

  it('refuses a file over 25 MB', async () => {
    const response = await presign(staff, {
      filename: 'huge.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 26_214_401,
    });
    expect(response.status).toBe(400);
  });

  it('refuses a media type outside the allowlist', async () => {
    const response = await presign(staff, {
      filename: 'script.js',
      mimeType: 'application/javascript',
      sizeBytes: 100,
    });
    expect(response.status).toBe(400);
  });

  it('refuses an extension that disagrees with the declared type', async () => {
    const response = await presign(staff, {
      filename: 'payload.exe',
      mimeType: 'application/pdf',
      sizeBytes: 100,
    });
    expect(response.status).toBe(415);
  });

  it('refuses a filename carrying a path', async () => {
    const response = await presign(staff, {
      filename: '../../etc/passwd.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 100,
    });
    expect(response.status).toBe(400);
  });
});

describe('finalisation', () => {
  it('creates version one and reads the real size back from storage', async () => {
    const { id } = await upload(staff);
    const record = await DocumentModel.findById(id).lean().exec();
    expect(record?.versions).toHaveLength(1);
    expect(record?.versions[0]?.sizeBytes).toBe(4096);
    expect(record?.currentVersion).toBe(1);
    expect(record?.uploadedByRole).toBe('staff');
  });

  it('rejects an upload that never arrived', async () => {
    const response = await request(app())
      .post('/api/v1/documents')
      .set(auth(staff))
      .send({
        clientId: clientId.toString(),
        storageKey: 'clients/nothing/here.pdf',
        filename: 'here.pdf',
        mimeType: 'application/pdf',
        title: 'Ghost',
        documentType: 'bank_statement',
      });
    expect(response.status).toBe(400);
  });

  it('rejects and deletes an object whose stored type differs from the declaration', async () => {
    const signed = await presign(staff, {
      filename: 'statement.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 4096,
    });
    const storageKey = (signed.body.data as { storageKey: string }).storageKey;
    objects.set(storageKey, { contentType: 'text/html', contentLength: 4096 });

    const response = await request(app())
      .post('/api/v1/documents')
      .set(auth(staff))
      .send({
        clientId: clientId.toString(),
        storageKey,
        filename: 'statement.pdf',
        mimeType: 'application/pdf',
        title: 'Disguised',
        documentType: 'bank_statement',
      });
    expect(response.status).toBe(415);
    expect(objects.has(storageKey)).toBe(false);
    expect(await DocumentModel.countDocuments()).toBe(0);
  });

  it('closes a document request when the upload names one', async () => {
    const requestId = await makeDocumentRequest(clientId, staff.id);
    await upload(client, { documentRequestId: requestId.toString() });

    const { DocumentRequest } = await import('../../src/models/documentRequest.model.js');
    const record = await DocumentRequest.findById(requestId).lean().exec();
    expect(record?.status).toBe('fulfilled');
    expect(record?.fulfilledBy).not.toBeNull();
  });
});

describe('versioning', () => {
  it('adds version N+1 and keeps the earlier ones downloadable', async () => {
    const { id } = await upload(staff);
    const signed = await presign(staff, {
      filename: 'statement-v2.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 8192,
    });
    const storageKey = (signed.body.data as { storageKey: string }).storageKey;

    const versioned = await request(app())
      .post(`/api/v1/documents/${id}/versions`)
      .set(auth(staff))
      .send({ storageKey, filename: 'statement-v2.pdf', mimeType: 'application/pdf' });
    expect(versioned.status).toBe(200);
    expect((versioned.body.data as { currentVersion: number }).currentVersion).toBe(2);

    const first = await request(app())
      .get(`/api/v1/documents/${id}/download?version=1`)
      .set(auth(staff));
    expect(first.status).toBe(200);
    expect((first.body.data as { url: string }).url).toContain('download=1');

    const missing = await request(app())
      .get(`/api/v1/documents/${id}/download?version=9`)
      .set(auth(staff));
    expect(missing.status).toBe(404);
  });

  it('refuses more than twenty versions', async () => {
    const { id } = await upload(staff);
    await DocumentModel.updateOne(
      { _id: id },
      {
        $set: {
          versions: Array.from({ length: 20 }, (_, index) => ({
            version: index + 1,
            storageKey: `clients/${clientId.toString()}/v${(index + 1).toString()}.pdf`,
            originalFilename: 'statement.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1024,
            uploadedBy: staff.id,
            uploadedAt: new Date(),
          })),
          currentVersion: 20,
        },
      },
    ).exec();

    const signed = await presign(staff, {
      filename: 'statement-21.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    });
    const response = await request(app())
      .post(`/api/v1/documents/${id}/versions`)
      .set(auth(staff))
      .send({
        storageKey: (signed.body.data as { storageKey: string }).storageKey,
        filename: 'statement-21.pdf',
        mimeType: 'application/pdf',
      });
    expect(response.status).toBe(409);
  });
});

describe('archive and hard delete', () => {
  it('hides an archived document from the default list', async () => {
    const { id } = await upload(staff);
    await request(app()).post(`/api/v1/documents/${id}/archive`).set(auth(staff));

    const list = await request(app())
      .get(`/api/v1/documents?client=${clientId.toString()}`)
      .set(auth(staff));
    expect(list.body.data).toEqual([]);

    const archived = await request(app())
      .get(`/api/v1/documents?client=${clientId.toString()}&archived=true`)
      .set(auth(staff));
    expect((archived.body.data as unknown[]).length).toBe(1);
  });

  it('freezes an archived document against edits', async () => {
    const { id } = await upload(staff);
    await request(app()).post(`/api/v1/documents/${id}/archive`).set(auth(staff));
    const response = await request(app())
      .patch(`/api/v1/documents/${id}`)
      .set(auth(staff))
      .send({ title: 'Renamed while archived' });
    expect(response.status).toBe(409);
  });

  it('requires the exact title before a hard delete, then removes every object', async () => {
    const { id, storageKey } = await upload(staff);

    const wrong = await request(app())
      .delete(`/api/v1/documents/${id}`)
      .set(auth(admin))
      .send({ confirm: 'not the title' });
    expect(wrong.status).toBe(400);
    expect(objects.has(storageKey)).toBe(true);

    const right = await request(app())
      .delete(`/api/v1/documents/${id}`)
      .set(auth(admin))
      .send({ confirm: 'Bank statement' });
    expect(right.status).toBe(204);
    expect(objects.has(storageKey)).toBe(false);
    expect(await DocumentModel.countDocuments()).toBe(0);
  });

  it('lets a client archive only their own upload', async () => {
    const staffUpload = await upload(staff);
    const clientUpload = await upload(client);

    const refused = await request(app())
      .post(`/api/v1/documents/${staffUpload.id}/archive`)
      .set(authWithClient(client, clientId));
    expect(refused.status).toBe(404);

    const allowed = await request(app())
      .post(`/api/v1/documents/${clientUpload.id}/archive`)
      .set(authWithClient(client, clientId));
    expect(allowed.status).toBe(200);
  });
});
