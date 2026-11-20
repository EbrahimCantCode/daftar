/**
 * Random id without colons (recurring entry ids use ':' as a separator).
 * crypto.randomUUID only exists in secure contexts, so fall back to getRandomValues
 * when the app is opened over plain http on a LAN address.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
