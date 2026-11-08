import { Button, InputNumber, Segmented } from 'antd'
import { AimOutlined } from '@ant-design/icons'
import { num, plural } from '../../engine/format'
import { SHAPES } from '../../engine/geometry'
import { freeSides } from '../../engine/summary'
import type { Shape } from '../../types'
import { useCfg } from '../context'
import StepCard from './StepCard'

// Пиктограммы форм трассы в том же стиле, что и чертёж
const ICONS: Record<Exclude<Shape, 'free'>, string> = {
  line: 'M6 24 H42',
  L: 'M8 10 H40 V40',
  U: 'M8 10 V38 H40 V10',
  T: 'M6 12 H42 M24 12 V40',
  frame: 'M8 10 H40 V38 H8 Z',
}

export default function RouteStep({ onTrace }: { onTrace: () => void }) {
  const { cat, state, set, result } = useCfg()
  const free = state.shape === 'free'
  const shape = SHAPES[state.shape]

  const setLength = (i: number, v: number | null) => {
    if (!v || v <= 0) return
    const lengths = state.lengths.slice()
    lengths[i] = v
    set({ lengths })
  }

  // Сбросить свою трассу: возвращаемся к прямой той же длины
  const clearTrace = () => {
    const lengths = state.lengths.slice()
    lengths[0] = Math.round(result.geo.total * 10) / 10
    set({ shape: 'line', lengths })
  }

  return (
    <StepCard n="02" title="Трасса">
      <Segmented<Shape>
        block
        className="shapes"
        value={free ? undefined : state.shape}
        onChange={(v) => set({ shape: v })}
        options={(Object.keys(ICONS) as (keyof typeof ICONS)[]).map((key) => ({
          value: key,
          label: (
            <span className="shape">
              <svg viewBox="0 0 48 48" aria-hidden="true">
                <path d={ICONS[key]} />
              </svg>
              <span className="shape__name">{SHAPES[key].name}</span>
            </span>
          ),
        }))}
      />

      {free ? (
        <div className="own-trace">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 18 L9 8 L15 13 L20 5" />
            <circle cx="4" cy="18" r="2" />
            <circle cx="20" cy="5" r="2" />
          </svg>
          <span>
            {state.closed ? 'Замкнутая трасса' : 'Своя трасса'} · {freeSides(state)}{' '}
            {plural(freeSides(state), 'сторона', 'стороны', 'сторон')} · {num(result.geo.total)} м
          </span>
          <Button size="small" type="link" onClick={onTrace}>
            изменить
          </Button>
          <Button size="small" type="link" onClick={clearTrace}>
            сбросить
          </Button>
        </div>
      ) : (
        <div className="fields">
          {shape.labels.map((label, i) => (
            <label key={label} className="field">
              <span className="field__label">{label}</span>
              <InputNumber
                value={state.lengths[i]}
                min={0.5}
                max={cat.settings.rules.maxLen}
                step={0.5}
                decimalSeparator=","
                suffix="м"
                style={{ width: '100%' }}
                onChange={(v) => setLength(i, v)}
              />
            </label>
          ))}
        </div>
      )}

      <button type="button" className="trace-btn" onClick={onTrace}>
        <AimOutlined className="trace-btn__icon" />
        <span>
          <b>Обвести трассу по плану</b>
          <small>План цеха или участка, генплан, эскиз или скриншот карты. Длины встанут сами.</small>
        </span>
      </button>
    </StepCard>
  )
}
