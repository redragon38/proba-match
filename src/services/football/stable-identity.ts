import { createHash } from 'node:crypto';

import type { EntityKind } from './identities';

export function stableEntityId(provider: string, kind: EntityKind, externalId: string) {
  if (!provider.trim() || !kind.trim() || !externalId.trim()) throw new Error('INVALID_STABLE_ID');

  const digest = createHash('sha256')
    .update('proba-match/entity/v1\0')
    .update(provider)
    .update('\0')
    .update(kind)
    .update('\0')
    .update(externalId)
    .digest();
  const bytes = Buffer.from(digest.subarray(0, 16));

  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20)}`;
}
