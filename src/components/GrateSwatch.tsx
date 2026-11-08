// Значок рисунка решётки 48x48: плита и прорези
export default function GrateSwatch({ type }: { type: string }) {
  return (
    <svg className="swatch" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="46" height="46" rx="3" className="swatch__plate" />
      {type === 'perf' &&
        // по две прорези вдоль каждой стороны и ромб из диагональных в центре
        [0, 90, 180, 270].map((rot) => (
          <g key={rot} transform={`rotate(${rot} 24 24)`}>
            <rect x="11" y="8.5" width="10" height="2.8" rx="1.4" className="swatch__hole" />
            <rect x="27" y="8.5" width="10" height="2.8" rx="1.4" className="swatch__hole" />
            <rect x="13" y="16.6" width="10" height="2.8" rx="1.4" transform="rotate(-45 18 18)" className="swatch__hole" />
          </g>
        ))}
      {type === 'shhel' &&
        // лесенка: полосы на ребро, между ними щели
        Array.from({ length: 6 }, (_, i) => (
          <rect key={i} x={7.4 + i * 6.2} y="7" width="3.2" height="34" rx="1.6" className="swatch__hole" />
        ))}
      {type === 'plast' && (
        // сплошная плита, вода уходит в щель по периметру
        <>
          <rect x="5" y="5" width="38" height="38" rx="1.5" className="swatch__hole" />
          <rect x="9.5" y="9.5" width="29" height="29" rx="1" className="swatch__plate" />
        </>
      )}
      {type === 'yach' &&
        Array.from({ length: 16 }, (_, i) => (
          <rect key={i} x={6.5 + (i % 4) * 9.2} y={6.5 + Math.floor(i / 4) * 9.2} width="7.4" height="7.4" className="swatch__hole" />
        ))}
    </svg>
  )
}
