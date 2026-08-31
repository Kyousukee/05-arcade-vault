// ===== lanes.ts — carriles de tráfico y de río =====
//
// Un carril es una fila con entidades que se desplazan en bucle horizontal. La carretera
// mata al tocarla; el río mata si NO la tocas. Es la misma estructura para las dos zonas
// porque el movimiento es idéntico: lo único que cambia es cómo la resuelve el juego.
//
// El reparto de entidades es determinista —posiciones repartidas a espacio regular, con
// un desfase inicial al azar por carril— en vez de sorteado entidad a entidad. Sortear no
// garantiza que queden huecos: un carril puede salir tapado de punta a punta y volverse
// intraversable. Repartiendo a espacio regular, el hueco es `spacing - width` y se puede
// comprobar de un vistazo en la tabla de abajo.
import {
  COLS,
  LEVEL_SPEED_STEP,
  PX_FRAME_TO_CELLS_S,
  ROW_RIVER_BOT,
  ROW_RIVER_TOP,
  ROW_ROAD_BOT,
  ROW_ROAD_TOP,
  TURTLE_CYCLE_MS,
  TURTLE_VISIBLE_MS,
} from "./constants";
export type EntityType = "car" | "truck" | "log" | "turtle";
export type LaneKind = "road" | "river";
export interface Entity {
  /** Borde izquierdo en celdas. Fraccional: las entidades se mueven en continuo. */
  col: number;
  /** Longitud en celdas. */
  width: number;
  type: EntityType;
  /** Índice dentro del carril; fija el color de la entidad para que no parpadee. */
  variant: number;
  /** ms recorridos del ciclo de inmersión. Solo tortugas. */
  cycleMs: number;
  /** true mientras el grupo está bajo el agua y no sirve de apoyo. Solo tortugas. */
  submerged: boolean;
}
export interface Lane {
  row: number;
  kind: LaneKind;
  /** Celdas por segundo, siempre positivo. El sentido lo pone `dir`. */
  speed: number;
  /** +1 hacia la derecha, -1 hacia la izquierda. */
  dir: 1 | -1;
  entities: Entity[];
}
/** Receta de un carril, antes de escalarla por nivel e instanciar sus entidades. */
interface LaneSpec {
  row: number;
  kind: LaneKind;
  type: EntityType;
  /** Velocidad en px/frame a 60 fps, como la expresa el spec. */
  pxFrame: number;
  dir: 1 | -1;
  /** Longitud de cada entidad en celdas. */
  width: number;
  /** Cuántas entidades reparte el carril a lo largo de las 16 columnas. */
  count: number;
}
/**
 * Carretera, de abajo (fila 12, la primera que pisa la rana) a arriba. El carril más
 * lento es el primero: da margen para leer el patrón antes de subir. Sentidos alternos.
 *
 *   fila  tipo    ancho  n  spacing  hueco   px/f
 *   12    car       1    3   5.33    4.33    1.5
 *   11    truck     3    2   8.00    5.00    2.0
 *   10    car       1    4   4.00    3.00    2.5
 *    9    truck     2    3   5.33    3.33    3.0
 *    8    car       1    3   5.33    4.33    4.0
 */
const ROAD_SPECS: LaneSpec[] = [
  { row: 12, kind: "road", type: "car", pxFrame: 1.5, dir: -1, width: 1, count: 3 },
  { row: 11, kind: "road", type: "truck", pxFrame: 2.0, dir: 1, width: 3, count: 2 },
  { row: 10, kind: "road", type: "car", pxFrame: 2.5, dir: -1, width: 1, count: 4 },
  { row: 9, kind: "road", type: "truck", pxFrame: 3.0, dir: 1, width: 2, count: 3 },
  { row: 8, kind: "road", type: "car", pxFrame: 4.0, dir: -1, width: 1, count: 3 },
];
/**
 * Río, de abajo (fila 6, la primera orilla) a arriba (fila 1, pegada a las bocas). Aquí
 * el hueco es el peligro, no el refugio: cuanto menor, más fácil encadenar saltos.
 *
 *   fila  tipo     ancho  n  spacing  hueco   px/f
 *    6    log        3    3   5.33    2.33    1.0
 *    5    turtle     2    4   4.00    2.00    1.5
 *    4    log        4    2   8.00    4.00    1.2
 *    3    log        2    4   4.00    2.00    2.2
 *    2    turtle     3    3   5.33    2.33    1.8
 *    1    log        3    3   5.33    2.33    2.0
 */
const RIVER_SPECS: LaneSpec[] = [
  { row: 6, kind: "river", type: "log", pxFrame: 1.0, dir: 1, width: 3, count: 3 },
  { row: 5, kind: "river", type: "turtle", pxFrame: 1.5, dir: -1, width: 2, count: 4 },
  { row: 4, kind: "river", type: "log", pxFrame: 1.2, dir: 1, width: 4, count: 2 },
  { row: 3, kind: "river", type: "log", pxFrame: 2.2, dir: -1, width: 2, count: 4 },
  { row: 2, kind: "river", type: "turtle", pxFrame: 1.8, dir: 1, width: 3, count: 3 },
  { row: 1, kind: "river", type: "log", pxFrame: 2.0, dir: -1, width: 3, count: 3 },
];
/** Todas las recetas, en orden de fila descendente. */
const LANE_SPECS: LaneSpec[] = [...ROAD_SPECS, ...RIVER_SPECS];
/**
 * Instancia un carril: reparte `count` entidades a espacio regular sobre las 16 columnas
 * y desplaza el conjunto un tramo al azar, para que dos partidas no arranquen iguales.
 *
 * Las tortugas reparten además su ciclo de inmersión: el desfase es `i / count` del ciclo
 * completo, así nunca se sumergen todos los grupos del carril a la vez —que dejaría la
 * fila mortal durante 1,5 s sin aviso.
 */
function buildLane(spec: LaneSpec, level: number): Lane {
  const spacing = COLS / spec.count;
  const jitter = Math.random() * spacing;
  const entities: Entity[] = [];
  for (let i = 0; i < spec.count; i++) {
    const cycleMs = spec.type === "turtle" ? (i / spec.count) * TURTLE_CYCLE_MS : 0;
    entities.push({
      col: i * spacing + jitter,
      width: spec.width,
      type: spec.type,
      variant: i,
      cycleMs,
      submerged: cycleMs >= TURTLE_VISIBLE_MS,
    });
  }
  return {
    row: spec.row,
    kind: spec.kind,
    // px/frame → celdas/s, y +15 % acumulado por cada nivel ganado.
    speed:
      spec.pxFrame * PX_FRAME_TO_CELLS_S * Math.pow(1 + LEVEL_SPEED_STEP, Math.max(0, level - 1)),
    dir: spec.dir,
    entities,
  };
}
/** Carriles de una ronda. El nivel solo escala la velocidad; el reparto no cambia. */
export function buildLanes(level: number): Lane[] {
  return LANE_SPECS.map((spec) => buildLane(spec, level));
}
/**
 * Avanza las entidades y reintroduce por el lado contrario las que salen. El periodo del
 * bucle es `COLS + width` (la entidad tiene que salir entera antes de reaparecer), y se
 * resta entero en vez de recolocar en el borde: así no se pierde el sobrante del frame y
 * el reparto regular no se va desalineando partida adelante.
 *
 * Las tortugas avanzan también su ciclo de inmersión.
 */
export function advanceLanes(lanes: Lane[], dt: number) {
  const ms = dt * 1000;
  for (const lane of lanes) {
    const period = COLS + (lane.entities[0]?.width ?? 0);
    for (const entity of lane.entities) {
      entity.col += lane.speed * lane.dir * dt;
      if (lane.dir === 1) {
        if (entity.col >= COLS) entity.col -= period;
      } else if (entity.col + entity.width <= 0) {
        entity.col += period;
      }
      if (entity.type !== "turtle") continue;
      entity.cycleMs = (entity.cycleMs + ms) % TURTLE_CYCLE_MS;
      entity.submerged = entity.cycleMs >= TURTLE_VISIBLE_MS;
    }
  }
}
/** El carril de una fila, o `undefined` si esa fila no es de tráfico ni de río. */
export function laneAt(lanes: Lane[], row: number): Lane | undefined {
  return lanes.find((lane) => lane.row === row);
}
/** true si la fila está dentro de la zona de río (donde no pisar es morir). */
export function isRiverRow(row: number): boolean {
  return row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT;
}
/** true si la fila está dentro de la carretera (donde ser tocado es morir). */
export function isRoadRow(row: number): boolean {
  return row >= ROW_ROAD_TOP && row <= ROW_ROAD_BOT;
}
