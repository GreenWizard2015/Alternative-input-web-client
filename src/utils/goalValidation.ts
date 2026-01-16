/**
 * Goal validation utilities for symbol uniqueness checking
 */

/**
 * Check if all symbols are unique (case-insensitive for chars, exact match for arrows)
 * Returns array of indices that have duplicates
 */
export function findDuplicateSymbolIndices(symbols: [string, string, string, string]): number[] {
  const seen = new Map<string, number[]>();

  symbols.forEach((symbol, index) => {
    // Normalize: uppercase for chars, keep as-is for arrows (UpArrow, LeftArrow, etc.)
    const normalized = /^(Up|Down|Left|Right)Arrow$/.test(symbol) ? symbol : symbol.toUpperCase();

    let indices = seen.get(normalized);
    if (!indices) {
      indices = [];
      seen.set(normalized, indices);
    }
    indices.push(index);
  });

  // Collect indices of duplicates (all indices where count > 1)
  const duplicates: number[] = [];
  seen.forEach(indices => {
    if (indices.length > 1) {
      duplicates.push(...indices);
    }
  });

  return duplicates;
}

/**
 * Check if Goal has any duplicate symbols
 */
export function hasSymbolDuplicates(symbols: [string, string, string, string]): boolean {
  return findDuplicateSymbolIndices(symbols).length > 0;
}
