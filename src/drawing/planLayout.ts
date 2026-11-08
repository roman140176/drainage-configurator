/*
 * Раскладка чертежа плана трассы. На входе расчёт, на выходе список фигур для SVG.
 *
 * Подписи не должны налезать друг на друга и на канал. Шрифт на листе моноширинный,
 * поэтому размер подписи считаем по числу символов и обходимся без замеров в DOM.
 */
import { clamp, fmtInt, num } from '../engine/format'
import { placeOutlets, pointAt, type Run } from '../engine/geometry'
import type { Result } from '../engine/plan'
import type { State } from '../types'

export type Anchor = 'start' | 'middle' | 'end'

export type Prim =
  | { kind: 'path'; d: string; cls: string }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; cls: string }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; cls: string }
  | { kind: 'circle'; cx: number; cy: number; r: number; cls: string }
  | { kind: 'text'; x: number; y: number; s: string; cls: string; anchor: Anchor; rot?: number }

export interface PlanLayout {
  vw: number
  vh: number
  dim: Prim[] // размерные линии, под каналом
  body: Prim[] // тело канала
  mark: Prim[] // секции, выпуски, подписи
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

type TextPrim = Extract<Prim, { kind: 'text' }>

// Кегль по классу подписи, как в styles.css
const FONT: Record<string, number> = {
  'pl-t--dim': 11.5,
  'pl-t--sec': 9.5,
  'pl-t--out': 11,
  'pl-t--h': 10,
  'pl-t--slope': 11,
}
const CHAR_W = 0.6 // ширина символа моноширинного шрифта в долях кегля

function fontOf(cls: string): number {
  const mod = cls.split(' ').find((c) => c in FONT)
  return mod ? FONT[mod] : 11
}

function textBox(t: TextPrim, pad = 2): Box {
  const fs = fontOf(t.cls)
  const w = t.s.length * fs * CHAR_W
  const h = fs * 1.15
  const x0 = t.anchor === 'start' ? t.x : t.anchor === 'end' ? t.x - w : t.x - w / 2
  const y0 = t.y - fs * 0.85
  let box: Box = { x: x0, y: y0, w, h }
  if (t.rot === -90) {
    // поворот на -90 вокруг (x, y): (dx, dy) -> (dy, -dx)
    box = { x: t.x + (y0 - t.y), y: t.y - (x0 + w - t.x), w: h, h: w }
  }
  return { x: box.x - pad, y: box.y - pad, w: box.w + 2 * pad, h: box.h + 2 * pad }
}

function text(x: number, y: number, s: string, cls: string, anchor: Anchor = 'middle', rot?: number): TextPrim {
  return { kind: 'text', x, y, s, cls: 'pl-t ' + cls, anchor, rot }
}

// Подпись, отведённая от точки в сторону (dx, dy), выровненная по краю, который смотрит на точку
function tag(x: number, y: number, dx: number, dy: number, dist: number, s: string, cls: string): TextPrim {
  const l = Math.hypot(dx, dy) || 1
  dx /= l
  dy /= l
  const anchor: Anchor = Math.abs(dx) > 0.35 ? (dx > 0 ? 'start' : 'end') : 'middle'
  const ty = y + dy * dist + (dy > 0.35 ? 8 : dy < -0.35 ? -2 : 4)
  return text(x + dx * dist, ty, s, cls, anchor)
}

function distSeg(px: number, py: number, s: number[]): number {
  const dx = s[2] - s[0]
  const dy = s[3] - s[1]
  const l2 = dx * dx + dy * dy || 1
  const t = clamp(((px - s[0]) * dx + (py - s[1]) * dy) / l2, 0, 1)
  return Math.hypot(px - (s[0] + t * dx), py - (s[1] + t * dy))
}

export function layoutPlan(res: Result, st: State, wide: boolean): PlanLayout {
  const VW = wide ? 760 : 440
  const VH_MAX = wide ? 460 : 400
  const VH_MIN = wide ? 230 : 200
  const M = wide ? 78 : 54
  const geo = res.geo
  const P = res.plan

  const dim: Prim[] = []
  const body: Prim[] = []
  const mark: Prim[] = []

  // Габарит фигуры в метрах
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  geo.runs.forEach((r) =>
    r.pts.forEach((p) => {
      minX = Math.min(minX, p[0])
      maxX = Math.max(maxX, p[0])
      minY = Math.min(minY, p[1])
      maxY = Math.max(maxY, p[1])
    }),
  )
  const bw = Math.max(maxX - minX, 0.001)
  const bh = Math.max(maxY - minY, 0.001)
  let sc = Math.min((VW - 2 * M) / bw, (VH_MAX - 2 * M) / (bh || 1))
  if (bh < 0.01) sc = (VW - 2 * M) / bw
  // Высота листа по фигуре: прямой трассе не нужно пустое поле
  const VH = Math.round(clamp(bh * sc + 2 * M, VH_MIN, VH_MAX))
  const ox = (VW - bw * sc) / 2 - minX * sc
  const oy = (VH - bh * sc) / 2 - minY * sc
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const X = (x: number) => ox + x * sc
  const Y = (y: number) => oy + y * sc

  // Занятые места: рамки подписей и отрезки линий в пикселях листа
  const boxes: Box[] = []
  const segPx: number[][] = []
  const hits = (b: Box) => boxes.some((o) => b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h)
  // s[4] это полуширина линии: канал рисуется полосой, размерная линия тонкая
  const onLines = (b: Box) =>
    segPx.some((s) => {
      const pad = s[4] || 0
      for (let k = 0; k <= 24; k++) {
        const x = s[0] + ((s[2] - s[0]) * k) / 24
        const y = s[1] + ((s[3] - s[1]) * k) / 24
        if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return true
      }
      return false
    })
  const inSheet = (b: Box) => b.x > 2 && b.y > 2 && b.x + b.w < VW - 2 && b.y + b.h < VH - 2
  const keep = (t: TextPrim, pad = 2) => {
    boxes.push(textBox(t, pad))
    return t
  }

  /* Тело канала: две обводки дают двойную линию стенок, пунктир по оси показывает решётку */
  geo.runs.forEach((run) => {
    const d =
      run.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join(' ') +
      (run.closed ? ' Z' : '')
    body.push({ kind: 'path', d, cls: 'pl-ch-out' })
    body.push({ kind: 'path', d, cls: 'pl-ch-in' })
    body.push({ kind: 'path', d, cls: P.ser.kind === 'slot' ? 'pl-ch-slot' : 'pl-ch-grate' })
  })

  /* Размерные линии снаружи фигуры, по каждой стороне */
  geo.runs.forEach((run, ri) => {
    run.segs.forEach((sg) => {
      let nx = -sg.uy
      let ny = sg.ux
      const mx = (sg.a[0] + sg.b[0]) / 2
      const my = (sg.a[1] + sg.b[1]) / 2
      // нормаль от центра фигуры наружу, у прямой трассы вверх
      if ((mx - cx) * nx + (my - cy) * ny < 0 || (bh < 0.01 && ny > 0)) {
        nx = -nx
        ny = -ny
      }
      if (ri === 1 && st.shape === 'T') {
        nx = Math.abs(nx)
        ny = 0
      }
      const off = 34
      const x1 = X(sg.a[0]) + nx * off
      const y1 = Y(sg.a[1]) + ny * off
      const x2 = X(sg.b[0]) + nx * off
      const y2 = Y(sg.b[1]) + ny * off
      dim.push({ kind: 'line', x1: X(sg.a[0]) + nx * 12, y1: Y(sg.a[1]) + ny * 12, x2: x1 + nx * 6, y2: y1 + ny * 6, cls: '' })
      dim.push({ kind: 'line', x1: X(sg.b[0]) + nx * 12, y1: Y(sg.b[1]) + ny * 12, x2: x2 + nx * 6, y2: y2 + ny * 6, cls: '' })
      dim.push({ kind: 'line', x1, y1, x2, y2, cls: '' })
      segPx.push([x1, y1, x2, y2])
      // засечки под 45 градусов, как на строительных чертежах
      ;[
        [x1, y1],
        [x2, y2],
      ].forEach(([px, py]) => dim.push({ kind: 'line', x1: px - 5, y1: py + 5, x2: px + 5, y2: py - 5, cls: 'pl-tick' }))
      const vertical = Math.abs(sg.uy) > 0.5
      const tx = (x1 + x2) / 2 + nx * 11
      const ty = (y1 + y2) / 2 + ny * 11 + 4
      dim.push(keep(text(tx, ty, fmtInt(sg.len * 1000), 'pl-t--dim', 'middle', vertical ? -90 : undefined)))
    })
  })

  /* Секции: засечки поперёк канала и номера */
  P.sections.forEach((sec, i) => {
    const run = geo.runs[sec.run]
    const startsRun = i === 0 || P.sections[i - 1].run !== sec.run
    if (!startsRun) {
      const p = pointAt(run, sec.from)
      const nx = -p.uy
      const ny = p.ux
      mark.push({ kind: 'line', x1: X(p.x) - nx * 11, y1: Y(p.y) - ny * 11, x2: X(p.x) + nx * 11, y2: Y(p.y) + ny * 11, cls: 'pl-joint' })
    }
    if (sec.len * sc > 30) {
      const c = pointAt(run, sec.from + sec.len / 2)
      let lx = -c.uy
      let ly = c.ux
      if ((c.x - cx) * lx + (c.y - cy) * ly > 0 || (bh < 0.01 && ly < 0)) {
        lx = -lx
        ly = -ly
      }
      mark.push(keep(text(X(c.x) + lx * 19, Y(c.y) + ly * 19 + 3.5, String(i + 1), 'pl-t--sec'), 1))
    }
  })

  /* Торцы и тройник */
  const cap = (run: Run, atStart: boolean) => {
    const p = pointAt(run, atStart ? 0 : run.len)
    const nx = -p.uy
    const ny = p.ux
    mark.push({ kind: 'line', x1: X(p.x) - nx * 9, y1: Y(p.y) - ny * 9, x2: X(p.x) + nx * 9, y2: Y(p.y) + ny * 9, cls: 'pl-cap' })
  }
  if (!geo.closed) {
    cap(geo.runs[0], true)
    cap(geo.runs[0], false)
    if (geo.runs[1]) cap(geo.runs[1], false)
  }
  if (geo.junction) {
    mark.push({ kind: 'rect', x: X(geo.junction[0]) - 7, y: Y(geo.junction[1]) - 7, w: 14, h: 14, cls: 'pl-tee' })
  }

  // Отрезки канала тоже препятствия для подписей
  // Полуширина 9: обводка канала 16 px плюс зазор
  geo.runs.forEach((run) => run.segs.forEach((sg) => segPx.push([X(sg.a[0]), Y(sg.a[1]), X(sg.b[0]), Y(sg.b[1]), 9])))

  // Направления от точки, от самого свободного к самому тесному
  const freeDirs = (px: number, py: number): [number, number][] => {
    const list: { d: [number, number]; score: number }[] = []
    for (let k = 0; k < 8; k++) {
      const a = (Math.PI / 4) * k + Math.PI / 8
      const dx = Math.cos(a)
      const dy = Math.sin(a)
      // середина подписи: при выравнивании по краю текст уходит ещё примерно на 45 px
      const mx = px + dx * 18 + (Math.abs(dx) > 0.35 ? (dx > 0 ? 45 : -45) : 0)
      const my = py + dy * 22
      let score = Math.min(...segPx.map((s) => distSeg(mx, my, s)))
      if (mx < 50 || mx > VW - 50 || my < 16 || my > VH - 12) score -= 100
      list.push({ d: [dx, dy], score })
    }
    return list.sort((a, b) => b.score - a.score).map((o) => o.d)
  }

  /* Уклон и выпуски */
  const outs = placeOutlets(geo, P.N)
  let slopeLabelDone = false

  outs.forEach((o, i) => {
    const run = geo.runs[o.run]
    const half = o.share / 2
    const p = pointAt(run, o.d)

    if (P.slope > 0) {
      // стрелки по обе стороны от выпуска, смотрят к нему
      ;[-1, 1].forEach((side) => {
        let at = o.d + side * half * 0.5
        if (!run.closed && (at < 0 || at > run.len)) return
        at = (at + run.len) % run.len || at
        const a = pointAt(run, at)
        const ax = a.ux * -side
        const ay = a.uy * -side
        const x0 = X(a.x)
        const y0 = Y(a.y)
        mark.push({
          kind: 'path',
          d: `M${x0 - ax * 7 - ay * 4} ${y0 - ay * 7 + ax * 4} L${x0 + ax * 3} ${y0 + ay * 3} L${x0 - ax * 7 + ay * 4} ${y0 - ay * 7 - ax * 4}`,
          cls: 'pl-arrow',
        })
      })

      if (!slopeLabelDone) {
        slopeLabelDone = true
        // Подпись уклона внутрь фигуры (снаружи размеры). Перебираем места, пока не встанет свободно.
        const tries = [-0.5, -0.3, -0.7, 0.4, 0.6, -0.15, 0.25, 0.8]
        let label: TextPrim | null = null
        for (const k of tries) {
          const lp = pointAt(run, clamp(o.d + half * k, 0, run.len))
          let nx = -lp.uy
          let ny = lp.ux
          if ((lp.x - cx) * nx + (lp.y - cy) * ny > 0 || (bh < 0.01 && ny < 0)) {
            nx = -nx
            ny = -ny
          }
          label = tag(X(lp.x), Y(lp.y), nx, ny, 22, `i = ${num(P.slope)} %`, 'pl-t--slope')
          if (!hits(textBox(label, 3))) break
        }
        if (label) mark.push(keep(label, 3))
      }
    }

    // выпуск: квадрат трапа или кружок патрубка
    const gx = X(p.x)
    const gy = Y(p.y)
    if (P.trap) {
      mark.push({ kind: 'rect', x: gx - 10, y: gy - 10, w: 20, h: 20, cls: 'pl-outlet' })
      mark.push({ kind: 'circle', cx: gx, cy: gy, r: 5.5, cls: 'pl-outlet-in' })
    } else {
      mark.push({ kind: 'circle', cx: gx, cy: gy, r: 8, cls: 'pl-outlet' })
      mark.push({ kind: 'circle', cx: gx, cy: gy, r: 3, cls: 'pl-outlet-in' })
    }

    // Подпись выпуска: ищем свободное место. Не нашли, берём наименее плохое:
    // налезть на подпись хуже, чем на линию, выйти за лист хуже всего.
    const label = `В${i + 1} · ${P.trap ? `трап DN ${P.trap.dn}` : `DN ${P.pipe?.dn}`}`
    const put = (d: [number, number], dist: number) => {
      const lab = tag(gx, gy, d[0], d[1], dist, label, 'pl-t--out')
      const up = d[1] < -0.35 * Math.hypot(d[0], d[1])
      const hl = text(lab.x, lab.y + (up ? -13 : 13), `H ${P.hOut}`, 'pl-t--h', lab.anchor)
      return { lab, hl, b1: textBox(lab), b2: textBox(hl) }
    }
    const bad = (b: Box) => (hits(b) ? 3 : 0) + (onLines(b) ? 2 : 0) + (inSheet(b) ? 0 : 5)

    const dirs = freeDirs(gx, gy)
    const cands: { d: [number, number]; dist: number }[] = []
    ;[18, 34].forEach((dist) => dirs.forEach((d) => cands.push({ d, dist })))

    let placed: ReturnType<typeof put> | null = null
    let best: { c: (typeof cands)[number]; score: number } | null = null
    for (const c of cands) {
      const t = put(c.d, c.dist)
      const score = bad(t.b1) + bad(t.b2)
      if (score === 0) {
        placed = t
        break
      }
      if (!best || score < best.score) best = { c, score }
    }
    if (!placed && best) placed = put(best.c.d, best.c.dist)
    if (placed) {
      mark.push(placed.lab, placed.hl)
      boxes.push(placed.b1, placed.b2)
    }
  })

  // Высота на водоразделе: за начальным торцом, по продолжению трассы назад
  if (P.slope > 0 && !geo.closed) {
    const s0 = pointAt(geo.runs[0], 0)
    mark.push(tag(X(s0.x), Y(s0.y), -s0.ux, -s0.uy, 14, `H ${P.hStart}`, 'pl-t--h'))
  }

  return { vw: VW, vh: VH, dim, body, mark }
}
