import type { CountEntry, LocalCountEntry } from "@/lib/types";

function addQuantity(counts: Map<string, number>, batchId: string | undefined, quantity: number) {
  if (!batchId) return;
  counts.set(batchId, (counts.get(batchId) ?? 0) + quantity);
}

export function indexActiveCountQuantities(entries: readonly CountEntry[], sessionId: string) {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.sessionId === sessionId && !entry.isVoided) {
      addQuantity(counts, entry.stockBatchId, entry.quantity);
    }
  }
  return counts;
}

export function indexUnsyncedCountQuantities(entries: readonly LocalCountEntry[], sessionId: string) {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.sessionId === sessionId && entry.syncState !== "synced") {
      addQuantity(counts, entry.stockBatchId, entry.quantity);
    }
  }
  return counts;
}

export function getCountedBatchIds(
  serverEntries: readonly CountEntry[],
  localEntries: readonly LocalCountEntry[],
  sessionId: string
) {
  const batchIds = new Set(indexActiveCountQuantities(serverEntries, sessionId).keys());
  for (const entry of localEntries) {
    if (entry.sessionId === sessionId && entry.stockBatchId) batchIds.add(entry.stockBatchId);
  }
  return batchIds;
}
