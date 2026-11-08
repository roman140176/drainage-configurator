import type { Catalog, State } from '../types'
import { num, plural } from './format'
import { SHAPES } from './geometry'
import type { Result } from './plan'

export function freeSides(st: State): number {
  return Math.max(1, st.vertices.length - (st.closed ? 0 : 1))
}

export function shapeName(st: State): string {
  if (st.shape === 'free') {
    const n = freeSides(st)
    return `${st.closed ? 'замкнутая' : 'своя'}, ${n} ${plural(n, 'сторона', 'стороны', 'сторон')}`
  }
  return SHAPES[st.shape].name.toLowerCase()
}

export function worksLabel(st: State): string {
  const mount = { shef: 'шеф-монтаж', full: 'монтаж под ключ' }[st.mount as 'shef' | 'full'] ?? ''
  const delivery =
    { msk: 'доставка по Москве', mo: `доставка ${st.km} км за МКАД`, reg: 'доставка до терминала ТК' }[
      st.delivery as 'msk' | 'mo' | 'reg'
    ] ?? ''
  return [mount, delivery].filter(Boolean).join(', ')
}

export function leadTime(res: Result, cat: Catalog): string {
  const lead = cat.settings.rules.lead
  return res.geo.total >= lead.bigFrom ? lead.big : lead.base
}

// Строки штампа на листе. Те же строки уходят менеджеру в заявке.
export function stampRows(st: State, res: Result, cat: Catalog): [string, string][] {
  const P = res.plan
  const o = cat.objectsBy[st.object]
  const gr = cat.gratesBy[st.grate]

  const rows: [string, string][] = [
    ['Объект', o.name],
    ['Трасса', `${num(res.geo.total)} м, ${shapeName(st)}`],
    ['Канал', `${P.ser.name}${P.ser.kind === 'slot' ? ' щелевой' : ''}, Wh ${P.ser.Wh} мм, металл ${num(P.t)} мм`],
    ['Решётка', P.ser.kind === 'slot' ? 'нет, щель' : `${gr.name}, ${gr.maxClass}`],
    ['Нагрузка объекта', o.klass],
    ['Сталь', `AISI ${st.steel}`],
    ['Уклон', P.slope > 0 ? `${num(P.slope)} %, H ${P.hStart}→${P.hOut} мм` : `без уклона, H ${P.hOut} мм`],
    ['Выпуски', `${P.N} × ${P.trap ? `трап DN ${P.trap.dn}, ${num(P.trap.q, 1)} л/с` : `выпуск в дне DN ${P.pipe?.dn}`}`],
    ['Расход', `${num(res.Q, 2)} л/с, система пропустит ${num(P.through, 2)} л/с`],
  ]

  const work = worksLabel(st)
  if (work) rows.push(['Монтаж и доставка', work])
  return rows
}
