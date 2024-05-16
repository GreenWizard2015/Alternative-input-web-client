function gaussian(mean = 0, stdev = 1) {
  let u = 1 - Math.random(); // Converting [0,1) to (0,1]
  let v = Math.random();
  let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  // Transform to the desired mean and standard deviation:
  return z * stdev + mean;
}

function uniform(min, max) {
  return min + Math.random() * (max - min);
}

function generatePoints(count) {
  const res = new Array(count);
  for (let i = 0; i < count; i++) {
    res[i] = {
      x: gaussian(0.5, 0.5),
      y: gaussian(0.5, 0.5)
    };
  }
  return res;
}

function clip(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function distance({ x: x1, y: y1 }, { x: x2, y: y2 }) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function calcDistance(points) {
  // I don't care about performance
  return points.slice(1).reduce(({ acc, lp }, point) => {
    return {
      acc: acc.concat([distance(lp, point) + acc[acc.length - 1]]),
      lp: point
    }
  }, { acc: [0], lp: points[0] }).acc;
}

export { gaussian, uniform, generatePoints, clip, distance, calcDistance};