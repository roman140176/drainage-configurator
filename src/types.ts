// Данные с мок-сервера (mock/db.json) и состояние конфигуратора

export type Src = 'catalog' | 'price' | 'market' | 'est'

// Цены по группам сечения: w100 ... w300, gs у щелевых
export type PriceByGroup = Record<string, number>

export interface Series {
  key: string
  name: string
  kind: 'grate' | 'slot'
  W: number // габарит канала, мм
  Wh: number // ширина гидравлического сечения, мм
  Hmin: number
  Hmax: number
  t: number // толщина металла, мм
  group: string
  slot?: number // ширина щели у щелевых
  price: number // цена за п.м при глубине 65 мм
  src: Src
  qClient?: Record<string, number> // пропускная способность от завода, если есть
}

export interface Grate {
  key: string
  name: string
  purpose: string
  maxClass: string
  price: PriceByGroup
  src: Src
}

export interface Part {
  key: string
  name: string
  price: PriceByGroup
  src: Src
  off?: boolean
}

export interface Work {
  key: string
  name: string
  price: number
  unit: string
  src: Src
  perVisit?: number
}

export interface ObjectType {
  key: string
  name: string
  minWh: number
  klass: string
  t: number
  grate: string
  steel: Steel
  slope: number
  outlet: Outlet
  body: 'one' | 'two'
  water: Water
  points: { label: string; unit: string; q: number; def: number }
  area: { def: number; surface: string }
  sand: boolean
  slotOk: boolean
  note: string
  floor: string
}

export interface Surface {
  key: string
  name: string
  psi: number
}

export interface LoadClass {
  key: string
  what: string
}

export interface Trap {
  id: number
  title: string
  price: number
  size: number
  dn: number
  q: number // пропускная способность, л/с
  dir: Direction
  body: 'one' | 'two'
}

export interface Floor {
  key: string
  name: string
  what: string
  img: string
  span: number // сколько мм пола помещается по ширине фото
  focus: number // какую полосу фото показывать по высоте
}

export interface PipeStep {
  q: number
  dn: number
  k: number
}

export interface Rules {
  sectionMax: number
  flatRun: number
  maxRunSide: number
  revStep: number
  seat: number
  slotNeck: number
  depthAdd: number
  manningN: number
  priceDepth: number
  trapFit: Record<string, number>
  pipe: PipeStep[]
  pipeH: number
  maxLen: number
  lead: { base: string; big: string; bigFrom: number }
}

export interface Settings {
  rules: Rules
  rain: { q20: number }
  k316: number
  t2: PriceByGroup
  updated: string
}

// Так данные приходят из API
export interface RawCatalog {
  objects: ObjectType[]
  series: Series[]
  grates: Grate[]
  parts: Part[]
  works: Work[]
  surfaces: Surface[]
  classes: LoadClass[]
  traps: Trap[]
  floors: Floor[]
  settings: Settings
}

// А так с ними работает движок: плюс словари по ключу
export interface Catalog extends RawCatalog {
  objectsBy: Record<string, ObjectType>
  seriesBy: Record<string, Series>
  gratesBy: Record<string, Grate>
  surfacesBy: Record<string, Surface>
  partsBy: Record<string, Part>
  worksBy: Record<string, Work>
  floorsBy: Record<string, Floor>
  classOrder: string[]
}

export type Shape = 'line' | 'L' | 'U' | 'T' | 'frame' | 'free'
export type Water = 'a' | 'p' // a: дождь с площади, p: точки слива
export type Steel = '304' | '316'
export type Outlet = 'trap' | 'pipe'
export type Direction = 'v' | 'h'
export type Mount = '0' | 'shef' | 'full'
export type Delivery = '0' | 'msk' | 'mo' | 'reg'
export type Point = [number, number]

export interface State {
  object: string
  shape: Shape
  lengths: number[] // длины сторон, м
  water: Water
  area: number // площадь водосбора, м2
  surface: string
  points: number // точек слива
  channel: 'g' | 's' // g: с решёткой, s: щелевой
  series: string // 'auto' или ключ серии
  grate: string
  steel: Steel
  slope: number // уклон, %
  joint: 'f' | 'w' // f: фланцы, w: сварка
  outlet: Outlet
  direction: Direction
  outlets: number // 0 = подобрать самим
  sand: boolean
  vertices: Point[] // своя трасса, м
  closed: boolean
  mount: Mount
  delivery: Delivery
  km: number
  floor: string // '' = по объекту
}
