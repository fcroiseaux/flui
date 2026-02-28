/**
 * Deterministic SHA-256 cache key generation.
 * Uses Web Crypto API (browser + Node 15+) with node:crypto fallback.
 */

async function sha256(input: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  const nodeCrypto: { createHash(alg: string): { update(data: string): { digest(enc: string): string } } } = await import('node:crypto');
  return nodeCrypto.createHash('sha256').update(input).digest('hex');
}

function normalizeForKey(
  intent: string,
  context: Record<string, unknown>,
  registryVersion: string,
  specVersion: string,
  contextKeySignals?: string[],
): string {
  const filteredContext =
    contextKeySignals !== undefined
      ? Object.fromEntries(
          Object.entries(context).filter(([key]) => contextKeySignals.includes(key)),
        )
      : context;

  const sortedKeys = Object.keys(filteredContext).sort();
  const sortedContext = JSON.stringify(filteredContext, sortedKeys);

  return JSON.stringify({
    intent,
    context: sortedContext,
    registryVersion,
    specVersion,
  });
}

/**
 * Build a deterministic SHA-256 cache key from intent + context + versions.
 *
 * @param intent - The intent string
 * @param context - Context key-value pairs
 * @param registryVersion - Component registry version
 * @param specVersion - UISpecification format version
 * @param contextKeySignals - Optional subset of context keys to include
 * @returns Hex-encoded SHA-256 hash string (64 characters)
 */
export async function buildCacheKey(
  intent: string,
  context: Record<string, unknown>,
  registryVersion: string,
  specVersion: string,
  contextKeySignals?: string[],
): Promise<string> {
  const normalized = normalizeForKey(intent, context, registryVersion, specVersion, contextKeySignals);
  return sha256(normalized);
}
