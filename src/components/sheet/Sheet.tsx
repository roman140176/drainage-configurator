import { useLayoutEffect, useRef } from 'react'
import { App, Button, Dropdown, type MenuProps } from 'antd'
import { DownOutlined } from '@ant-design/icons'
import { clamp, money, num } from '../../engine/format'
import { leadTime, stampRows } from '../../engine/summary'
import { useCfg } from '../context'
import PlanDrawing from './PlanDrawing'
import SectionDrawing from './SectionDrawing'

// Пункт меню-заглушка: выгрузки и рассылки делает бэкенд, его пока нет
function stub(title: string, note: string) {
  return {
    label: (
      <a href="#" className="menu-item" onClick={(e) => e.preventDefault()}>
        <b>{title}</b>
        <small>{note}</small>
      </a>
    ),
  }
}

export default function Sheet() {
  const { cat, state, result } = useCfg()
  const { message } = App.useApp()
  const P = result.plan
  const use = clamp(result.Q / Math.max(P.through, 0.01), 0, 1.2)
  const ref = useRef<HTMLElement>(null)

  // Лист липкий. Если он выше окна, липнет нижним краем, иначе итог и кнопки уедут за экран.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      const top = Math.min(16, window.innerHeight - el.offsetHeight - 16)
      el.style.setProperty('--sheet-top', `${Math.round(top)}px`)
    }
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    window.addEventListener('resize', fit)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [])

  const download: MenuProps['items'] = [
    { key: 'pdf', ...stub('PDF: чертёж и смета', 'распечатать или сохранить') },
    { key: 'dxf', ...stub('Чертёж DXF', 'для завода и монтажника: AutoCAD, nanoCAD, КОМПАС') },
    { key: 'xlsx', ...stub('Смета Excel', 'для снабженца: позиции, количество, цены') },
  ]

  const share: MenuProps['items'] = [
    {
      key: 'link',
      label: (
        <span className="menu-item">
          <b>Скопировать ссылку</b>
          <small>откроет ровно этот расчёт</small>
        </span>
      ),
      onClick: () => {
        navigator.clipboard
          .writeText(window.location.href)
          .then(() => message.success('Ссылка на расчёт скопирована'))
          .catch(() => message.error('Не получилось скопировать, возьмите ссылку из адресной строки'))
      },
    },
    { key: 'share', ...stub('Отправить в мессенджер', 'Telegram, WhatsApp, MAX') },
    { key: 'self', ...stub('Прислать себе на почту', 'чтобы вернуться к расчёту') },
    { key: 'kp', ...stub('КП для своего клиента', 'для подрядчиков: своя наценка и реквизиты') },
  ]

  const toForm = () => {
    const form = document.getElementById('lead')
    form?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setTimeout(() => form?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true }), 500)
  }

  return (
    <aside ref={ref} className="sheet" id="sheet" aria-label="Чертёж и смета">
      <div className="sheet__bar">
        <span>Лист 1 · План трассы</span>
        <span>Ширина канала не в масштабе</span>
      </div>

      <PlanDrawing />

      <div className="sheet__mid">
        <SectionDrawing />
        <div className="sheet__facts">
          <div className={'meter' + (use > 1 ? ' is-over' : '')}>
            <span className="sheet__k">Вода · пропуск системы</span>
            <span className="meter__bar">
              <i style={{ width: `${Math.min(use, 1) * 100}%` }} />
            </span>
            <span className="meter__v">
              <b>{num(result.Q, 2)}</b> из <b>{num(P.through, 2)}</b> л/с
            </span>
          </div>
          {P.warn.length > 0 && (
            <div className="warn">
              {P.warn.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="stamp">
        {stampRows(state, result, cat).map(([k, v]) => (
          <div className="stamp__cell" key={k}>
            <span className="stamp__k">{k}</span>
            <span className="stamp__v">{v}</span>
          </div>
        ))}
      </div>

      <div className="sheet__total">
        <div>
          <span className="sheet__k">Ориентировочно</span>
          <b className="sheet__sum">≈ {money(P.total)}</b>
          <span className="sheet__perm">≈ {money(P.total / Math.max(result.geo.total, 0.1))} за метр системы</span>
        </div>
        <div>
          <span className="sheet__k">Изготовление</span>
          <b className="sheet__lead">{leadTime(result, cat)} раб. дней</b>
          <span className="sheet__perm">после согласования чертежа</span>
        </div>
      </div>

      <div className="sheet__actions">
        <Button type="primary" size="large" onClick={toForm}>
          Отправить менеджеру
        </Button>
        <Dropdown menu={{ items: download }} trigger={['click']}>
          <button type="button" className="sheet__link">
            Скачать <DownOutlined />
          </button>
        </Dropdown>
        <Dropdown menu={{ items: share }} trigger={['click']}>
          <button type="button" className="sheet__link">
            Поделиться <DownOutlined />
          </button>
        </Dropdown>
      </div>
    </aside>
  )
}
