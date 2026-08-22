// ===== utils.ts — helpers geométricos y de azar =====

export const wrap = (v: number, max: number) => ((v % max) + max) % max;

export interface Point {
  x: number;
  y: number;
}

export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export const rand = (min: number, max: number) => min + Math.random() * (max - min);

export const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
