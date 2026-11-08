import type { ReactNode } from 'react'
import { Button, Checkbox, InputNumber, Segmented, Select } from 'antd'
import { classWhat } from '../../engine/catalog'
import { grateOk } from '../../engine/plan'
import type { State } from '../../types'
import { useCfg } from '../context'
import FloorLook from '../FloorLook'
import GrateSwatch from '../GrateSwatch'
import StepCard from './StepCard'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      {children}
    </div>
  )
}

export default function BuildStep() {
  const { cat, state, set, result } = useCfg()
  const o = cat.objectsBy[state.object]
  const plan = result.plan
  const slotKind = state.channel === 's' ? 'slot' : 'grate'
  const offGrates = cat.grates.filter((g) => !grateOk(cat, state.object, g.key))

  // Сегмент-переключатель для полей с короткими вариантами
  const seg = <K extends keyof State>(key: K, options: { value: State[K] & (string | number); label: string }[]) => (
    <Segmented
      block
      value={state[key] as string | number}
      onChange={(v) => set({ [key]: v } as Partial<State>)}
      options={options}
    />
  )

  return (
    <StepCard n="04" title="Исполнение">
      <Row label="Канал">
        <Segmented
          block
          value={state.channel}
          onChange={(v) => set({ channel: v as State['channel'] })}
          options={[
            { value: 'g', label: 'С решёткой' },
            { value: 's', label: 'Щелевой', disabled: !o.slotOk },
          ]}
        />
        {!o.slotOk && (
          <p className="off-note">Щелевой только для пешеходных зон, дворов и террас: решётки у него нет, по щели не ездят.</p>
        )}
      </Row>

      <Row label="Серия">
        <div className="series-row">
          <Select
            value={state.series}
            onChange={(v) => set({ series: v })}
            style={{ flex: 1, minWidth: 0 }}
            options={[
              { value: 'auto', label: 'Подобрать выгодную' },
              ...cat.series
                .filter((s) => s.kind === slotKind)
                .map((s) => ({ value: s.key, label: `${s.name} · Wh ${s.Wh} мм` })),
            ]}
          />
          <span className="series-row__note">{state.series === 'auto' ? `Авто: ${plan.ser.name}` : 'Вручную'}</span>
        </div>
      </Row>

      {state.channel === 'g' && (
        <Row label="Решётка">
          <div className="grates" role="radiogroup" aria-label="Решётка">
            {cat.grates.map((g) => {
              const ok = grateOk(cat, state.object, g.key)
              const on = state.grate === g.key
              return (
                <button
                  key={g.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={!ok}
                  title={ok ? '' : `Не держит нагрузку объекта (${o.klass})`}
                  className={'grate' + (on ? ' is-on' : '') + (ok ? '' : ' is-off')}
                  onClick={() => set({ grate: g.key })}
                >
                  <GrateSwatch type={g.key} />
                  <span className="grate__name">
                    {g.name} <i>{g.maxClass}</i>
                  </span>
                  {/* Причину пишем прямо в карточке: подсказку при наведении на телефоне не увидеть */}
                  <span className="grate__purpose">{ok ? g.purpose : `не выдержит ${o.klass}, нагрузку этого объекта`}</span>
                </button>
              )
            })}
          </div>
          {offGrates.length > 0 && (
            <p className="off-note">
              Нагрузка объекта "{o.name}": {o.klass} ({classWhat(cat, o.klass)}). Решётки слабее этого класса недоступны.
            </p>
          )}
        </Row>
      )}

      <FloorLook />

      <div className="grid2">
        <Row label="Сталь">
          {seg('steel', [
            { value: '304', label: 'AISI 304' },
            { value: '316', label: 'AISI 316' },
          ])}
        </Row>
        <Row label="Внутренний уклон">
          {seg('slope', [
            { value: 0, label: 'Нет' },
            { value: 0.5, label: '0,5 %' },
            { value: 1, label: '1 %' },
          ])}
        </Row>
        <Row label="Стыки секций">
          {seg('joint', [
            { value: 'f', label: 'Фланцы' },
            { value: 'w', label: 'Сварка' },
          ])}
        </Row>
        <Row label="Выпуск">
          {seg('outlet', [
            { value: 'trap', label: 'Трап' },
            { value: 'pipe', label: 'В дне' },
          ])}
        </Row>
        <Row label="Труба уходит">
          {seg('direction', [
            { value: 'v', label: 'Вниз' },
            { value: 'h', label: 'Вбок' },
          ])}
        </Row>
        <Row label="Выпусков">
          <div className="outlets">
            <InputNumber
              value={state.outlets || null}
              placeholder={String(plan.nMin)}
              min={1}
              max={99}
              precision={0}
              aria-label="Число выпусков, пусто значит авто"
              style={{ width: '100%' }}
              onChange={(v) => set({ outlets: v && v > 0 ? v : 0 })}
            />
            <Button onClick={() => set({ outlets: 0 })} type={state.outlets ? 'default' : 'primary'} ghost={!state.outlets}>
              авто: {plan.nMin}
            </Button>
          </div>
        </Row>
      </div>

      <Checkbox checked={state.sand} onChange={(e) => set({ sand: e.target.checked })}>
        Пескоуловитель на каждом выпуске
      </Checkbox>
    </StepCard>
  )
}
