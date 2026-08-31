// ===== sprites.ts — dibujo de Ranaria por primitivas de canvas =====
//
// El spec descarta los sprites bitmap: no hay assets de Frogger en el repo y dibujar por
// código evita depender de una carga que puede fallar. Todo sale de rectángulos, arcos y
// elipses.
//
// Las funciones reciben la caja en px del **tablero** (el juego ya ha trasladado el
// contexto por OFFSET_X/OFFSET_Y) y la paleta activa. La paleta va por parámetro y no
// leída de un módulo para dejar hecho el hueco de las skins: cambiar de skin será pasar
// otro objeto, sin tocar una sola línea de dibujo.
import { CELL } from "./constants";
// La paleta y sus skins viven en `skins.ts`: aquí solo se consumen por parámetro, así que
// añadir una skin no toca ni una línea de dibujo.
import type { RanariaPalette } from "./skins";
/** Rectángulo redondeado, sin depender de `roundRect` del navegador. */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
/** Dos ruedas asomando por debajo de la carrocería. */
function drawWheels(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  palette: RanariaPalette,
) {
  const r = h * 0.14;
  ctx.fillStyle = palette.wheel;
  for (const cx of [x + w * 0.22, x + w * 0.78]) {
    ctx.beginPath();
    ctx.arc(cx, y + h - r * 0.6, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
/**
 * Coche: carrocería redondeada con franja de cristales. El color sale de `variant`, que
 * es el índice de la entidad en su carril, así que no cambia entre frames.
 */
export function drawCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  variant: number,
  palette: RanariaPalette,
) {
  const pad = CELL * 0.12;
  const bx = x + pad;
  const by = y + pad;
  const bw = w - pad * 2;
  const bh = CELL - pad * 2;
  drawWheels(ctx, bx, by, bw, bh, palette);
  ctx.fillStyle = palette.carBodies[variant % palette.carBodies.length];
  roundedRect(ctx, bx, by, bw, bh, CELL * 0.18);
  ctx.fill();
  ctx.fillStyle = palette.carGlass;
  roundedRect(ctx, bx + bw * 0.28, by + bh * 0.22, bw * 0.44, bh * 0.34, CELL * 0.08);
  ctx.fill();
}
/** Camión: caja larga y clara con la cabina destacada en el sentido de la marcha. */
export function drawTruck(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  dir: 1 | -1,
  palette: RanariaPalette,
) {
  const pad = CELL * 0.1;
  const bx = x + pad;
  const by = y + pad;
  const bw = w - pad * 2;
  const bh = CELL - pad * 2;
  drawWheels(ctx, bx, by, bw, bh, palette);
  ctx.fillStyle = palette.truckBody;
  roundedRect(ctx, bx, by, bw, bh, CELL * 0.1);
  ctx.fill();
  const cabW = Math.min(bw * 0.34, CELL * 0.9);
  const cabX = dir === 1 ? bx + bw - cabW : bx;
  ctx.fillStyle = palette.truckCab;
  roundedRect(ctx, cabX, by, cabW, bh, CELL * 0.1);
  ctx.fill();
}
/** Tronco: barra marrón con vetas y los cortes de los extremos, que le dan volumen. */
export function drawLog(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  palette: RanariaPalette,
) {
  const pad = CELL * 0.14;
  const by = y + pad;
  const bh = CELL - pad * 2;
  ctx.fillStyle = palette.logBody;
  roundedRect(ctx, x, by, w, bh, bh * 0.4);
  ctx.fill();
  ctx.strokeStyle = palette.logGrain;
  ctx.lineWidth = 1.5;
  for (const t of [0.34, 0.62]) {
    ctx.beginPath();
    ctx.moveTo(x + CELL * 0.2, by + bh * t);
    ctx.lineTo(x + w - CELL * 0.2, by + bh * t);
    ctx.stroke();
  }
  ctx.fillStyle = palette.logGrain;
  for (const cx of [x + CELL * 0.1, x + w - CELL * 0.1]) {
    ctx.beginPath();
    ctx.ellipse(cx, by + bh / 2, CELL * 0.07, bh * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
/**
 * Grupo de tortugas: una por celda de ancho. A flote son caparazones con escamas; bajo el
 * agua quedan como contorno translúcido — se ven, avisan de que volverán, pero no
 * sostienen.
 */
export function drawTurtles(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  submerged: boolean,
  palette: RanariaPalette,
) {
  const count = Math.max(1, Math.round(w / CELL));
  const r = CELL * 0.36;
  for (let i = 0; i < count; i++) {
    const cx = x + (i + 0.5) * (w / count);
    const cy = y + CELL / 2;
    if (submerged) {
      ctx.strokeStyle = palette.turtleSubmerged;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = palette.turtleShell;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.turtleShellDark;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.52, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.turtleShellDark;
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55);
      ctx.lineTo(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95);
      ctx.stroke();
    }
  }
}
/**
 * Boca destino: hueco oscuro con borde dorado. Ocupada, lleva dentro la silueta de la
 * rana que llegó — es lo que deja contar de un vistazo cuántas quedan.
 */
export function drawGoal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  filled: boolean,
  palette: RanariaPalette,
) {
  const pad = CELL * 0.1;
  ctx.fillStyle = palette.goalBg;
  roundedRect(ctx, x + pad, y + pad, w - pad * 2, CELL - pad * 2, CELL * 0.16);
  ctx.fill();
  ctx.strokeStyle = palette.goalBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
  if (!filled) return;
  const cx = x + w / 2;
  const cy = y + CELL / 2;
  ctx.fillStyle = palette.goalFilled;
  ctx.beginPath();
  ctx.ellipse(cx, cy, CELL * 0.3, CELL * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - CELL * 0.14, cy - CELL * 0.18, CELL * 0.09, 0, Math.PI * 2);
  ctx.arc(cx + CELL * 0.14, cy - CELL * 0.18, CELL * 0.09, 0, Math.PI * 2);
  ctx.fill();
}
/**
 * Rana: cuerpo elíptico, vientre y dos ojos saltones, más cuatro patas que se estiran
 * durante el salto (`stretch` va de 0 en reposo a 1 en mitad del salto). `facing` gira el
 * dibujo entero, de modo que mire adonde saltó.
 */
export function drawFrog(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  facing: number,
  stretch: number,
  dead: boolean,
  palette: RanariaPalette,
) {
  const body = dead ? palette.frogDead : palette.frogBody;
  const rx = CELL * 0.35;
  const ry = CELL * 0.3;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(facing);
  ctx.fillStyle = body;
  const legOut = CELL * (0.24 + 0.16 * stretch);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      ctx.save();
      ctx.translate(sx * legOut * 0.85, sy * legOut * 0.7);
      ctx.rotate((sx * sy * Math.PI) / 5);
      ctx.beginPath();
      ctx.ellipse(0, 0, CELL * 0.14, CELL * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dead ? body : palette.frogBelly;
  ctx.beginPath();
  ctx.ellipse(0, ry * 0.3, rx * 0.5, ry * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const sx of [-1, 1]) {
    const ex = sx * rx * 0.5;
    const ey = -ry * 0.62;
    ctx.fillStyle = palette.frogEye;
    ctx.beginPath();
    ctx.arc(ex, ey, CELL * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.frogPupil;
    ctx.beginPath();
    ctx.arc(ex, ey - CELL * 0.02, CELL * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
/** Icono de vida del HUD interno: la misma rana, en pequeño y siempre de frente. */
export function drawLifeIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  palette: RanariaPalette,
) {
  ctx.fillStyle = palette.frogBody;
  ctx.beginPath();
  ctx.ellipse(cx, cy, CELL * 0.17, CELL * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.frogEye;
  ctx.beginPath();
  ctx.arc(cx - CELL * 0.08, cy - CELL * 0.11, CELL * 0.055, 0, Math.PI * 2);
  ctx.arc(cx + CELL * 0.08, cy - CELL * 0.11, CELL * 0.055, 0, Math.PI * 2);
  ctx.fill();
}
