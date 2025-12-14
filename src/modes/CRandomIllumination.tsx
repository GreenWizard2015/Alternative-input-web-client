import Spline from 'cubic-spline';
import { calcDistance, clip, generatePoints, uniform } from './utils';

type Point = { x: number, y: number };

class CIlluminationSource {
  radius: number;
  color: number[];
  points: Point[];
  currentTime: number;
  maxT: number;
  pos: number[];
  getPoint: (t: number) => Point;

  constructor() {
    this.radius = uniform(0.01, 0.1);
    this.color = [Math.random(), Math.random(), Math.random()];
    this.points = [];
    this.currentTime = 0;
    this.maxT = 0;
    this.newSpline(false);
    this.pos = [0.5, 0.5]; // Default starting position
  }

  newSpline(extend = true) {
    this.currentTime = 0;
    const N = 3;
    let points = generatePoints(N + 1);
    if (extend) {
      const lastNPoints = this.points.slice(-N);
      points = [...lastNPoints, ...points];
    }
    this.points = points = points.map(({ x, y }) => ({ 
      x: clip(x, -0.5, 1.5), 
      y: clip(y, -0.5, 1.5)
    }));
    let distance = calcDistance(points);
    // I'm already prepended a zero
    const speed = uniform(0.15, 1.0);
    const fullDistance = distance[distance.length - 1];
    const T = fullDistance / speed;
    this.maxT = clip(T, 20, 40);
    distance = distance.map(dist => dist / fullDistance);
    
    const shift = extend ? distance[N - 1] : 0.0;    
    const splines = {
      x: new Spline(distance, points.map(point => point.x)),
      y: new Spline(distance, points.map(point => point.y))
    };
    this.getPoint = t => ({
        x: splines.x.at(t * (1 - shift) + shift),
        y: splines.y.at(t * (1 - shift) + shift)
    })
  }

  onTick(deltaT: number) {
    this.currentTime += deltaT;
    if (this.maxT < this.currentTime) {
      this.newSpline();
    }
    const pos = this.getPoint(this.currentTime / this.maxT);

    // in 0..1
    pos.x = Math.min(Math.max(pos.x, 0), 1);
    pos.y = Math.min(Math.max(pos.y, 0), 1);
    if (isNaN(pos.x) || isNaN(pos.y)) {
      return;
    }
    this.pos = [pos.x, pos.y];
  }

  onRender(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const pos = [this.pos[0] * width, this.pos[1] * height];
    const color = this.color.map(c => Math.round(c * 255));
    const R = Math.min(this.radius * width, this.radius * height);
    ctx.beginPath();
    ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    ctx.arc(pos[0], pos[1], R, 0, 2 * Math.PI);
    ctx.fill();
  }
}

class CRandomIllumination {
  sources: CIlluminationSource[];
  enabled: boolean;

  constructor(sourcesN: number = 32) {
    this.sources = Array.from({ length: sourcesN }, () => new CIlluminationSource());
    this.enabled = true;
  }

  onTick(deltaT: number) {
    this.sources.forEach(source => source.onTick(deltaT));
  }

  onRender(ctx: CanvasRenderingContext2D, width: number, height: number) {
    if (!this.enabled) return;
    this.sources.forEach(source => source.onRender(ctx, width, height));
  }

  onEvent(event: KeyboardEvent) {
    if (event.key === 'i') {
      this.enabled = !this.enabled;
    }
  }
}

export default CRandomIllumination;
