import type { Point, State } from '../types'
import { clamp } from './format'

export interface Seg {
  a: Point
  b: Point
  len: number
  from: number // расстояние от начала прогона
  ux: number
  uy: number
}

// Прогон: непрерывная ломаная канала
export interface Run {
  pts: Point[]
  segs: Seg[]
  len: number
  closed: boolean
}

export interface Geo {
  runs: Run[]
  ends: number // торцы
  corners: number
  tees: number
  closed: boolean
  junction: Point | null // где тройник
  total: number
  free: boolean
}

export interface Outlet {
  run: number
  d: number // позиция на прогоне, м
  share: number // какую длину обслуживает
}

export const SHAPES: Record<State['shape'], { n: number; labels: string[]; name: string }> = {
  line: { n: 1, labels: ['Длина трассы'], name: 'Прямая' },
  L: { n: 2, labels: ['Сторона А', 'Сторона Б'], name: 'Г-образная' },
  U: { n: 3, labels: ['Основание', 'Левая сторона', 'Правая сторона'], name: 'П-образная' },
  T: { n: 2, labels: ['Основная линия', 'Отвод'], name: 'Т-образная' },
  frame: { n: 2, labels: ['Длина', 'Ширина'], name: 'По периметру' },
  free: { n: 0, labels: [], name: 'Своя' },
}

export function makeRun(pts: Point[], closed = false): Run {
  const segs: Seg[] = []
  let total = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (len <= 0) continue
    segs.push({ a, b, len, from: total, ux: (b[0] - a[0]) / len, uy: (b[1] - a[1]) / len })
    total += len
  }
  return { pts, segs, len: total, closed }
}

// Точка и направление на расстоянии d от начала прогона
export function pointAt(run: Run, d: number) {
  d = clamp(d, 0, run.len)
  for (let i = 0; i < run.segs.length; i++) {
    const s = run.segs[i]
    if (d <= s.from + s.len + 1e-9 || i === run.segs.length - 1) {
      const t = d - s.from
      return { x: s.a[0] + s.ux * t, y: s.a[1] + s.uy * t, ux: s.ux, uy: s.uy }
    }
  }
  return { x: 0, y: 0, ux: 1, uy: 0 }
}

export function geometry(st: State): Geo {
  const [a, b, c] = st.lengths
  const g: Geo = { runs: [], ends: 0, corners: 0, tees: 0, closed: false, junction: null, total: 0, free: false }

  switch (st.shape) {
    case 'L':
      g.runs = [makeRun([[0, 0], [a, 0], [a, b]])]
      g.ends = 2
      g.corners = 1
      break
    case 'U':
      g.runs = [makeRun([[0, 0], [0, b], [a, b], [a, b - c]])]
      g.ends = 2
      g.corners = 2
      break
    case 'T':
      g.runs = [makeRun([[0, 0], [a, 0]]), makeRun([[a / 2, 0], [a / 2, b]])]
      g.ends = 3
      g.tees = 1
      g.junction = [a / 2, 0]
      break
    case 'frame':
      g.runs = [makeRun([[0, 0], [a, 0], [a, b], [0, b], [0, 0]], true)]
      g.corners = 4
      g.closed = true
      break
    case 'free': {
      // Угол считаем там, где трасса поворачивает больше чем на 5 градусов.
      // Небольшой излом от неточного клика угловой элемент не требует.
      const pts = st.vertices.slice()
      const closed = st.closed && pts.length >= 3
      if (closed) pts.push(pts[0])
      g.runs = [makeRun(pts, closed)]
      const segs = g.runs[0].segs
      let turns = 0
      for (let i = 0; i < segs.length; i++) {
        const next = segs[i + 1] || (closed ? segs[0] : null)
        if (!next) break
        const cos = segs[i].ux * next.ux + segs[i].uy * next.uy
        if (cos < Math.cos((5 * Math.PI) / 180)) turns += 1
      }
      g.corners = turns
      g.closed = closed
      g.ends = closed ? 0 : 2
      g.free = true
      break
    }
    default:
      g.runs = [makeRun([[0, 0], [a, 0]])]
      g.ends = 2
  }

  g.total = g.runs.reduce((s, r) => s + r.len, 0)
  return g
}

// Раскладываем N выпусков по прогонам пропорционально длине, на каждом прогоне хотя бы один
export function placeOutlets(geo: Geo, N: number): Outlet[] {
  let counts: number[]
  if (geo.runs.length === 1) {
    counts = [N]
  } else {
    const main = geo.runs[0].len
    const branch = geo.runs[1].len
    const nb = N > 1 ? clamp(Math.round((N * branch) / (main + branch)), 1, N - 1) : 0
    counts = [N - nb, nb]
  }

  const out: Outlet[] = []
  geo.runs.forEach((run, ri) => {
    const n = counts[ri] || 0
    // Выпуск ставим в центр своего участка, водоразделы получаются посередине между выпусками
    for (let i = 0; i < n; i++) {
      out.push({ run: ri, d: (run.len * (i + 0.5)) / n, share: run.len / n })
    }
  })
  return out
}
