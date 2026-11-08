import { money } from '../engine/format'
import { useCfg } from './context'

// Сравнение серий: узкий канал дешевле за метр, но просит больше выпусков
export default function Alternatives() {
  const { state, set, result } = useCfg()
  const list = result.alts.slice(0, 4)
  const max = Math.max(1, ...list.map((p) => p.total))

  return (
    <section className="band band--alts">
      <div className="wrap alts">
        <div className="alts__text">
          <h2 className="h2">Шире канал, меньше выпусков</h2>
          <p>
            Узкий канал дешевле за метр, но просит больше выпусков и трапов. Здесь серии, которые подходят объекту,
            при той же трассе и воде. Нажмите, чтобы посчитать с другой.
          </p>
        </div>
        <div className="alts__list">
          {list.map((p, i) => {
            const on = p.ser.key === result.plan.ser.key
            return (
              <button
                key={p.ser.key}
                type="button"
                className={'alt' + (on ? ' is-on' : '')}
                aria-pressed={on}
                onClick={() => set({ series: p.ser.key })}
              >
                <span className="alt__name">
                  {p.ser.name}
                  {i === 0 && <em>выгоднее всех</em>}
                  {on && state.series === 'auto' && <em className="alt__auto">подобрана</em>}
                </span>
                <span className="alt__meta">
                  Wh {p.ser.Wh} мм · выпусков {p.N}
                  {p.slope > 0 ? ` · H у выпуска ${p.hOut}` : ''}
                </span>
                <span className="alt__bar" aria-hidden="true">
                  <i style={{ width: `${(p.total / max) * 100}%` }} />
                </span>
                <span className="alt__sum">≈ {money(p.total)}</span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
