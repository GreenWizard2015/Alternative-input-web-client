export interface Point {
  x: number;
  y: number;
}

export function add(p1: Point, p2: Point): Point {
  return {
    x: p1.x + p2.x,
    y: p1.y + p2.y,
  };
}

export function subtract(p1: Point, p2: Point): Point {
  return {
    x: p1.x - p2.x,
    y: p1.y - p2.y,
  };
}

export function normalize(p: Point): Point {
  const dist = Math.sqrt(p.x ** 2 + p.y ** 2);
  if (dist === 0) return { x: p.x, y: p.y };
  return {
    x: p.x / dist,
    y: p.y / dist,
  };
}

export function multiplyScalar(p: Point, z: number): Point {
  return {
    x: p.x * z,
    y: p.y * z,
  };
}

export function addScalar(p: Point, z: number): Point {
  return {
    x: p.x + z,
    y: p.y + z,
  };
}

export function distance(p: Point): number {
  return Math.sqrt(p.x ** 2 + p.y ** 2);
}
