import { escapeRegex } from '../lib/identifiers.js';
import { Client } from '../models/client.model.js';
import { ComplianceItem } from '../models/complianceItem.model.js';
import { DocumentModel } from '../models/document.model.js';
import { Task } from '../models/task.model.js';
import type { AuthenticatedUser } from '../types/context.js';
import { accessibleClientIds } from './compliance.service.js';

const PER_KIND = 5;

export interface SearchHit {
  kind: 'client' | 'task' | 'compliance' | 'document';
  id: string;
  title: string;
  subtitle: string | null;
  link: string;
}

export interface SearchResults {
  clients: SearchHit[];
  tasks: SearchHit[];
  compliance: SearchHit[];
  documents: SearchHit[];
}

const named = (value: unknown, key: string): string | null => {
  if (value === null || value === undefined || typeof value !== 'object') return null;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'string' ? candidate : null;
};

export const search = async (
  user: AuthenticatedUser,
  term: string,
): Promise<SearchResults> => {
  const trimmed = term.trim();
  if (trimmed.length < 2) {
    return { clients: [], tasks: [], compliance: [], documents: [] };
  }
  const pattern = new RegExp(escapeRegex(trimmed), 'i');
  const scoped = await accessibleClientIds(user);
  const clientScope = scoped === null ? {} : { client: { $in: scoped } };
  const clientFilter = scoped === null ? { archived: false } : { _id: { $in: scoped }, archived: false };

  const [clients, tasks, compliance, documents] = await Promise.all([
    Client.find({
      ...clientFilter,
      $or: [{ displayName: pattern }, { legalName: pattern }, { pan: pattern }, { gstin: pattern }],
    })
      .select('displayName clientType pan gstin')
      .limit(PER_KIND)
      .lean()
      .exec(),
    Task.find({ ...clientScope, title: pattern })
      .select('title status client')
      .populate('client', 'displayName')
      .limit(PER_KIND)
      .lean()
      .exec(),
    ComplianceItem.find({ ...clientScope, periodLabel: pattern })
      .select('periodLabel status client complianceType')
      .populate('client', 'displayName')
      .populate('complianceType', 'name')
      .limit(PER_KIND)
      .lean()
      .exec(),
    DocumentModel.find({ ...clientScope, archived: false, title: pattern })
      .select('title documentType client')
      .populate('client', 'displayName')
      .limit(PER_KIND)
      .lean()
      .exec(),
  ]);

  return {
    clients: clients.map((client) => ({
      kind: 'client' as const,
      id: client._id.toString(),
      title: client.displayName,
      subtitle: client.pan ?? client.gstin ?? client.clientType,
      link: `/clients/${client._id.toString()}/profile`,
    })),
    tasks: tasks.map((task) => ({
      kind: 'task' as const,
      id: task._id.toString(),
      title: task.title,
      subtitle: named(task.client, 'displayName') ?? 'Internal work',
      link: `/tasks/${task._id.toString()}`,
    })),
    compliance: compliance.map((item) => ({
      kind: 'compliance' as const,
      id: item._id.toString(),
      title: `${named(item.complianceType, 'name') ?? 'Filing'} — ${item.periodLabel}`,
      subtitle: named(item.client, 'displayName'),
      link: `/compliance/${item._id.toString()}`,
    })),
    documents: documents.map((document) => ({
      kind: 'document' as const,
      id: document._id.toString(),
      title: document.title,
      subtitle: named(document.client, 'displayName'),
      link: `/clients/${document.client.toString()}/documents`,
    })),
  };
};
