/*
 * Подбор системы и смета.
 *
 * Порядок расчёта:
 * 1. Геометрия: форма трассы и длины -> прогоны, торцы, углы, тройники.
 * 2. Расход воды Q, л/с: с площади (Q = psi * q20 * F) или по точкам слива.
 * 3. Для каждой подходящей серии канала считаем, сколько нужно выпусков:
 *    по длине (с уклоном канал углубляется и упирается в Hmax), по расходу на трап
 *    и по пропускной способности самого канала. Потом подбираем трапы и считаем деньги.
 * 4. Авто-выбор: самая дешёвая серия, остальные идут в сравнение.
 */
import type { Catalog, PipeStep, Series, Src, State, Trap } from '../types'
import { classRank } from './catalog'
import { num, plural } from './format'
import { geometry, type Geo } from './geometry'

export interface Row {
  name: string
  qty: number
  unit: string
  price: number
  sum: number
  src: Src
  work?: boolean // работы и доставка идут отдельным блоком
  note?: string
}

export interface Section {
  run: number
  from: number
  len: number
}

export interface Plan {
  ser: Series
  N: number // выпусков
  nMin: number // минимум, который подобрали бы сами
  Q: number
  qOut: number // расход на один выпуск
  cap: number // пропускная способность канала на одну сторону от выпуска
  hOut: number // высота канала у выпуска, мм
  hStart: number // высота на водоразделе, мм
  trap: Trap | null
  pipe: PipeStep | null
  sections: Section[]
  joints: number
  rows: Row[]
  total: number
  works: number
  visits: number
  warn: string[]
  slope: number
  t: number
  through: number // сколько пропустит система целиком
}

export interface Result {
  geo: Geo
  Q: number
  plan: Plan
  alts: Plan[]
}

export function flow(st: State, cat: Catalog): number {
  if (st.water === 'a') {
    const psi = cat.surfacesBy[st.surface]?.psi ?? 0.9
    return (psi * cat.settings.rain.q20 * st.area) / 10000
  }
  return st.points * (cat.objectsBy[st.object].points?.q ?? 0.3)
}

/*
 * Пропускная способность канала у выпуска на одну сторону, л/с.
 * С уклоном считаем по Маннингу для прямоугольного сечения.
 * Без уклона: свободный излив в выпуск с поправкой на трение по длине r.
 * Из высоты вычитаем посадку решётки, там воды не бывает.
 */
export function capacity(cat: Catalog, ser: Series, slope: number, hOut: number, r: number): number {
  const rules = cat.settings.rules
  const fromFactory = ser.qClient?.[String(slope)]
  if (fromFactory && fromFactory > 0) return fromFactory

  const b = ser.Wh / 1000
  const h = Math.max(0.01, (hOut - (ser.kind === 'slot' ? rules.slotNeck : rules.seat)) / 1000)

  if (slope > 0) {
    const A = b * h
    const R = A / (b + 2 * h)
    return 1000 * (1 / rules.manningN) * A * Math.pow(R, 2 / 3) * Math.sqrt(slope / 100)
  }

  const q0 = 1000 * b * Math.sqrt(9.81) * Math.pow(h / Math.sqrt(3), 1.5)
  const kL = 0.0042 + 0.0009 / b
  return q0 / (1 + kL * r)
}

// Серии, которые подходят объекту по виду канала и минимальному сечению
function candidates(st: State, cat: Catalog): Series[] {
  const o = cat.objectsBy[st.object]
  return cat.series.filter((ser) => {
    if (st.channel === 's') return ser.kind === 'slot'
    return ser.kind === 'grate' && ser.Wh >= o.minWh
  })
}

function strongestGrate(cat: Catalog) {
  return cat.grates.slice().sort((a, b) => classRank(cat, b.maxClass) - classRank(cat, a.maxClass))[0]
}

// Держит ли решётка нагрузку объекта. Если не держит ни одна (E600), разрешаем самую жёсткую.
export function grateOk(cat: Catalog, objectKey: string, grateKey: string): boolean {
  const o = cat.objectsBy[objectKey]
  const gr = cat.gratesBy[grateKey]
  if (!gr) return false
  if (classRank(cat, gr.maxClass) >= classRank(cat, o.klass)) return true
  const strong = strongestGrate(cat)
  return strong.key === grateKey && classRank(cat, strong.maxClass) < classRank(cat, o.klass)
}

// Трап встаёт внутрь канала, поэтому канал должен быть не уже, чем требует трап
function trapsFor(st: State, cat: Catalog, ser: Series): Trap[] {
  const fit = cat.settings.rules.trapFit
  return cat.traps.filter((t) => {
    const minW = fit[String(t.size)] || t.size + 40
    return t.dir === st.direction && minW <= ser.W
  })
}

function pickTrap(st: State, cat: Catalog, ser: Series, qOut: number): Trap | null {
  const list = trapsFor(st, cat, ser)
  if (!list.length) return null

  const fit = list.filter((t) => t.q >= qOut)
  let pool = fit.length ? fit : list.slice().sort((a, b) => b.q - a.q).slice(0, 1)

  // Корпус берём тот, что советует объект (двухкорпусный для пола с гидроизоляцией)
  const body = cat.objectsBy[st.object].body
  const same = pool.filter((t) => t.body === body)
  pool = same.length ? same : pool

  return pool.slice().sort((a, b) => a.price - b.price)[0]
}

// Выпуск в дне: диаметр по расходу
function pipeFor(cat: Catalog, qOut: number): PipeStep {
  const steps = cat.settings.rules.pipe
  return steps.find((s) => qOut <= s.q) ?? steps[steps.length - 1]
}

function partPrice(cat: Catalog, key: string, group: string): number {
  const p = cat.partsBy[key]
  if (!p || p.off) return 0
  if (p.price[group] != null) return p.price[group]
  return p.price.w200 ?? 0
}

/*
 * Глубина и пропускная способность при N выпусках.
 * Цель: у выпуска высота канала не меньше Hmin + depthAdd.
 * С уклоном канал от водораздела идёт вниз: hStart = hOut - i * r.
 */
function hydro(cat: Catalog, ser: Series, slope: number, L: number, N: number) {
  const r = L / (2 * N)
  const hd = Math.min(ser.Hmax, ser.Hmin + cat.settings.rules.depthAdd)
  let hOut = hd
  let hStart = hd
  if (slope > 0) {
    hOut = Math.max(hd, ser.Hmin + (slope / 100) * r * 1000)
    hStart = hOut - (slope / 100) * r * 1000
  }
  return { r, hOut, hStart, cap: capacity(cat, ser, slope, Math.min(hOut, ser.Hmax), r) }
}

export function planFor(st: State, cat: Catalog, ser: Series, geo: Geo, Q: number): Plan {
  const rules = cat.settings.rules
  const o = cat.objectsBy[st.object]
  const slope = st.slope
  const L = geo.total

  // Сколько трассы обслуживает один выпуск в каждую сторону
  const lside =
    slope > 0
      ? Math.min((ser.Hmax - ser.Hmin) / 1000 / (slope / 100), rules.maxRunSide)
      : Math.min(rules.flatRun, rules.maxRunSide)
  const nLen = Math.max(1, Math.ceil(L / (2 * lside) - 1e-9))

  // В помещении узкое место обычно трап: DN 110 с гидрозатвором пропускает около 1 л/с
  const traps = st.outlet === 'trap' ? trapsFor(st, cat, ser) : []
  const qOutMax = traps.length ? Math.max(...traps.map((t) => t.q)) : rules.pipe[rules.pipe.length - 1].q
  const nOut = Math.max(1, Math.ceil(Q / qOutMax - 1e-9))

  // Каждая сторона от выпуска несёт Q / 2N. С ростом N стало только лучше, так что цикл сходится.
  let nMin = Math.max(nLen, nOut)
  let h = hydro(cat, ser, slope, L, nMin)
  let guard = 0
  while (Q / (2 * nMin) > h.cap && guard < 98) {
    nMin += 1
    guard += 1
    h = hydro(cat, ser, slope, L, nMin)
  }

  const N = st.outlets > 0 ? st.outlets : nMin
  const warn: string[] = []
  h = hydro(cat, ser, slope, L, N)

  if (st.outlets > 0 && st.outlets < nMin) {
    if (nLen > st.outlets) {
      warn.push(
        `При уклоне ${num(slope)} % канал ${ser.name} от водораздела до выпуска углубится сильнее своей максимальной высоты ${ser.Hmax} мм. Нужно не меньше ${nMin} ${plural(nMin, 'выпуска', 'выпусков', 'выпусков')}.`,
      )
    } else {
      warn.push(
        `Расход ${num(Q, 2)} л/с больше, чем пропустят ${N} ${plural(N, 'выпуск', 'выпуска', 'выпусков')}. Нужно не меньше ${nMin}.`,
      )
    }
  }
  if (guard >= 98) {
    warn.push(`Канал ${ser.name} не справляется с таким расходом, возьмите сечение шире.`)
  }

  const hOut = Math.round(Math.min(h.hOut, ser.Hmax))
  const hStart = Math.round(Math.max(ser.Hmin, h.hStart))
  const qOut = Q / N
  const trap = st.outlet === 'trap' ? pickTrap(st, cat, ser, qOut) : null
  const pipe = trap ? null : pipeFor(cat, qOut)

  if (trap && trap.q < qOut) {
    warn.push(
      `Самый мощный трап, который встаёт в ${ser.name}, пропускает ${num(trap.q, 1)} л/с, а на выпуск приходится ${num(qOut, 2)} л/с. Добавьте выпусков.`,
    )
  }
  if (st.outlet === 'trap' && !trap) {
    warn.push(
      `В канал ${ser.name} (габарит ${ser.W} мм) трап с ${st.direction === 'v' ? 'вертикальным' : 'горизонтальным'} выпуском встаёт только с расширителем. Посчитали выпуск в дне секции.`,
    )
  }
  if (ser.kind === 'grate' && ser.Wh < o.minWh) {
    warn.push(`Для объекта "${o.name}" рекомендуем сечение от Wh ${o.minWh} мм, а у ${ser.name} всего ${ser.Wh} мм.`)
  }

  const gr = cat.gratesBy[st.grate]
  if (ser.kind === 'grate' && gr && classRank(cat, gr.maxClass) < classRank(cat, o.klass)) {
    warn.push(
      `Нагрузка объекта ${o.klass}, а решётка рассчитана на ${gr.maxClass}. Нужна усиленная решётка под заказ, класс и цену подтвердит завод.`,
    )
  }

  // Секции: каждую прямую сторону делим на равные части не длиннее sectionMax
  const sections: Section[] = []
  geo.runs.forEach((run, ri) => {
    run.segs.forEach((sg) => {
      const n = Math.max(1, Math.ceil(sg.len / rules.sectionMax - 1e-9))
      for (let i = 0; i < n; i++) {
        sections.push({ run: ri, from: sg.from + (sg.len * i) / n, len: sg.len / n })
      }
    })
  })

  let joints =
    Math.max(0, sections.length - geo.runs.length) + 2 * geo.corners + 3 * geo.tees + (trap ? N : 0)
  if (geo.closed) joints += 1

  /* Деньги */
  const group = ser.group
  const k316 = st.steel === '316' ? 1 + cat.settings.k316 : 1
  const t = Math.max(ser.t, o.t)
  const rows: Row[] = []
  const row = (name: string, qty: number, unit: string, price: number, src: Src, extra: Partial<Row> = {}) => {
    rows.push({ name, qty, unit, price, sum: qty * price, src, ...extra })
  }

  // Цена канала дана для глубины 65 мм. Глубже дороже пропорционально развёртке листа.
  const hAvg = (hStart + hOut) / 2
  const kDepth = Math.max(1, (ser.W + 2 * hAvg + 40) / (ser.W + 2 * rules.priceDepth + 40))
  const ppm = ser.price * kDepth + (t > ser.t ? cat.settings.t2[group] || 0 : 0)
  const chName =
    `Канал ${ser.name}${ser.kind === 'slot' ? ' щелевой' : ''}, металл ${num(t)} мм, AISI ${st.steel}` +
    (slope > 0 ? `, уклон ${num(slope)} % (H ${hStart}→${hOut} мм)` : `, без уклона, H ${hOut} мм`) +
    `, ${sections.length} секц.`
  row(chName, L, 'п.м', ppm * k316, ser.src)

  if (ser.kind === 'grate' && gr) {
    row(`Решётка ${gr.name.toLowerCase()}, класс ${gr.maxClass}, AISI ${st.steel}`, L, 'п.м', gr.price[group] * k316, gr.src)
  }

  if (trap) {
    row(`${trap.title}, решётка ${gr ? gr.name.toLowerCase() : ''}`, N, 'шт', trap.price, 'catalog')
  } else if (pipe) {
    const pipePart = cat.partsBy.pipe
    const price = partPrice(cat, 'pipe', group) * pipe.k + (st.direction === 'h' ? rules.pipeH : 0)
    row(`${pipePart.name}, ${st.direction === 'v' ? 'вертикальный' : 'горизонтальный'} DN ${pipe.dn}`, N, 'шт', price, pipePart.src)
  }

  const P = cat.partsBy
  if (geo.corners) {
    // У своей трассы углы любые, завод режет по чертежу. Цена как у 90 градусов.
    row(geo.free ? 'Угловой элемент, угол по чертежу' : P.corner.name, geo.corners, 'шт', partPrice(cat, 'corner', group), P.corner.src)
  }
  if (geo.tees) row(P.tee.name, geo.tees, 'шт', partPrice(cat, 'tee', group), P.tee.src)
  if (geo.ends) row(P.cap.name, geo.ends, 'шт', partPrice(cat, 'cap', group), P.cap.src)
  if (joints) {
    const jk = st.joint === 'f' ? 'flange' : 'weld'
    row(P[jk].name, joints, 'стык', partPrice(cat, jk, group), P[jk].src)
  }
  if (st.sand) row(P.sand.name, N, 'шт', partPrice(cat, 'sand', group), P.sand.src)
  if (ser.kind === 'slot') {
    const nRev = Math.max(1, Math.ceil(L / rules.revStep - 1e-9))
    row(P.rev.name, nRev, 'шт', partPrice(cat, 'rev', 'gs'), P.rev.src)
  }

  /* Работы и доставка */
  const W = cat.worksBy
  const work = { work: true }
  let visits = 0

  if (st.mount === 'full' && W.full) {
    row(W.full.name, L, 'п.м', W.full.price, W.full.src, work)
    if (W.out) row(W.out.name, N, 'шт', W.out.price, W.out.src, work)
  } else if (st.mount === 'shef' && W.shef) {
    visits = Math.max(1, Math.ceil(L / (W.shef.perVisit || 40) - 1e-9))
    row(W.shef.name, visits, 'выезд', W.shef.price, W.shef.src, work)
  }

  if (st.delivery === 'msk' && W.msk) {
    row(W.msk.name, 1, 'рейс', W.msk.price, W.msk.src, work)
  } else if (st.delivery === 'mo' && W.msk) {
    const perKm = W.perKm ? W.perKm.price : 0
    row(`Доставка за МКАД, ${st.km} км от МКАД`, 1, 'рейс', W.msk.price + perKm * st.km, W.msk.src, work)
  } else if (st.delivery === 'reg') {
    row('Доставка до терминала транспортной компании в вашем городе', 1, 'рейс', 0, 'est', {
      work: true,
      note: 'по тарифу ТК, назовёт менеджер',
    })
  }

  const total = rows.reduce((s, r) => s + r.sum, 0)
  const works = rows.reduce((s, r) => s + (r.work ? r.sum : 0), 0)

  return {
    ser,
    N,
    nMin,
    Q,
    qOut,
    cap: h.cap,
    hOut,
    hStart,
    trap,
    pipe,
    sections,
    joints,
    rows,
    total,
    works,
    visits,
    warn,
    slope,
    t,
    // Пропуск системы: меньшее из двух, каналы (две стороны на выпуск) и сами выпуски
    through: Math.min(2 * h.cap * N, (trap ? trap.q : (pipe?.q ?? 0)) * N),
  }
}

export function solve(st: State, cat: Catalog): Result {
  const geo = geometry(st)
  const Q = flow(st, cat)
  const plans = candidates(st, cat).map((ser) => planFor(st, cat, ser, geo, Q))
  const alts = plans.slice().sort((a, b) => a.total - b.total)
  const manual = st.series !== 'auto' ? cat.seriesBy[st.series] : undefined
  const plan = manual ? planFor(st, cat, manual, geo, Q) : alts[0] ?? planFor(st, cat, cat.series[0], geo, Q)
  return { geo, Q, plan, alts }
}
