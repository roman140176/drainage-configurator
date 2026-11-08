import { useCfg } from './context'

export default function HowItWorks() {
  const { cat } = useCfg()

  return (
    <section className="band band--rules">
      <div className="wrap">
        <h2 className="h2">Как считает конфигуратор</h2>
        <div className="rules">
          <article className="rule">
            <svg viewBox="0 0 220 120" aria-hidden="true" className="rule__pic">
              <path d="M10 92 H210" className="rp-line" />
              <path d="M30 20 l-6 14 M60 14 l-6 14 M90 22 l-6 14 M120 12 l-6 14 M150 20 l-6 14 M180 14 l-6 14" className="rp-rain" />
              <rect x="20" y="70" width="180" height="22" className="rp-area" />
              <text x="110" y="62" textAnchor="middle" className="rp-t">
                Q = ψ · q20 · F
              </text>
            </svg>
            <h3>Сколько воды</h3>
            <p>
              На улице считаем дождь с площади: Q = ψ · q20 · F. Для Москвы q20 = {cat.settings.rain.q20} л/с с гектара
              (СП 32.13330), ψ зависит от покрытия: асфальт 0,95, плитка 0,6, газон 0,1. В помещении считаем точки слива:
              шланг или кран 0,3 л/с (СП 30.13330), моечный пост около 0,5 л/с.
            </p>
          </article>
          <article className="rule">
            <svg viewBox="0 0 220 120" aria-hidden="true" className="rule__pic">
              <path d="M12 40 H208" className="rp-line" />
              <path d="M12 40 V62 L110 92 L208 62 V40" className="rp-chan" />
              <path d="M104 92 h12 v18 h-12z" className="rp-out" />
              <text x="54" y="88" textAnchor="middle" className="rp-t">
                i →
              </text>
              <text x="166" y="88" textAnchor="middle" className="rp-t">
                ← i
              </text>
            </svg>
            <h3>Где выпуски</h3>
            <p>
              Канал с уклоном углубляется к выпуску и упирается в свою максимальную высоту: S230 при уклоне 0,5 % тянется
              от водораздела до выпуска до 15 м. Выпусков ставим столько, чтобы хватило высоты и пропускной способности
              канала и трапа. В помещении узкое место обычно трап, а не канал.
            </p>
          </article>
          <article className="rule">
            <div className="classes" aria-hidden="true">
              {cat.classes.map((c, i) => (
                <span key={c.key} style={{ height: 24 + i * 18 }}>
                  <b>{c.key}</b>
                </span>
              ))}
            </div>
            <h3>Что выдержит решётка</h3>
            <p>
              Класс нагрузки по ГОСТ 32955 и EN 1433: {cat.classes.map((c) => `${c.key}: ${c.what}`).join('; ')}. Решётки,
              которые не держат нагрузку объекта, конфигуратор не предложит.
            </p>
          </article>
        </div>
      </div>
    </section>
  )
}
