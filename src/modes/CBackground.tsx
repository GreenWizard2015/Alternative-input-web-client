class CBackground {
  private _backgroundDynamic: boolean;
  private _colors: number[][];
  private _currentTime: number = 0;

  constructor() {
    this._backgroundDynamic = true;
    // Example colors similar to the Colors.asList from Python
    this._colors = [
      [0, 0, 0],       // Black
      [255, 255, 255], // White
      [0, 255, 255],   // Aqua
      [0, 0, 255],     // Blue
      [165, 42, 42],   // Brown
      [169, 169, 169], // Dark Gray
      [0, 128, 0],     // Green
      [128, 128, 128], // Gray
      [240, 230, 140], // Khaki
      [128, 0, 128],   // Purple
      [255, 165, 0],   // Orange
      [255, 192, 203], // Pink
      [128, 0, 0],     // Maroon
      [255, 215, 0],   // Gold
      [0, 128, 128],   // Teal
      [255, 255, 0],   // Yellow
      [192, 192, 192], // Silver
      [210, 180, 140], // Tan
      [255, 250, 240], // Floral White
      [144, 238, 144], // Light Green
      [70, 130, 180],  // Steel Blue
      [211, 211, 211], // Light Grey
      [245, 245, 220], // Beige
      [112, 128, 144], // Slate Gray
      [106, 90, 205],  // Slate Blue
      [250, 128, 114], // Salmon
      [138, 43, 226],  // Blue Violet
      [32, 178, 170],  // Light Sea Green
      [135, 206, 250], // Light Sky Blue
      [100, 149, 237], // Cornflower Blue
      [127, 255, 212], // Aquamarine
      [222, 184, 135], // Burlywood
      [95, 158, 160],  // Cadet Blue
      [220, 220, 220], // Gainsboro
      [248, 248, 255], // Ghost White
      [218, 165, 32],  // Goldenrod
      [173, 255, 47],  // Green Yellow
      [255, 105, 180], // Hot Pink
      [205, 92, 92],   // Indian Red
      [75, 0, 130],    // Indigo
      [240, 255, 240], // Honeydew
      [245, 255, 250], // Mint Cream
      [255, 228, 225], // Misty Rose
      [255, 228, 181], // Moccasin
      [255, 222, 173], // Navajo White
      [0, 0, 128],     // Navy
      [253, 245, 230], // Old Lace
      [107, 142, 35],  // Olive Drab
      [255, 160, 122], // Light Salmon
      [176, 224, 230], // Powder Blue
      [189, 183, 107], // Dark Khaki
      [139, 69, 19],   // Saddle Brown
      [255, 245, 238], // Seashell
      [160, 82, 45],   // Sienna
      [135, 206, 235], // Sky Blue
      [106, 90, 205],  // Slate Blue
      [46, 139, 87],   // Sea Green
      [240, 255, 255], // Azure
      [25, 25, 112],   // Midnight Blue
      [255, 250, 205], // Lemon Chiffon
      [124, 252, 0],   // Lawn Green
      [255, 240, 245], // Lavender Blush
      [173, 216, 230], // Light Blue
      [240, 128, 128], // Light Coral
      [224, 255, 255], // Light Cyan
      [250, 250, 210], // Light Goldenrod Yellow
      [230, 230, 250], // Lavender
      [255, 248, 220], // Cornsilk
      [245, 245, 245], // White Smoke
      [255, 239, 213], // Papaya Whip
      [255, 218, 185], // Peach Puff
      [205, 133, 63],  // Peru
      [255, 182, 193], // Light Pink
      [65, 105, 225],  // Royal Blue
      [139, 0, 0],     // Dark Red
      [72, 61, 139],   // Dark Slate Blue
      [47, 79, 79],    // Dark Slate Gray
      [0, 206, 209],   // Dark Turquoise
      [148, 0, 211],   // Dark Violet
      [255, 99, 71],   // Tomato
      [64, 224, 208],  // Turquoise
      [238, 130, 238], // Violet
      [245, 222, 179], // Wheat
      [154, 205, 50],  // Yellow Green
      [102, 51, 153],  // Rebecca Purple
      [30, 144, 255],  // Dodger Blue
      [178, 34, 34],   // Firebrick
      [34, 139, 34],   // Forest Green
      [255, 0, 255],   // Fuchsia
      [218, 165, 32],  // Goldenrod
      [0, 139, 139],   // Dark Cyan
      [184, 134, 11],  // Dark Goldenrod
      [85, 107, 47],   // Dark Olive Green
      [123, 104, 238], // Medium Slate Blue
      [50, 205, 50],   // Lime Green
      [143, 188, 143], // Dark Sea Green
      [153, 50, 204],  // Dark Orchid
      [152, 251, 152], // Pale Green
      [175, 238, 238], // Pale Turquoise
      [219, 112, 147], // Pale Violet Red
      [255, 228, 196], // Bisque
      [0, 0, 139],     // Dark Blue
      [139, 0, 139],   // Dark Magenta
      [255, 69, 0],    // Orange Red
      [218, 112, 214], // Orchid
      [238, 232, 170], // Pale Goldenrod
      [60, 179, 113],  // Medium Sea Green
      [127, 255, 0],   // Chartreuse
      [72, 209, 204],  // Medium Turquoise
      [199, 21, 133],  // Medium Violet Red
    ];    
  }

  onTick(deltaT: number) {
    this._currentTime += deltaT;
  }

  _brightness() {
    const amplitude = 10.0;
    const duration = 30.0;
    const sin = Math.sin(2.0 * Math.PI * this._currentTime / duration);
    if (sin < 0) {
      return 1.0 / (amplitude * Math.abs(sin) + 1.0);
    }
    const res = 1.0 + amplitude * sin;
    return res;
  }

  onRender(canvasCtx, viewport) {
    let bg = [192, 192, 192]; // Default color (Silver)
    if (this._backgroundDynamic) {
      const colorIndex = Math.floor(this._currentTime / 15.0) % this._colors.length;
      bg = this._colors[colorIndex];
    }

    // Apply brightness to the background color
    const [r, g, b] = bg;
    const brightnessFactor = this._brightness();

    const brightenedColor = `rgb(
      ${this.clamp(Math.round(r * brightnessFactor), 0, 255)},
      ${this.clamp(Math.round(g * brightnessFactor), 0, 255)},
      ${this.clamp(Math.round(b * brightnessFactor), 0, 255)})`;

    canvasCtx.fillStyle = brightenedColor;
    canvasCtx.fillRect(0, 0, viewport.width, viewport.height);
  }

  onEvent(event) {
    if (event.type !== 'keydown') return;
    // Toggle background dynamic (B)
    if (event.key === 'b') {
      this._backgroundDynamic = !this._backgroundDynamic;
    }
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }
}

export default CBackground;