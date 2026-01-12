import { findDuplicateSymbolIndices, hasSymbolDuplicates } from './goalValidation';

describe('findDuplicateSymbolIndices', () => {
  // No duplicates
  it('should return empty array for all unique symbols', () => {
    expect(findDuplicateSymbolIndices(['Z', 'A', 'S', 'X'])).toEqual([]);
  });

  // Character duplicates - case insensitive
  it('should detect duplicate chars case-insensitive', () => {
    const result = findDuplicateSymbolIndices(['Z', 'z', 'S', 'X']);
    expect(result).toContain(0);
    expect(result).toContain(1);
    expect(result.length).toBe(2);
  });

  it('should detect multiple pairs of duplicates', () => {
    const result = findDuplicateSymbolIndices(['Z', 'A', 'z', 'a']);
    expect(result).toContain(0);
    expect(result).toContain(2);
    expect(result).toContain(1);
    expect(result).toContain(3);
    expect(result.length).toBe(4);
  });

  // Arrow key duplicates
  it('should detect duplicate arrow keys', () => {
    const result = findDuplicateSymbolIndices(['UpArrow', 'A', 'UpArrow', 'X']);
    expect(result).toContain(0);
    expect(result).toContain(2);
    expect(result.length).toBe(2);
  });

  // Mixed char and arrow
  it('should allow char and arrow with different values', () => {
    // Z and UpArrow are not duplicates
    expect(findDuplicateSymbolIndices(['Z', 'UpArrow', 'A', 'S'])).toEqual([]);
  });

  // Edge case: empty strings
  it('should handle empty string symbols', () => {
    const result = findDuplicateSymbolIndices(['', 'A', '', 'X']);
    expect(result).toContain(0);
    expect(result).toContain(2);
  });

  // All same
  it('should detect when all symbols are same', () => {
    const result = findDuplicateSymbolIndices(['Z', 'Z', 'Z', 'Z']);
    expect(result).toEqual([0, 1, 2, 3]);
  });
});

describe('hasSymbolDuplicates', () => {
  it('should return false for unique symbols', () => {
    expect(hasSymbolDuplicates(['Z', 'A', 'S', 'X'])).toBe(false);
  });

  it('should return true for duplicate symbols', () => {
    expect(hasSymbolDuplicates(['Z', 'A', 'Z', 'X'])).toBe(true);
  });

  it('should return true for case-insensitive duplicates', () => {
    expect(hasSymbolDuplicates(['Z', 'a', 'z', 'x'])).toBe(true);
  });

  it('should return true for arrow duplicates', () => {
    expect(hasSymbolDuplicates(['UpArrow', 'A', 'UpArrow', 'X'])).toBe(true);
  });
});
