export interface GoalColors {
  active: string;    // Red (e.g., "#FF0000")
  inactive: string;  // Yellow (e.g., "#FFFF00")
  paused: string;    // Gray (e.g., "#808080")
  text: string;      // Lime (e.g., "#00FF00")
}

export interface Goal {
  symbols: [string, string, string, string];  // Replace Z, A, S, X (each max 1 char)
  colors: GoalColors;
  size: number;  // Percentage scale: 50-300% (100 = default size)
}

// Default goal settings (current hardcoded colors)
export const DEFAULT_GOAL: Goal = {
  symbols: ['Z', 'A', 'S', 'X'],
  colors: {
    active: '#FF0000',    // Red
    inactive: '#FFFF00',  // Yellow
    paused: '#808080',    // Gray
    text: '#00FF00'       // Lime
  },
  size: 100  // Default size (100% = normal)
};

export const GOAL_SYMBOL_MAX_LENGTH = 1;  // Single char per symbol

// Arrow key code mappings (for input handling)
// Maps keyboard event.key (e.g., 'ArrowUp') to storage name (e.g., 'UpArrow')
export const ARROW_KEYS = {
  'ArrowUp': 'UpArrow',
  'ArrowDown': 'DownArrow',
  'ArrowLeft': 'LeftArrow',
  'ArrowRight': 'RightArrow',
} as const;

// Display mappings for rendering arrows as symbols
export const ARROW_DISPLAY = {
  'UpArrow': '↑',
  'DownArrow': '↓',
  'LeftArrow': '←',
  'RightArrow': '→',
} as const;

// Helper: Get display symbol (arrow icon or char)
export function renderSymbol(symbol: string): string {
  return ARROW_DISPLAY[symbol as keyof typeof ARROW_DISPLAY] ?? symbol;
}
