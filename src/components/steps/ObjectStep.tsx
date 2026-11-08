import { useCfg } from '../context'
import StepCard from './StepCard'

export default function ObjectStep() {
  const { cat, state, set } = useCfg()

  return (
    <StepCard n="01" title="Где ставим">
      <div className="choice-grid" role="radiogroup" aria-label="Тип объекта">
        {cat.objects.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={state.object === o.key}
            className={'choice' + (state.object === o.key ? ' is-on' : '')}
            onClick={() => set({ object: o.key })}
          >
            <span className="choice__name">{o.name}</span>
            <span className="choice__meta">
              {o.klass} · Wh от {o.minWh}
            </span>
          </button>
        ))}
      </div>
      {cat.objectsBy[state.object].note && <p className="hint hint--note">{cat.objectsBy[state.object].note}</p>}
    </StepCard>
  )
}
