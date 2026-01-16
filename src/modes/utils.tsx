type Point = { x: number; y: number };

function gaussian(mean: number = 0, stdev: number = 1): number {
  const u = 1 - Math.random(); // Converting [0,1) to (0,1]
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  // Transform to the desired mean and standard deviation:
  return z * stdev + mean;
}

function uniform(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function generatePoints(count: number): Point[] {
  const res = new Array(count);
  for (let i = 0; i < count; i++) {
    res[i] = {
      x: gaussian(0.5, 0.5),
      y: gaussian(0.5, 0.5),
    };
  }
  return res;
}

function clip(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function distance({ x: x1, y: y1 }: Point, { x: x2, y: y2 }: Point): number {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function calcDistance(points: Point[]): number[] {
  // I don't care about performance
  return points.slice(1).reduce(
    ({ acc, lp }, point) => {
      return {
        acc: acc.concat([distance(lp, point) + acc[acc.length - 1]]),
        lp: point,
      };
    },
    { acc: [0], lp: points[0] }
  ).acc;
}

export { gaussian, uniform, generatePoints, clip, distance, calcDistance };
