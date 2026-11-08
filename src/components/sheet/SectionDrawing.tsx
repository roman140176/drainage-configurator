import type { ReactNode } from 'react'
import { num } from '../../engine/format'
import { useCfg } from '../context'

const VW = 340
const VH = 250

// Разрез канала у выпуска: корпус, решётка, опоры, вода и размеры W, Wh, H
export default function SectionDrawing() {
  const { state, result } = useCfg()
  const P = result.plan
  const ser = P.ser
  const slot = ser.kind === 'slot'

  const W = slot ? Math.max(ser.W, ser.Wh + 30) : ser.W
  const Wh = ser.Wh
  const H = P.hOut
  const sc = Math.min((VW - 40) / (W + 170), (VH - 40) / (H + 110))
  const cx = VW / 2 - 14
  const top = 46
  const x = (mm: number) => cx + mm * sc
  const y = (mm: number) => top + mm * sc
  const stroke = Math.max(1.5, ser.t) * sc * 2.2

  const bx0 = -W / 2 - 60
  const bx1 = W / 2 + 60
  const seat = 20
  const lip = (W - Wh) / 2
  const edge = Math.min(lip, 12)

  let corpus: ReactNode
  if (slot) {
    const sw = ser.slot || 20
    const neck = 50
    const d = `M${x(-sw / 2)} ${y(0)} V${y(neck)} H${x(-Wh / 2)} V${y(H)} H${x(Wh / 2)} V${y(neck)} H${x(sw / 2)} V${y(0)}`
    corpus = (
      <>
        <path d={d + ' Z'} className="sc-cavity" />
        <path d={d} className="sc-steel" strokeWidth={stroke} />
        <path d={`M${x(-Wh / 2)} ${y(H - Math.min(30, H * 0.3))} H${x(Wh / 2)} V${y(H)} H${x(-Wh / 2)} Z`} className="sc-water" />
      </>
    )
  } else {
    const d =
      `M${x(-W / 2)} ${y(0)} H${x(-Wh / 2 - edge)} V${y(seat)} H${x(-Wh / 2)} V${y(H)} H${x(Wh / 2)} ` +
      `V${y(seat)} H${x(Wh / 2 + edge)} V${y(0)} H${x(W / 2)}`
    const gx0 = x(-Wh / 2 - edge + 2)
    const gx1 = x(Wh / 2 + edge - 2)
    const gh = Math.max(4, seat * sc)
    const bars = state.grate === 'plast' ? 0 : state.grate === 'perf' ? 9 : state.grate === 'shhel' ? 7 : 6
    corpus = (
      <>
        <path d={`M${x(-Wh / 2)} ${y(seat)} V${y(H)} H${x(Wh / 2)} V${y(seat)} Z`} className="sc-cavity" />
        <path d={`M${x(-Wh / 2)} ${y(H - Math.min(40, H * 0.35))} H${x(Wh / 2)} V${y(H)} H${x(-Wh / 2)} Z`} className="sc-water" />
        <path d={d} className="sc-steel" strokeWidth={stroke} />
        {/* монтажные усы */}
        {[-1, 1].map((s) => (
          <path key={s} d={`M${x((s * Wh) / 2)} ${y(seat + 26)} l${s * 22 * sc} ${26 * sc}`} className="sc-steel sc-steel--thin" />
        ))}
        {/* решётка в посадочной четверти */}
        <rect x={gx0} y={y(0)} width={gx1 - gx0} height={gh} className="sc-grate" />
        {Array.from({ length: Math.max(0, bars - 1) }, (_, i) => {
          const bx = gx0 + ((gx1 - gx0) * (i + 1)) / bars
          return <line key={i} x1={bx} y1={y(0) + 1} x2={bx} y2={y(0) + gh - 1} className="sc-grate-cut" />
        })}
      </>
    )
  }

  const hdim = (x0: number, x1: number, yy: number, label: string) => (
    <g>
      <line x1={x0} y1={yy} x2={x1} y2={yy} className="sc-dim" />
      {[x0, x1].map((xx) => (
        <line key={xx} x1={xx - 4} y1={yy + 4} x2={xx + 4} y2={yy - 4} className="sc-dim" />
      ))}
      <text x={(x0 + x1) / 2} y={yy - 6} textAnchor="middle" className="pl-t sc-t">
        {label}
      </text>
    </g>
  )
  const vx = x(W / 2 + 34)

  return (
    <svg className="section" viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label="Разрез канала у выпуска">
      <defs>
        <pattern id="sc-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" className="sc-hatch" />
        </pattern>
      </defs>
      {/* бетонное основание вокруг канала */}
      <path d={`M${x(bx0)} ${y(0)} H${x(bx1)} V${y(H + 50)} H${x(bx0)} Z`} fill="url(#sc-hatch)" />
      <line x1={x(bx0) - 6} y1={y(0)} x2={x(bx1) + 6} y2={y(0)} className="sc-floor" />
      {corpus}
      {/* регулировочные опоры */}
      {[-1, 1].map((s) => {
        const lx = x(s * (Wh / 2 - Wh * 0.18))
        return (
          <g key={s}>
            <line x1={lx} y1={y(H)} x2={lx} y2={y(H + 34)} className="sc-steel sc-steel--thin" />
            <line x1={lx - 6} y1={y(H + 34)} x2={lx + 6} y2={y(H + 34)} className="sc-steel sc-steel--thin" />
          </g>
        )
      })}
      {hdim(x(-W / 2), x(W / 2), y(0) - 22, slot ? `щель ${ser.slot || 20}` : `W ${W}`)}
      {hdim(x(-Wh / 2), x(Wh / 2), y(Math.max(H * 0.55, 46)), `Wh ${Wh}`)}
      <line x1={vx} y1={y(0)} x2={vx} y2={y(H)} className="sc-dim" />
      {[y(0), y(H)].map((yy) => (
        <line key={yy} x1={vx - 4} y1={yy + 4} x2={vx + 4} y2={yy - 4} className="sc-dim" />
      ))}
      <text x={vx + 14} y={(y(0) + y(H)) / 2} textAnchor="middle" transform={`rotate(-90 ${vx + 14} ${(y(0) + y(H)) / 2})`} className="pl-t sc-t">
        H {H}
      </text>
      <text x={14} y={VH - 12} className="pl-t sc-cap">
        Разрез у выпуска · {ser.name} · металл {num(ser.t)} мм
      </text>
    </svg>
  )
}
