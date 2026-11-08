import { useEffect, useMemo, useRef, useState } from 'react'
import { layoutPlan, type Prim } from '../../drawing/planLayout'
import { useCfg } from '../context'

function Shape({ p }: { p: Prim }) {
  switch (p.kind) {
    case 'path':
      return <path d={p.d} className={p.cls} />
    case 'line':
      return <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} className={p.cls || undefined} />
    case 'rect':
      return <rect x={p.x} y={p.y} width={p.w} height={p.h} className={p.cls} />
    case 'circle':
      return <circle cx={p.cx} cy={p.cy} r={p.r} className={p.cls} />
    case 'text':
      return (
        <text
          x={p.x}
          y={p.y}
          className={p.cls}
          textAnchor={p.anchor}
          transform={p.rot ? `rotate(${p.rot} ${p.x} ${p.y})` : undefined}
        >
          {p.s}
        </text>
      )
  }
}

export default function PlanDrawing() {
  const { state, result } = useCfg()
  const ref = useRef<SVGSVGElement>(null)
  // На узком экране лист в другой системе координат, иначе подписи сжимаются до 5 px
  const [wide, setWide] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width
      setWide(!(w > 0 && w < 560))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const plan = useMemo(() => layoutPlan(result, state, wide), [result, state, wide])

  return (
    <svg ref={ref} className="plan" viewBox={`0 0 ${plan.vw} ${plan.vh}`} role="img" aria-label="План трассы водоотвода">
      <g className="pl-dim">
        {plan.dim.map((p, i) => (
          <Shape key={i} p={p} />
        ))}
      </g>
      <g>
        {plan.body.map((p, i) => (
          <Shape key={i} p={p} />
        ))}
      </g>
      <g>
        {plan.mark.map((p, i) => (
          <Shape key={i} p={p} />
        ))}
      </g>
    </svg>
  )
}
