import { InputNumber, Segmented } from 'antd'
import { num, plural } from '../../engine/format'
import type { Delivery, Mount } from '../../types'
import { useCfg } from '../context'
import StepCard from './StepCard'

const DELIVERY_HINT: Record<Delivery, string> = {
  '0': 'Забираете сами, время и место погрузки согласует менеджер.',
  msk: 'Газелью до объекта, без разгрузки: каналы лёгкие, 5-9 кг на метр.',
  mo: 'Цена рейса по Москве плюс километры от МКАД.',
  reg: 'До терминала транспортной компании в вашем городе. Стоимость по тарифу ТК назовёт менеджер.',
}

export default function WorksStep() {
  const { cat, state, set, result } = useCfg()
  const W = cat.worksBy
  const visits = result.plan.visits
  const total = result.geo.total

  const mountHint =
    state.mount === 'full'
      ? 'Бригада ставит канал на опоры, выверяет уклон, бетонирует и подключает выпуски. Штробление и демонтаж старого покрытия по месту.'
      : state.mount === 'shef'
        ? `Специалист приезжает к вашей бригаде: показывает установку, проверяет уклоны и стыки. ${visits} ${plural(visits, 'выезд', 'выезда', 'выездов')} на ${num(total)} м трассы.`
        : 'Ставите своей бригадой, инструкцию и чертёж пришлём с заказом.'

  return (
    <StepCard n="05" title="Монтаж и доставка">
      <div className="row">
        <span className="row-label">Монтаж</span>
        <Segmented<Mount>
          block
          value={state.mount}
          onChange={(v) => set({ mount: v })}
          options={[
            { value: '0', label: 'Своими силами' },
            ...(W.shef ? [{ value: 'shef' as const, label: 'Шеф-монтаж' }] : []),
            ...(W.full ? [{ value: 'full' as const, label: 'Под ключ' }] : []),
          ]}
        />
        <p className="hint">{mountHint}</p>
      </div>

      <div className="row">
        <span className="row-label">Доставка</span>
        <Segmented<Delivery>
          block
          value={state.delivery}
          onChange={(v) => set({ delivery: v })}
          options={[
            { value: '0', label: 'Самовывоз' },
            ...(W.msk
              ? [
                  { value: 'msk' as const, label: 'Москва' },
                  { value: 'mo' as const, label: 'За МКАД' },
                ]
              : []),
            { value: 'reg', label: 'Регион' },
          ]}
        />
        {state.delivery === 'mo' && (
          <label className="field field--km">
            <span className="field__label">Сколько километров от МКАД</span>
            <InputNumber
              value={state.km}
              min={1}
              max={500}
              precision={0}
              suffix="км"
              style={{ width: 180 }}
              onChange={(v) => v && v > 0 && set({ km: v })}
            />
          </label>
        )}
        <p className="hint">{DELIVERY_HINT[state.delivery]}</p>
      </div>
    </StepCard>
  )
}
