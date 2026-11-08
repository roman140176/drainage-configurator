import type { Catalog, Point, State } from '../types'
import { clamp } from './format'
import { SHAPES } from './geometry'
import { grateOk } from './plan'

// Умолчания объекта: то, что подобрал бы инженер
export function applyObject(st: State, key: string, cat: Catalog): State {
  const o = cat.objectsBy[key]
  if (!o) return st
  return {
    ...st,
    object: key,
    grate: o.grate,
    steel: o.steel,
    slope: o.slope,
    outlet: o.outlet,
    water: o.water,
    points: o.points.def,
    area: o.area.def,
    surface: o.area.surface,
    sand: o.sand,
    channel: 'g',
    series: 'auto',
    outlets: 0,
  }
}

export function initialState(cat: Catalog): State {
  const base: State = {
    object: cat.objects[0].key,
    shape: 'line',
    lengths: [12, 6, 6],
    water: 'p',
    area: 200,
    surface: cat.surfaces[0].key,
    points: 2,
    channel: 'g',
    series: 'auto',
    grate: 'yach',
    steel: '304',
    slope: 0.5,
    joint: 'f',
    outlet: 'trap',
    direction: 'v',
    outlets: 0,
    sand: true,
    vertices: [],
    closed: false,
    mount: '0',
    delivery: '0',
    km: 30,
    floor: '',
  }
  return applyObject(base, base.object, cat)
}

// Приводим состояние в порядок: то, что не сочетается, сбрасываем на допустимое
export function normalize(st: State, cat: Catalog): State {
  const s = { ...st }
  const o = cat.objectsBy[s.object]

  if (s.mount !== '0' && !cat.worksBy[s.mount]) s.mount = '0'
  if ((s.delivery === 'msk' || s.delivery === 'mo') && !cat.worksBy.msk) s.delivery = '0'

  if (s.channel === 's' && !o.slotOk) {
    s.channel = 'g'
    s.series = 'auto'
  }

  // Серия чужого вида, например щелевая при канале с решёткой
  const ser = cat.seriesBy[s.series]
  if (s.series !== 'auto' && (!ser || ser.kind !== (s.channel === 's' ? 'slot' : 'grate'))) {
    s.series = 'auto'
  }

  // Решётка не держит нагрузку объекта: берём первую подходящую
  if (s.channel === 'g' && !grateOk(cat, s.object, s.grate)) {
    const ok = cat.grates.find((g) => grateOk(cat, s.object, g.key))
    if (ok) s.grate = ok.key
  }

  return s
}

// Изменение поля из формы. Тут же правила, которые тянут за собой другие поля.
export function update(st: State, patch: Partial<State>, cat: Catalog): State {
  // Сначала умолчания нового объекта, поверх них остальное из patch
  const { object, ...rest } = patch
  let s: State = object !== undefined ? applyObject(st, object, cat) : st
  s = { ...s, ...rest }

  if (patch.shape !== undefined || patch.slope !== undefined || patch.lengths !== undefined) s.outlets = 0
  if (patch.series !== undefined) s.outlets = 0
  if (patch.channel !== undefined) {
    s.series = 'auto'
    s.outlets = 0
    // Щелевому почти нечем дать уклон: запас по высоте у S60 всего 35 мм
    s.slope = patch.channel === 's' ? 0 : cat.objectsBy[s.object].slope
  }

  return normalize(s, cat)
}

/* Состояние в адресе: #o=ceh&f=L&l=12,6 ... Ссылку можно переслать, откроется тот же расчёт. */

function verticesToStr(pts: Point[]): string {
  return pts.map((p) => `${Math.round(p[0] * 100) / 100},${Math.round(p[1] * 100) / 100}`).join(';')
}

function verticesFromStr(s: string): Point[] {
  const out: Point[] = []
  String(s || '')
    .split(';')
    .forEach((pair) => {
      const xy = pair.split(',')
      const x = parseFloat(xy[0])
      const y = parseFloat(xy[1])
      if (xy.length === 2 && isFinite(x) && isFinite(y) && Math.abs(x) < 5000 && Math.abs(y) < 5000) {
        out.push([x, y])
      }
    })
  return out.length >= 2 && out.length <= 60 ? out : []
}

export function toHash(st: State): string {
  const free = st.shape === 'free'
  const pairs: [string, string | number][] = [
    ['o', st.object],
    ['f', st.shape],
    ['l', st.lengths.slice(0, SHAPES[st.shape].n).join(',')],
    ['w', st.water],
    ['A', st.area],
    ['sf', st.surface],
    ['P', st.points],
    ['k', st.channel],
    ['s', st.series],
    ['g', st.grate],
    ['m', st.steel],
    ['i', st.slope],
    ['j', st.joint],
    ['x', st.outlet],
    ['d', st.direction],
    ['n', st.outlets],
    ['p', st.sand ? 1 : 0],
    ['v', free ? verticesToStr(st.vertices) : ''],
    ['vc', free && st.closed ? 1 : 0],
    ['mt', st.mount],
    ['dl', st.delivery],
    ['km', st.km],
    ['fl', st.floor],
  ]
  return pairs.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
}

// Каждое значение проверяем: ссылка могла прийти обрезанной или поправленной руками
export function fromHash(hash: string, cat: Catalog): State | null {
  const h = hash.replace(/^#/, '')
  if (!h || h.indexOf('o=') < 0) return null

  const p: Record<string, string> = Object.create(null)
  h.split('&').forEach((pair) => {
    const i = pair.indexOf('=')
    if (i <= 0) return
    try {
      p[pair.slice(0, i)] = decodeURIComponent(pair.slice(i + 1))
    } catch {
      // битый %-код пропускаем, остальное читаем
    }
  })

  if (!cat.objectsBy[p.o]) return null

  const max = cat.settings.rules.maxLen
  const s = applyObject(initialState(cat), p.o, cat)
  const lengths = s.lengths.slice()

  if (p.f && p.f in SHAPES) s.shape = p.f as State['shape']
  if (p.l) {
    p.l.split(',').forEach((v, i) => {
      const n = parseFloat(v)
      if (i < 3 && n > 0) lengths[i] = clamp(n, 0.5, max)
    })
  }
  s.lengths = lengths
  if (p.w === 'a' || p.w === 'p') s.water = p.w
  if (+p.A > 0) s.area = clamp(+p.A, 1, 100000)
  if (cat.surfacesBy[p.sf]) s.surface = p.sf
  if (+p.P > 0) s.points = clamp(Math.round(+p.P), 1, 200)
  if (p.k === 'g' || p.k === 's') s.channel = p.k
  if (p.s === 'auto' || cat.seriesBy[p.s]) s.series = p.s
  if (cat.gratesBy[p.g]) s.grate = p.g
  if (p.m === '304' || p.m === '316') s.steel = p.m
  if (['0', '0.5', '1'].includes(p.i)) s.slope = +p.i
  if (p.j === 'f' || p.j === 'w') s.joint = p.j
  if (p.x === 'trap' || p.x === 'pipe') s.outlet = p.x
  if (p.d === 'v' || p.d === 'h') s.direction = p.d
  if (+p.n >= 0) s.outlets = clamp(Math.round(+p.n || 0), 0, 99)
  if (p.p === '0' || p.p === '1') s.sand = p.p === '1'
  if (s.shape === 'free') {
    s.vertices = verticesFromStr(p.v)
    s.closed = p.vc === '1' && s.vertices.length >= 3
    // Своя трасса без точек: откатываемся на прямую
    if (s.vertices.length < 2) {
      s.shape = 'line'
      s.vertices = []
      s.closed = false
    }
  }
  if (['0', 'shef', 'full'].includes(p.mt)) s.mount = p.mt as State['mount']
  if (['0', 'msk', 'mo', 'reg'].includes(p.dl)) s.delivery = p.dl as State['delivery']
  if (+p.km > 0) s.km = clamp(Math.round(+p.km), 1, 500)
  if (/^[a-z]{0,12}$/.test(p.fl || '')) s.floor = p.fl || ''

  return normalize(s, cat)
}
