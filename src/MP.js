
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

function _isValidPoint(point, { visibilityThreshold, presenceThreshold }) {
  return true; // consider all points valid
  if (point.visibility && (point.visibility < visibilityThreshold)) return false;
  if (point.presence && (point.presence < presenceThreshold)) return false;
  return true;
}

export function decodeLandmarks(landmarks, {
  height, width, visibilityThreshold = 0.5, presenceThreshold = 0.5,
}) {
  const points = {};
  for (let idx = 0; idx < landmarks.length; idx++) {
    const mark = landmarks[idx];
    if (!_isValidPoint(mark, { visibilityThreshold, presenceThreshold })) continue;

    const x_px = Math.floor(mark.x * width);
    const y_px = Math.floor(mark.y * height);
    points[idx] = { x: x_px, y: y_px, };
  }
  return points;
}

function _ABRect(A, B) {
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

function _rectFromPoints(pts, { height, width, padding = 0 }) {
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

  return _ABRect(A, B);
}

function _circleROI(pts, { height, width, padding = 1.5 }) {
  const centerPtCum = pts.reduce((acc, pt) => {
    return {
      x: acc.x + pt.x,
      y: acc.y + pt.y,
    };
  }, { x: 0, y: 0 });
  const centerPt = {
    x: centerPtCum.x / pts.length,
    y: centerPtCum.y / pts.length,
  };

  const radius = pts.reduce((acc, pt) => {
    const dx = pt.x - centerPt.x;
    const dy = pt.y - centerPt.y;
    return Math.max(acc, Math.sqrt(dx * dx + dy * dy));
  }, 0);
  if (radius < 5) return null;

  const R = Math.ceil(radius * padding);
  const A = { x: centerPt.x - R, y: centerPt.y - R };
  const B = { x: centerPt.x + R, y: centerPt.y + R };
  return _ABRect(A, B);
}

const _CROP_MODES = {
  "rect": _rectFromPoints,
  "circle": _circleROI,
};

function _toGrayscale(rgba) {
  const gray = new Uint8ClampedArray(Math.ceil(rgba.length / 4));
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const grayValue = Math.floor(0.2989 * r + 0.5870 * g + 0.1140 * b);
    gray[j] = grayValue;
  }
  return gray;
}

function _points2crop(pts, canvas, {
  mode,
  padding, SIZE, image
}) {
  const ROI = _CROP_MODES[mode](pts, { height: image.height, width: image.width, padding });
  if (null === ROI) return new Uint8ClampedArray(SIZE * SIZE);

  // cut out the part and resize to SIZE x SIZE
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(
    image,
    ROI.x, ROI.y, ROI.width, ROI.height,
    0, 0, SIZE, SIZE
  );

  const rgba = ctx.getImageData(0, 0, SIZE, SIZE).data;
  return _toGrayscale(rgba);
}

export function grayscale2image(gray, size) {
  const imgData = new ImageData(size, size);
  for (let i = 0, j = 0; i < gray.length; i++, j += 4) {
    imgData.data[j] = gray[i];
    imgData.data[j + 1] = gray[i];
    imgData.data[j + 2] = gray[i];
    imgData.data[j + 3] = 255;
  }
  return imgData;
}

export function results2sample(results, tmpCanvas, {
  mode = "circle", padding = 1.25,
  visibilityThreshold = 0.5, presenceThreshold = 0.5,
  SIZE = 40,
}) {
  if (!results) return null;
  if (!results.multiFaceLandmarks) return null;
  if (results.multiFaceLandmarks.length < 1) return null;

  const { height, width, } = results.image;
  const landmarks = results.multiFaceLandmarks[0];
  const decoded = decodeLandmarks(landmarks, {
    height, width, visibilityThreshold, presenceThreshold,
  });

  const leftEye = _points2crop(
    MPParts.leftEye.map(idx => decoded[idx]),
    tmpCanvas,
    { mode, padding, SIZE, image: results.image }
  );
  const rightEye = _points2crop(
    MPParts.rightEye.map(idx => decoded[idx]),
    tmpCanvas,
    { mode, padding, SIZE, image: results.image }
  );

  const pointsArray = new Float32Array(468 * 2);
  for (let i = 0; i < 468; i++) {
    const pt = _isValidPoint(landmarks[i], { visibilityThreshold, presenceThreshold }) ?
      landmarks[i] : { x: -10, y: -10 };

    pointsArray[i * 2] = pt.x;
    pointsArray[i * 2 + 1] = pt.y;
  }

  return {
    time: Date.now(),
    leftEye,
    rightEye,
    points: pointsArray,
  };
}