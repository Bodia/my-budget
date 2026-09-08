export async function computeTransactionHash(
  date: string,
  amount: number,
  description: string,
  accountId: string
): Promise<string> {
  const normalizedString = `${date.trim()}|${amount.toFixed(2)}|${description.toLowerCase().trim()}|${accountId.trim()}`;
  
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(normalizedString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback if subtle is unavailable
    }
  }

  // Fast deterministic fallback hash (djb2 + sdbm 64-bit combination)
  let h1 = 5381;
  let h2 = 0;
  for (let i = 0; i < normalizedString.length; i++) {
    const char = normalizedString.charCodeAt(i);
    h1 = ((h1 << 5) + h1) ^ char;
    h2 = char + (h2 << 6) + (h2 << 16) - h2;
  }
  return `hash_${(h1 >>> 0).toString(16)}_${(h2 >>> 0).toString(16)}`;
}

export function deduplicateDrafts<T extends { hash: string }>(
  incoming: T[],
  existingHashes: Set<string>
): { unique: T[]; duplicatesCount: number } {
  const seenInBatch = new Set<string>();
  const unique: T[] = [];
  let duplicatesCount = 0;

  for (const item of incoming) {
    if (existingHashes.has(item.hash) || seenInBatch.has(item.hash)) {
      duplicatesCount++;
    } else {
      seenInBatch.add(item.hash);
      unique.push(item);
    }
  }

  return { unique, duplicatesCount };
}
