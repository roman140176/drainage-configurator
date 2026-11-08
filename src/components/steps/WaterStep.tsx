import { InputNumber, Segmented, Select } from 'antd'
import { num } from '../../engine/format'
import type { Water } from '../../types'
import { useCfg } from '../context'
import StepCard from './StepCard'

export default function WaterStep() {
  const { cat, state, set, result } = useCfg()
  const o = cat.objectsBy[state.object]

  return (
    <StepCard n="03" title="Сколько воды">
      <Segmented<Water>
        block
        value={state.water}
        onChange={(v) => set({ water: v })}
        options={[
          { value: 'a', label: 'Дождь с площади' },
          { value: 'p', label: 'Точки слива в помещении' },
        ]}
      />

      {state.water === 'a' ? (
        <div className="fields">
          <label className="field">
            <span className="field__label">Площадь, с которой собираем воду</span>
            <InputNumber
              value={state.area}
              min={1}
              max={100000}
              suffix="м²"
              style={{ width: '100%' }}
              onChange={(v) => v && v > 0 && set({ area: v })}
            />
          </label>
          <label className="field">
            <span className="field__label">Покрытие</span>
            <Select
              value={state.surface}
              onChange={(v) => set({ surface: v })}
              options={cat.surfaces.map((s) => ({ value: s.key, label: s.name }))}
            />
          </label>
        </div>
      ) : (
        <div className="fields">
          <label className="field">
            <span className="field__label">{o.points.label}</span>
            <InputNumber
              value={state.points}
              min={1}
              max={200}
              precision={0}
              suffix="шт"
              style={{ width: '100%' }}
              onChange={(v) => v && v > 0 && set({ points: v })}
            />
          </label>
          <p className="hint field__aside">
            по {num(o.points.q, 2)} л/с на {o.points.unit}
          </p>
        </div>
      )}

      <p className="readout">
        Расчётный расход <b>{num(result.Q, 2)} л/с</b>
      </p>
    </StepCard>
  )
}
