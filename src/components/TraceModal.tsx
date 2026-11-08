/*
 * Трасса по плану. Загружаем любую картинку (план цеха, генплан, эскиз, скриншот карты),
 * задаём масштаб по отрезку известной длины и щёлкаем по точкам трассы.
 * Повороты притягиваются к 90 градусам: косые отрезки дают косые размеры на листе.
 * Картинка никуда не уходит, работаем с object URL в браузере.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { App, Button, Checkbox, InputNumber, Modal, Space, Upload } from 'antd'
import { InboxOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons'
import { num, plural } from '../engine/format'
import type { Point } from '../types'
import { useCfg } from './context'

interface View {
  x: number
  y: number
  w: number
  h: number
}

interface Trace {
  url: string
  w: number
  h: number
  pxPerM: number
  scaleM: number
  scalePts: Point[]
  pts: Point[]
  closed: boolean
  finished: boolean
  step: 'load' | 'scale' | 'trace'
  view: View | null
}

const EMPTY: Trace = {
  url: '',
  w: 0,
  h: 0,
  pxPerM: 0,
  scaleM: 0,
  scalePts: [],
  pts: [],
  closed: false,
  finished: false,
  step: 'load',
  view: null,
}

// Радиусы попадания в экранных пикселях: по первой точке замыкаем, по последней заканчиваем
const HIT_FIRST = 18
const HIT_LAST = 10
const MAX_POINTS = 60

const dist = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1])

// Притягиваем отрезок к горизонтали или вертикали, если он почти такой
function snap(p: Point, prev: Point | undefined, free: boolean): Point {
  if (!prev || free) return p
  const a = (Math.atan2(p[1] - prev[1], p[0] - prev[0]) * 180) / Math.PI
  const near = Math.round(a / 90) * 90
  if (Math.abs(a - near) < 12) return near % 180 === 0 ? [p[0], prev[1]] : [prev[0], p[1]]
  return p
}

export default function TraceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { set } = useCfg()
  const { message } = App.useApp()
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null)
  const [t, setT] = useState<Trace>(EMPTY)
  const [hover, setHover] = useState<Point | null>(null)
  const [nearFirst, setNearFirst] = useState(false)
  const [scaleInput, setScaleInput] = useState<number | null>(null)

  // Пикселей картинки в одном экранном: для толщины линий и радиусов
  const unit = useCallback(() => {
    const r = svgRef.current?.getBoundingClientRect()
    return r?.width && t.view ? t.view.w / r.width : 1
  }, [t.view])

  // Вписываем картинку в окно с сохранением пропорций
  const fit = useCallback((s: Trace): View => {
    const r = svgRef.current?.getBoundingClientRect()
    const aspect = r?.width && r.height ? r.width / r.height : 1.6
    let w = s.w
    let h = s.h
    if (w / h > aspect) h = w / aspect
    else w = h * aspect
    return { x: (s.w - w) / 2, y: (s.h - h) / 2, w, h }
  }, [])

  useLayoutEffect(() => {
    if (open && t.url) setT((s) => ({ ...s, view: fit(s) }))
  }, [open, t.url, fit])

  useEffect(() => {
    const onResize = () => setT((s) => (s.url ? { ...s, view: fit(s) } : s))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [fit])

  const loadFile = (file: File) => {
    if (!/^image\//.test(file.type)) {
      message.warning('Нужна картинка: JPG или PNG')
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      if (t.url) URL.revokeObjectURL(t.url)
      setT({ ...EMPTY, url, w: img.naturalWidth, h: img.naturalHeight, step: 'scale' })
      setScaleInput(null)
    }
    img.onerror = () => message.error('Картинку не удалось открыть')
    img.src = url
  }

  const finish = useCallback(() => {
    setT((s) => (s.step === 'trace' && s.pts.length >= 2 ? { ...s, finished: true } : s))
    setHover(null)
    setNearFirst(false)
  }, [])

  const undo = useCallback(() => {
    setT((s) => {
      if (s.step === 'scale') return { ...s, scalePts: s.scalePts.slice(0, -1) }
      // сначала отменяем само замыкание, точки остаются
      if (s.closed) return { ...s, closed: false }
      return { ...s, pts: s.pts.slice(0, -1), finished: false }
    })
  }, [])

  const resume = () => setT((s) => ({ ...s, finished: false, closed: false }))

  const clearAll = () =>
    setT((s) => (s.step === 'trace' ? { ...s, pts: [], closed: false, finished: false } : { ...s, scalePts: [] }))

  // Enter заканчивает трассу, Backspace убирает последнюю точку
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (t.step !== 'trace' || (e.target as HTMLElement).closest?.('input, textarea')) return
      if (e.key === 'Enter') {
        e.preventDefault()
        finish()
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
        undo()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, t.step, finish, undo])

  const toImg = (e: { clientX: number; clientY: number }): Point => {
    const r = svgRef.current!.getBoundingClientRect()
    const v = t.view!
    return [v.x + ((e.clientX - r.left) / r.width) * v.w, v.y + ((e.clientY - r.top) / r.height) * v.h]
  }

  const zoom = (f: number, c?: Point) => {
    setT((s) => {
      const v = s.view
      if (!v) return s
      const cx = c ? c[0] : v.x + v.w / 2
      const cy = c ? c[1] : v.y + v.h / 2
      const nw = Math.max(s.w / 40, Math.min(s.w * 4, v.w / f))
      const k = nw / v.w
      return { ...s, view: { x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, w: v.w * k, h: v.h * k } }
    })
  }

  // Колесо мыши масштабирует. Вешаем руками: React ставит wheel пассивным, preventDefault не сработает.
  useEffect(() => {
    const el = svgRef.current
    if (!el || !t.view) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, toImg(e))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  const addPoint = (p: Point, free: boolean) => {
    const u = unit()
    if (t.step === 'scale') {
      setT((s) => {
        const sp = s.scalePts.length >= 2 ? [] : s.scalePts
        return { ...s, scalePts: [...sp, sp.length ? snap(p, sp[0], free) : p] }
      })
      return
    }
    if (t.step !== 'trace') return
    if (t.closed || t.finished) {
      message.info('Трасса закончена. Дорисовать можно кнопкой "Продолжить трассу"')
      return
    }
    const pts = t.pts
    // щелчок по первой точке замыкает контур
    if (pts.length >= 3 && dist(p, pts[0]) < HIT_FIRST * u) {
      setT((s) => ({ ...s, closed: true, finished: true }))
      setHover(null)
      setNearFirst(false)
      return
    }
    // повторный щелчок по последней точке (или двойной щелчок) заканчивает трассу
    if (pts.length >= 2 && dist(p, pts[pts.length - 1]) < HIT_LAST * u) {
      finish()
      return
    }
    if (pts.length === 1 && dist(p, pts[0]) < HIT_LAST * u) return
    if (pts.length >= MAX_POINTS) return
    setT((s) => ({ ...s, pts: [...s.pts, snap(p, s.pts[s.pts.length - 1], free)] }))
  }

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (!t.view) return
    drag.current = { x: e.clientX, y: e.clientY, view: { ...t.view }, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!t.view) return
    const d = drag.current
    if (d) {
      const r = e.currentTarget.getBoundingClientRect()
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) d.moved = true
      if (d.moved) {
        setT((s) => ({
          ...s,
          view: {
            ...d.view,
            x: d.view.x - ((e.clientX - d.x) / r.width) * d.view.w,
            y: d.view.y - ((e.clientY - d.y) / r.height) * d.view.h,
          },
        }))
      }
      return
    }
    // резиновая линия к курсору, у первой точки притягивается к ней
    if (t.step === 'trace' && t.pts.length && !t.closed && !t.finished) {
      const p = toImg(e)
      const near = t.pts.length >= 3 && dist(p, t.pts[0]) < HIT_FIRST * unit()
      setNearFirst(near)
      setHover(near ? t.pts[0] : snap(p, t.pts[t.pts.length - 1], e.shiftKey))
    }
  }

  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current
    drag.current = null
    if (!d || d.moved) return
    addPoint(toImg(e), e.shiftKey)
  }

  const applyScale = () => {
    const [a, b] = t.scalePts
    if (!scaleInput || scaleInput <= 0 || !a || !b) {
      message.warning('Укажите длину отрезка в метрах')
      return
    }
    const px = dist(a, b)
    if (px < 5) {
      message.warning('Отрезок слишком короткий, отметьте концы подальше друг от друга')
      return
    }
    setT((s) => ({ ...s, pxPerM: px / scaleInput, scaleM: scaleInput, step: 'trace' }))
  }

  // Трасса в метрах
  const meters = t.pxPerM ? t.pts.map((p) => [p[0] / t.pxPerM, p[1] / t.pxPerM] as Point) : []
  const closed = t.closed && t.pts.length >= 3
  let length = 0
  for (let i = 1; i < meters.length; i++) length += dist(meters[i - 1], meters[i])
  if (closed) length += dist(meters[meters.length - 1], meters[0])
  const sides = meters.length - (closed ? 0 : 1)

  const done = () => {
    if (meters.length < 2) return
    // сдвигаем к нулю, чтобы в адресе были короткие числа
    const minX = Math.min(...meters.map((p) => p[0]))
    const minY = Math.min(...meters.map((p) => p[1]))
    const vertices = meters
      .slice(0, MAX_POINTS)
      .map((p) => [Math.round((p[0] - minX) * 100) / 100, Math.round((p[1] - minY) * 100) / 100] as Point)
    set({ shape: 'free', vertices, closed: closed && vertices.length >= 3 })
    message.success('Трасса перенесена в расчёт')
    onClose()
  }

  const hint =
    t.step === 'load'
      ? 'Загрузите план или схему. Дальше два шага: масштаб и трасса.'
      : t.step === 'scale'
        ? 'Шаг 1 из 2. Щёлкните по двум концам отрезка, длину которого знаете: стена, ворота, забор, сторона дома. Так зададим масштаб.'
        : t.finished || t.closed
          ? `${t.closed ? 'Контур замкнут.' : 'Трасса закончена.'} Проверьте длины и нажмите "Перенести в расчёт".`
          : 'Шаг 2 из 2. Щёлкайте по точкам трассы. Закончить: двойной щелчок или Enter. Замкнуть: щелчок по первой точке. Повороты притягиваются к прямому углу, с Shift без притяжения. Колесо мыши меняет масштаб, перетаскивание двигает план.'

  // Рисунок поверх плана
  const overlay: ReactNode[] = []
  if (t.view) {
    const u = unit()
    const label = (key: string, x: number, y: number, s: string, anchor: 'start' | 'middle' | 'end' = 'middle') =>
      overlay.push(
        <text key={key} x={x} y={y} fontSize={13 * u} strokeWidth={3 * u} className="trc__lbl" textAnchor={anchor}>
          {s}
        </text>,
      )
    // Подпись длины отводим от отрезка вверх или вправо, чтобы не лежала на линии
    const lenLabel = (key: string, a: Point, b: Point, s: string) => {
      const l = dist(a, b) || 1
      let nx = (b[1] - a[1]) / l
      let ny = -(b[0] - a[0]) / l
      if (ny > 0.01 || (Math.abs(ny) <= 0.01 && nx < 0)) {
        nx = -nx
        ny = -ny
      }
      const side = Math.abs(nx) > 0.7
      label(key, (a[0] + b[0]) / 2 + nx * 10 * u, (a[1] + b[1]) / 2 + ny * 10 * u + (side ? 4 * u : 0), s, side ? 'start' : 'middle')
    }
    const sp = t.scalePts
    if (sp.length === 2) {
      overlay.push(<line key="sl" x1={sp[0][0]} y1={sp[0][1]} x2={sp[1][0]} y2={sp[1][1]} className="trc__scale-line" strokeWidth={3 * u} />)
      if (t.scaleM) label('sm', (sp[0][0] + sp[1][0]) / 2, (sp[0][1] + sp[1][1]) / 2 - 8 * u, `масштаб: ${num(t.scaleM, 2)} м`)
    }
    sp.forEach((p, i) => overlay.push(<circle key={`sp${i}`} cx={p[0]} cy={p[1]} r={5 * u} className="trc__scale-pt" />))

    const pts = t.pts
    if (pts.length) {
      overlay.push(
        <path
          key="line"
          d={pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ') + (t.closed ? ' Z' : '')}
          className="trc__line"
          strokeWidth={6 * u}
        />,
      )
      const last = pts[pts.length - 1]
      if (hover && !t.closed && !t.finished && dist(hover, last) > 6 * u) {
        overlay.push(
          <line
            key="rubber"
            x1={last[0]}
            y1={last[1]}
            x2={hover[0]}
            y2={hover[1]}
            className="trc__rubber"
            strokeWidth={2 * u}
            strokeDasharray={`${6 * u} ${5 * u}`}
          />,
        )
        if (t.pxPerM) lenLabel('rl', last, hover, `${num(dist(last, hover) / t.pxPerM, 2)} м`)
      }
      const segs = pts.length - 1 + (t.closed ? 1 : 0)
      for (let i = 0; i < segs; i++) {
        const a = pts[i]
        const b = pts[(i + 1) % pts.length]
        lenLabel(`len${i}`, a, b, `${num(dist(a, b) / t.pxPerM, 2)} м`)
      }
      const target = nearFirst && !t.closed && !t.finished
      if (target) overlay.push(<circle key="ring" cx={pts[0][0]} cy={pts[0][1]} r={16 * u} className="trc__ring" />)
      pts.forEach((p, j) =>
        overlay.push(
          <circle
            key={`pt${j}`}
            cx={p[0]}
            cy={p[1]}
            r={(j === 0 ? (target ? 9 : 7) : 5) * u}
            className={'trc__pt' + (j === 0 ? ' is-first' : '')}
          />,
        ),
      )
      if (target) label('close', pts[0][0], pts[0][1] - 22 * u, 'замкнуть')
    }
  }

  const tracing = t.step === 'trace'

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width="min(1240px, 96vw)"
      centered
      mask={{ closable: false }}
      title="Трасса по плану или схеме"
      footer={
        <div className="trc__footer">
          <span className="trc__sum">
            {meters.length >= 2 ? (
              <>
                Трасса <b>{num(length)} м</b> · {sides} {plural(sides, 'сторона', 'стороны', 'сторон')}
              </>
            ) : t.pxPerM ? (
              'Трасса не нарисована'
            ) : (
              ''
            )}
          </span>
          <Button onClick={onClose}>Отмена</Button>
          <Button type="primary" disabled={meters.length < 2} onClick={done}>
            Перенести в расчёт
          </Button>
        </div>
      }
    >
      <p className="trc__hint">{hint}</p>

      {t.step !== 'load' && (
        <Space wrap className="trc__tools">
          {tracing && (
            <Checkbox
              checked={t.closed}
              disabled={t.pts.length < 3}
              onChange={(e) => setT((s) => ({ ...s, closed: e.target.checked, finished: e.target.checked || s.finished }))}
            >
              Замкнуть контур
            </Checkbox>
          )}
          {tracing && t.pts.length >= 2 && !t.finished && !t.closed && <Button onClick={finish}>Закончить трассу</Button>}
          {tracing && (t.finished || t.closed) && <Button onClick={resume}>Продолжить трассу</Button>}
          <Button onClick={undo}>Отменить точку</Button>
          <Button onClick={clearAll}>Очистить</Button>
        </Space>
      )}

      <div className="trc__stage">
        {t.step === 'load' ? (
          <Upload.Dragger
            accept="image/*"
            showUploadList={false}
            beforeUpload={(file) => {
              loadFile(file)
              return false
            }}
            className="trc__drop"
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Загрузите план или схему объекта</p>
            <p className="ant-upload-hint">
              План цеха или участка, генплан, эскиз от руки или скриншот карты в JPG или PNG. Картинка остаётся у вас в
              браузере. Если план в PDF, сохраните страницу картинкой или сделайте скриншот.
            </p>
          </Upload.Dragger>
        ) : (
          <div className="trc__plan">
            <svg
              ref={svgRef}
              viewBox={t.view ? `${t.view.x} ${t.view.y} ${t.view.w} ${t.view.h}` : '0 0 1 1'}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={() => setHover(null)}
            >
              <image href={t.url} x={0} y={0} width={t.w} height={t.h} />
              {overlay}
            </svg>
            <div className="trc__zoom">
              <Button size="small" icon={<PlusOutlined />} aria-label="Крупнее" onClick={() => zoom(1.25)} />
              <Button size="small" icon={<MinusOutlined />} aria-label="Мельче" onClick={() => zoom(0.8)} />
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file) => {
                  loadFile(file)
                  return false
                }}
              >
                <Button size="small">Другой план</Button>
              </Upload>
            </div>
            {t.step === 'scale' && t.scalePts.length === 2 && (
              <form
                className="trc__scale"
                onSubmit={(e) => {
                  e.preventDefault()
                  applyScale()
                }}
              >
                <span>Длина отмеченного отрезка</span>
                <InputNumber
                  autoFocus
                  value={scaleInput}
                  onChange={setScaleInput}
                  min={0.1}
                  decimalSeparator=","
                  suffix="м"
                  style={{ width: 140 }}
                />
                <Button type="primary" htmlType="submit">
                  Задать масштаб
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
