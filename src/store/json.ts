/**
 * JSON Serialization Utilities for Redux
 *
 * Store lists, maps, and objects as JSON strings in Redux.
 * Parse them ONLY when accessed via selectors.
 */


/**
 * Convert any data to JSON string for storage
 */
export function toJSON<T>(data: T): string {
  return JSON.stringify(data);
}

/**
 * Parse JSON string back to typed data
 * @param json - JSON string to parse
 * @param fallback - Optional fallback value if parsing fails
 * @returns Parsed data or fallback if parsing fails
 */
export function fromJSON<T>(json: string, fallback?: T): T {
  try {
    return JSON.parse(json);
  } catch {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`Failed to parse JSON: ${json}`);
  }
}

