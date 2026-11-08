import { describe, expect, it } from 'vitest'
import db from '../../../mock/db.json'
import { prepareCatalog } from '../catalog'
import { geometry } from '../geometry'
import { flow, grateOk, solve } from '../plan'
import { fromHash, initialState, toHash, update } from '../state'
import type { RawCatalog } from '../../types'
import golden from './golden.json'

const cat = prepareCatalog(db as unknown as RawCatalog)
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d

describe('вода', () => {
  it('дождь с площади: Q = psi * q20 * F', () => {
    const st = update(initialState(cat), { object: 'proezd' }, cat)
    const s = { ...st, water: 'a' as const, area: 300, surface: 'asphalt' }
    expect(flow(s, cat)).toBeCloseTo((0.95 * 80 * 300) / 10000, 6)
  })

  it('точки слива: число точек на расход точки', () => {
    const st = update(initialState(cat), { object: 'ceh', points: 4 }, cat)
    expect(flow(st, cat)).toBeCloseTo(1.2, 6)
  })
})

describe('решётки', () => {
  it('пешеходной зоне подходит любая решётка', () => {
    expect(cat.grates.every((g) => grateOk(cat, 'peshehod', g.key))).toBe(true)
  })

  it('под D400 остаётся только пластинчатая', () => {
    expect(cat.grates.filter((g) => grateOk(cat, 'sklad', g.key)).map((g) => g.key)).toEqual(['plast'])
  })

  it('неподходящая решётка сама меняется на подходящую', () => {
    const st = update(initialState(cat), { object: 'ceh' }, cat)
    expect(update(st, { grate: 'yach' }, cat).grate).toBe('plast')
  })
})

describe('геометрия', () => {
  it('своя трасса: почти прямой излом углом не считается', () => {
    const st = { ...initialState(cat), shape: 'free' as const, vertices: [[0, 0], [5, 0.1], [10, 0], [10, 6]] as [number, number][] }
    expect(geometry(st).corners).toBe(1)
  })

  it('периметр замкнут и без торцов', () => {
    const geo = geometry({ ...initialState(cat), shape: 'frame', lengths: [8, 5, 0] })
    expect(geo.closed).toBe(true)
    expect(geo.ends).toBe(0)
    expect(geo.total).toBe(26)
  })
})

describe('адрес', () => {
  it('состояние переживает поход через адрес', () => {
    const st = update(initialState(cat), { object: 'pishevoe', shape: 'L', lengths: [14, 7, 6], mount: 'full', delivery: 'mo', km: 45 }, cat)
    expect(fromHash('#' + toHash(st), cat)).toEqual(st)
  })

  it('битая ссылка не роняет расчёт', () => {
    expect(fromHash('#o=constructor', cat)).toBeNull()
    expect(fromHash('#o=ceh&l=%E0%A4%A&n=abc', cat)?.object).toBe('ceh')
  })
})

describe('итог совпадает с эталонными расчётами', () => {
  it.each(golden.map((g) => [g.input || '(по умолчанию)', g] as const))('%s', (_, g) => {
    const st = fromHash('#' + g.input, cat) ?? initialState(cat)
    const res = solve(st, cat)
    const P = res.plan
    expect(P.ser.key).toBe(g.series)
    expect(P.N).toBe(g.N)
    expect(P.nMin).toBe(g.nMin)
    expect(P.hOut).toBe(g.hOut)
    expect(P.hStart).toBe(g.hStart)
    expect(round(res.Q, 3)).toBe(g.Q)
    expect(round(P.through, 3)).toBe(g.through)
    expect(P.rows.map((r) => [round(r.qty, 3), round(r.price, 2)])).toEqual(g.rows)
    expect(round(P.total, 2)).toBe(g.total)
    expect(P.warn.length).toBe(g.warn)
    expect(res.alts.map((a) => a.ser.key)).toEqual(g.alts)
  })
})
