import { Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { fmtInt, money, num, SRC_LABEL } from '../engine/format'
import type { Row } from '../engine/plan'
import type { Src } from '../types'
import { useCfg } from './context'

const SRC_COLOR: Record<Src, string> = {
  catalog: 'blue',
  price: 'geekblue',
  market: 'gold',
  est: 'default',
}

type Line = (Row & { key: string; n: number }) | { key: string; group: string }

export default function SpecTable() {
  const { result } = useCfg()
  const P = result.plan

  // Работы и доставку отделяем строкой-заголовком: снабженцу важно видеть цену железа отдельно
  const data: Line[] = []
  let groupAdded = false
  P.rows.forEach((r, i) => {
    if (r.work && !groupAdded) {
      groupAdded = true
      data.push({ key: 'works', group: 'Работы и доставка' })
    }
    data.push({ ...r, key: String(i), n: i + 1 })
  })

  const isGroup = (l: Line): l is { key: string; group: string } => 'group' in l
  const cellSpan = (l: Line) => ({ colSpan: isGroup(l) ? 0 : 1 })

  const columns: ColumnsType<Line> = [
    {
      title: '№',
      width: 44,
      render: (_, l) => (isGroup(l) ? '' : l.n),
    },
    {
      title: 'Наименование',
      onCell: (l) => ({ colSpan: isGroup(l) ? 5 : 1 }),
      render: (_, l) =>
        isGroup(l) ? (
          <b className="spec__group">{l.group}</b>
        ) : (
          <>
            {l.name} <Tag color={SRC_COLOR[l.src]}>{SRC_LABEL[l.src]}</Tag>
          </>
        ),
    },
    {
      title: 'Кол-во',
      align: 'right',
      className: 'nowrap',
      onCell: cellSpan,
      render: (_, l) => (isGroup(l) ? null : l.unit === 'п.м' ? num(l.qty, 2) : l.qty),
    },
    { title: 'Ед.', className: 'nowrap', onCell: cellSpan, render: (_, l) => (isGroup(l) ? null : l.unit) },
    {
      title: 'Цена, ₽',
      align: 'right',
      className: 'nowrap',
      onCell: cellSpan,
      render: (_, l) => (isGroup(l) || l.price === 0 ? null : fmtInt(l.price)),
    },
    {
      title: 'Сумма, ₽',
      align: 'right',
      className: 'nowrap',
      onCell: cellSpan,
      render: (_, l) =>
        isGroup(l) ? null : l.price === 0 ? <span className="spec__incl">{l.note || 'в цене канала'}</span> : fmtInt(l.sum),
    },
  ]

  return (
    <div className="spec">
      <h2 className="h2">Спецификация</h2>
      <Table<Line>
        size="small"
        columns={columns}
        dataSource={data}
        pagination={false}
        scroll={{ x: 640 }}
        rowClassName={(l) => (isGroup(l) ? 'spec__group-row' : '')}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} />
            <Table.Summary.Cell index={1} colSpan={4}>
              <b>Итого ориентировочно</b>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="right">
              <b>{money(P.total)}</b>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />
      <p className="legend">
        <Tag color={SRC_COLOR.catalog}>каталог</Tag> цена из каталога трапов
        <Tag color={SRC_COLOR.price}>прайс</Tag> цена канала за метр
        <Tag color={SRC_COLOR.market}>ориентир рынка</Tag> по открытым прайсам
        <Tag color={SRC_COLOR.est}>оценка</Tag> работы и доставка, уточнит менеджер.
      </p>
    </div>
  )
}
