
export const MPParts = {
  leftEye: [
    263, 249, 390, 373, 374, 380, 381, 382, 362, 263, 466, 388, 387, 386, 385,
    384, 398, 362,
  ],
  rightEye: [
    33, 7, 163, 144, 145, 153, 154, 155, 133, 33, 246, 161, 160, 159, 158, 157,
    173, 133,
  ],
  leftIris: [474, 475, 476, 477, 474],
  rightIris: [469, 470, 471, 472, 469],
  leftEyeBrow: [276, 283, 282, 295, 285, 300, 293, 334, 296, 336],
  rightEyeBrow: [46, 53, 52, 65, 55, 70, 63, 105, 66, 107],
  lips: [
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 61, 185, 40, 39, 37, 0,
    267, 269, 270, 409, 291, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308,
    78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308,
  ],
  nose: [5, 275, 94],
  foreHeadSpot: [151, 9, 8],
  faceBorder: [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
    378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
    162, 21, 54, 103, 67, 109, 10,
  ],
};

export function decodeLandmarks(landmarks, {
  height, width, visibilityThreshold = 0.5, presenceThreshold = 0.5,
}) {
  const points = {};
  for (let idx = 0; idx < landmarks.length; idx++) {
    const mark = landmarks[idx];
    // if (
    //   (mark.visibility && (mark.visibility < visibilityThreshold)) ||
    //   (mark.presence && (mark.presence < presenceThreshold))
    // ) {
    //   continue;
    // }
    const x_px = Math.floor(mark.x * width);
    const y_px = Math.floor(mark.y * height);
    points[idx] = { x: x_px, y: y_px, };
  }
  return points;
}

export function rectFromPoints(pts, { height, width, }, padding = 0) {
  // find min and max x and y
  const minmm = pts.reduce((acc, pt) => {
    return {
      x: Math.min(acc.x, pt.x),
      y: Math.min(acc.y, pt.y),
    };
  }, { x: width, y: height });
  const maxmm = pts.reduce((acc, pt) => {
    return {
      x: Math.max(acc.x, pt.x),
      y: Math.max(acc.y, pt.y),
    };
  }, { x: 0, y: 0 });

  if (((maxmm.x - minmm.x) < 5) || ((maxmm.y - minmm.y) < 5)) return null;

  const A = {
    x: Math.max(0, minmm.x - padding),
    y: Math.max(0, minmm.y - padding),
  };
  const B = {
    x: Math.min(width, maxmm.x + padding),
    y: Math.min(height, maxmm.y + padding),
  };

  return {
    x: A.x,
    y: A.y,
    width: B.x - A.x,
    height: B.y - A.y,

    x1: A.x,
    y1: A.y,
    x2: B.x,
    y2: B.y,
  };
}