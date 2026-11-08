/*
 * Пол вокруг канала: вид сверху в масштабе. Пол это фото, канал и решётка рисуются поверх,
 * поэтому ширина канала и рисунок решётки меняются честно, без отдельного фото на каждый вариант.
 */
import type { ReactNode } from 'react'
import type { Plan } from '../engine/plan'
import type { Catalog, State } from '../types'
import { useCfg } from './context'

const VW = 720
const VH = 250

export function floorKey(st: State, cat: Catalog): string {
  if (st.floor && cat.floorsBy[st.floor]) return st.floor
  // На улице берём пол из покрытия площадки в шаге 03
  if (st.water === 'a' && st.surface === 'plitka') return 'paver'
  if (st.water === 'a' && st.surface === 'asphalt' && /^(proezd|azs|sklad)$/.test(st.object)) return 'asphalt'
  return cat.objectsBy[st.object].floor || 'tile'
}

function Channel({ plan, grate, k }: { plan: Plan; grate: string; k: number }) {
  const mm = (v: number) => v * k
  const ser = plan.ser
  const cy = VH / 2
  const parts: ReactNode[] = []

  if (ser.kind === 'slot') {
    const slot = ser.slot || 20
    const W = slot + 6
    return (
      <g>
        <rect x={0} y={cy - mm(W) / 2} width={VW} height={mm(W)} fill="url(#fl-steel)" filter="url(#fl-shadow)" />
        <rect x={0} y={cy - mm(slot) / 2} width={VW} height={mm(slot)} fill="#151a1f" />
      </g>
    )
  }

  const W = ser.W
  const y0 = cy - mm(W) / 2
  const lip = Math.max(6, Math.min(14, (ser.W - ser.Wh) / 2))
  const gy = y0 + mm(lip)
  const gh = mm(W - 2 * lip)
  const hole = '#1b2128'

  if (grate === 'yach') {
    // сетка 33 x 33
    const cell = mm(33)
    const bar = mm(4)
    for (let x = 0, i = 0; x < VW; x += cell) {
      for (let y = gy + bar / 2; y + cell - bar <= gy + gh + 0.01; y += cell, i++) {
        parts.push(<rect key={`y${i}`} x={x + bar / 2} y={y} width={cell - bar} height={cell - bar} fill={hole} />)
      }
    }
  } else if (grate === 'perf') {
    // продолговатые прорези 25 x 5, ряды вразбежку
    let row = 0
    for (let y = gy + mm(8); y + mm(5) <= gy + gh - mm(6); y += mm(12), row++) {
      for (let x = (row % 2 ? mm(17) : 0) + mm(4); x < VW; x += mm(34)) {
        parts.push(<rect key={`p${row}-${x}`} x={x} y={y} width={mm(25)} height={mm(5)} rx={mm(2.5)} fill={hole} />)
      }
    }
  } else if (grate === 'shhel') {
    // поперечные щели 8 мм с шагом 16 мм
    for (let x = mm(4); x < VW; x += mm(16)) {
      parts.push(<rect key={`s${x}`} x={x} y={gy + mm(5)} width={mm(8)} height={gh - mm(10)} rx={mm(1.5)} fill={hole} />)
    }
  } else {
    // пластинчатая: сплошная плита, щели вдоль кромок
    parts.push(<rect key="e1" x={0} y={gy} width={VW} height={mm(6)} fill={hole} />)
    parts.push(<rect key="e2" x={0} y={gy + gh - mm(6)} width={VW} height={mm(6)} fill={hole} />)
    for (let i = 0; i < 14; i++) {
      const y = gy + mm(10) + ((gh - mm(20)) * i) / 13
      parts.push(<line key={`l${i}`} x1={0} y1={y} x2={VW} y2={y} stroke="rgba(255,255,255,.18)" strokeWidth={0.6} />)
    }
  }

  // стыки решёток каждые 500 мм
  for (let x = mm(300); x < VW; x += mm(500)) {
    parts.push(<line key={`j${x}`} x1={x} y1={gy} x2={x} y2={gy + gh} stroke="rgba(20,26,32,.75)" strokeWidth={1.2} />)
  }

  return (
    <g>
      <rect x={0} y={y0} width={VW} height={mm(W)} fill="url(#fl-steel)" filter="url(#fl-shadow)" />
      <rect x={0} y={gy} width={VW} height={gh} fill="#d3d9de" />
      {parts}
      <rect x={0} y={y0} width={VW} height={1.2} fill="rgba(255,255,255,.7)" />
    </g>
  )
}

export default function FloorLook() {
  const { cat, state, set, result } = useCfg()
  const key = floorKey(state, cat)
  const floor = cat.floorsBy[key]
  const plan = result.plan
  const k = VW / floor.span // пикселей в миллиметре
  const photoH = (VW * 2) / 3 // фото 3:2
  const rule = 500 * k
  const gr = cat.gratesBy[state.grate]

  const caption =
    plan.ser.kind === 'slot'
      ? `щелевой канал ${plan.ser.name}, щель ${plan.ser.slot || 20} мм`
      : `канал ${plan.ser.name} шириной ${plan.ser.W} мм, решётка ${gr ? gr.name.toLowerCase() : ''}`

  return (
    <div className="look">
      <div className="look__head">
        <span className="row-label">Пол вокруг канала</span>
        <div className="look__floors" role="radiogroup" aria-label="Покрытие пола">
          {cat.floors.map((f) => (
            <button
              key={f.key}
              type="button"
              role="radio"
              aria-checked={f.key === key}
              className={'floor-chip' + (f.key === key ? ' is-on' : '')}
              onClick={() => set({ floor: f.key })}
            >
              <i className={`floor-chip__dot floor-chip__dot--${f.key}`} aria-hidden="true" />
              {f.name}
            </button>
          ))}
        </div>
      </div>
      <svg className="look__pic" viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label="Канал с решёткой в выбранном полу, вид сверху">
        <defs>
          <filter id="fl-shadow" x="-5%" y="-50%" width="110%" height="200%">
            <feDropShadow dx="0" dy="1.2" stdDeviation="1.4" floodColor="#000" floodOpacity=".35" />
          </filter>
          <linearGradient id="fl-steel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e9edf0" />
            <stop offset=".5" stopColor="#c4cbd0" />
            <stop offset="1" stopColor="#dfe4e8" />
          </linearGradient>
        </defs>
        <image href={floor.img} x={0} y={VH / 2 - photoH * floor.focus} width={VW} height={photoH} preserveAspectRatio="xMidYMid slice" />
        <Channel plan={plan} grate={state.grate} k={k} />
        <g className="look__rule">
          <rect x={VW - rule - 22} y={VH - 29} width={rule + 12} height={22} rx={3} />
          <line x1={VW - rule - 16} y1={VH - 14} x2={VW - 16} y2={VH - 14} />
          <line x1={VW - rule - 16} y1={VH - 18} x2={VW - rule - 16} y2={VH - 12} />
          <line x1={VW - 16} y1={VH - 18} x2={VW - 16} y2={VH - 12} />
          <text x={VW - 16 - rule / 2} y={VH - 18} textAnchor="middle">
            500 мм
          </text>
        </g>
      </svg>
      <p className="hint">
        Вид сверху, в масштабе: {caption}, {floor.what}.
      </p>
    </div>
  )
}
