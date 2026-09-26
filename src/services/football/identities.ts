import { randomUUID } from 'node:crypto';
import { db } from '@/database/client';
import { log } from '@/lib/logger';
export type EntityKind = 'team' | 'competition' | 'match' | 'player';
export async function identity(provider: string, kind: EntityKind, externalId: string) {
  return db.footballIdentity.findUnique({
    where: { provider_kind_externalId: { provider, kind, externalId } },
  });
}
export async function bindIdentity(
  provider: string,
  kind: EntityKind,
  externalId: string,
  entityId: string,
  externalName?: string,
) {
  const prior = await identity(provider, kind, externalId);
  if (prior && prior.entityId !== entityId) throw new Error('IDENTITY_ALREADY_BOUND');
  return db.footballIdentity.upsert({
    where: { provider_kind_externalId: { provider, kind, externalId } },
    create: { provider, kind, externalId, externalName, entityId },
    update: { externalName },
  });
}
export async function resolveIdentity(
  provider: string,
  kind: EntityKind,
  externalId: string,
  externalName: string,
  candidates: string[],
) {
  const existing = await identity(provider, kind, externalId);
  if (existing) return existing.entityId;
  if (candidates.length > 1) {
    const id = `${provider}:${kind}:${externalId}`;
    await db.mappingIssue.upsert({
      where: { id },
      create: { id, provider, kind, externalId, externalName, candidates },
      update: { candidates, resolvedAt: null },
    });
    log('TEAM_MAPPING_REQUIRED', { code: 'AMBIGUOUS_IDENTITY' });
    throw new Error('TEAM_MAPPING_REQUIRED');
  }
  const id = candidates[0] ?? randomUUID();
  await bindIdentity(provider, kind, externalId, id, externalName);
  return id;
}
