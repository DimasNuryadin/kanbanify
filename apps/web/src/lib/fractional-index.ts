import { FractionalIndex } from "@kinetix/contracts";

const BASE62_DIGITS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Computes a lexicographical midpoint string in BASE62 between `a` and `b`
 * where `a < b`.
 */
function midpoint(a: string, b: string | undefined): string {
  if (b !== undefined && a >= b) {
    throw new Error(`Invalid fractional index bounds: "${a}" >= "${b}"`);
  }

  // Strip common prefix
  let n = 0;
  while (n < a.length && b !== undefined && n < b.length && a[n] === b[n]) {
    n++;
  }
  if (n > 0) {
    return a.slice(0, n) + midpoint(a.slice(n), b ? b.slice(n) : undefined);
  }

  // If `a` is empty and `b` starts with '0', we must prefix '0' and recurse on b.slice(1)
  if (a.length === 0 && b !== undefined && b.length > 0 && b[0] === BASE62_DIGITS[0]) {
    return BASE62_DIGITS[0] + midpoint("", b.slice(1));
  }

  const digitA = a.length > 0 ? BASE62_DIGITS.indexOf(a[0]) : 0;
  const digitB =
    b !== undefined && b.length > 0
      ? BASE62_DIGITS.indexOf(b[0])
      : BASE62_DIGITS.length;

  const safeA = digitA < 0 ? 0 : digitA;
  const safeB = digitB < 0 ? BASE62_DIGITS.length : digitB;

  if (safeB - safeA > 1) {
    const midDigit = Math.floor((safeA + safeB) / 2);
    return BASE62_DIGITS[midDigit];
  } else {
    // Digits are adjacent (e.g., '0' and '1' in "a0" and "a1").
    // Since safeA < safeB, any string starting with BASE62_DIGITS[safeA] is strictly < b,
    // and appending midpoint(a.slice(1), undefined) makes it strictly > a.
    const prefixChar = BASE62_DIGITS[safeA];
    return prefixChar + midpoint(a.slice(1), undefined);
  }
}

/**
 * Generates an O(1) lexicographical fractional index between `prevPos` and `nextPos`.
 *
 * Examples:
 * - generatePositionBetween(undefined, undefined) -> "a0"
 * - generatePositionBetween("a0", undefined)      -> "a1"
 * - generatePositionBetween("a0", "a1")           -> "a0V"
 * - generatePositionBetween(undefined, "a0")      -> "Zz"
 */
export function generatePositionBetween(
  prevPos?: FractionalIndex | null,
  nextPos?: FractionalIndex | null
): FractionalIndex {
  const prev = prevPos?.trim() || undefined;
  const next = nextPos?.trim() || undefined;

  if (!prev && !next) {
    return "a0";
  }

  if (!prev && next) {
    // Inserting before the first item
    if (next > "a0") {
      return "a0";
    }
    const firstCharIdx = BASE62_DIGITS.indexOf(next[0]);
    if (firstCharIdx > 1) {
      const lastCharIdx = BASE62_DIGITS.indexOf(next[next.length - 1]);
      if (next.length > 1 && lastCharIdx > 0) {
        return (
          next.slice(0, -1) + BASE62_DIGITS[Math.floor(lastCharIdx / 2)]
        );
      }
      return BASE62_DIGITS[firstCharIdx - 1] + "z";
    }
    return midpoint("", next);
  }

  if (prev && !next) {
    // Appending after the last item
    const lastIdx = prev.length - 1;
    const lastDigit = BASE62_DIGITS.indexOf(prev[lastIdx]);
    if (lastDigit >= 0 && lastDigit < BASE62_DIGITS.length - 2) {
      return prev.slice(0, lastIdx) + BASE62_DIGITS[lastDigit + 1];
    }
    return prev + BASE62_DIGITS[Math.floor(BASE62_DIGITS.length / 2)];
  }

  // Both prev and next exist
  if (prev! >= next!) {
    return prev! + "V";
  }

  return midpoint(prev!, next!);
}

/**
 * Strict lexicographical comparator for FractionalIndex strings.
 */
export function comparePositions(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
