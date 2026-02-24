export function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('Expected a positive integer');
  }

  return value;
}
