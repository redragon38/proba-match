import type { Match } from '@/types/football';
/** Missing endpoint data retains its own old timestamp; an explicit empty clears it. */
export function mergeDetailRevisions(local: Match, incoming: Match): Match {
  const merged = {
    ...incoming,
    detailObservedAt: { ...local.detailObservedAt },
    detailSource: { ...local.detailSource },
    detailFallback: [] as string[],
  };
  for (const field of ['events', 'lineups', 'statistics', 'performances'] as const) {
    if (incoming.detailPresence?.[field] === true) {
      Object.assign(merged, { [field]: incoming[field] ?? [] });
      merged.detailSource[field] =
        incoming.detailSource?.[field] ?? incoming.provenance?.details ?? incoming.source;
      merged.detailObservedAt[field] =
        incoming.detailObservedAt?.[field] ?? incoming.detailsUpdatedAt ?? incoming.updatedAt;
    } else {
      Object.assign(merged, { [field]: local[field] ?? [] });
      merged.detailSource[field] =
        local.detailSource?.[field] ?? local.provenance?.details ?? local.source;
      if (local[field]?.length) merged.detailFallback.push(field);
    }
  }
  return merged;
}
