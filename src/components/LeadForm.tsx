import { useState } from 'react'
import { Alert, Button, Checkbox, Form, Input } from 'antd'
import { sendLead } from '../api/client'
import { num } from '../engine/format'
import { leadTime, stampRows } from '../engine/summary'
import { useCfg } from './context'

interface Fields {
  name?: string
  phone: string
  email?: string
  comment?: string
  consent: boolean
}

// Заявка уходит в мок (POST /leads), json-server сохранит её в mock/db.json
export default function LeadForm() {
  const { cat, state, result } = useCfg()
  const [form] = Form.useForm<Fields>()
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (v: Fields) => {
    setSending(true)
    setStatus(null)
    try {
      const lead = await sendLead({
        name: v.name ?? '',
        phone: v.phone,
        email: v.email ?? '',
        comment: v.comment ?? '',
        link: window.location.href,
        summary: [...stampRows(state, result, cat), ['Срок изготовления', `${leadTime(result, cat)} раб. дней`]],
        rows: result.plan.rows.map((r) => ({
          name: r.name,
          qty: r.unit === 'п.м' ? num(r.qty, 2) : String(r.qty),
          unit: r.unit,
          sum: Math.round(r.sum),
        })),
        total: Math.round(result.plan.total),
        createdAt: new Date().toISOString(),
      })
      setStatus({ ok: true, text: `Заявка №${lead.id} у менеджера. Перезвоним в рабочее время и подтвердим цену и срок.` })
      form.resetFields()
    } catch {
      setStatus({ ok: false, text: 'Не получилось отправить. Проверьте, что запущен мок-сервер, и попробуйте ещё раз.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="lead" id="lead">
      <h2 className="h2">Отправить расчёт</h2>
      <p className="lead__intro">
        Менеджер получит чертёж и спецификацию целиком, проверит по объекту и пришлёт коммерческое предложение.
      </p>
      <Form<Fields> form={form} layout="vertical" requiredMark={false} onFinish={submit} disabled={sending}>
        <Form.Item name="name" label="Имя">
          <Input autoComplete="name" />
        </Form.Item>
        <Form.Item
          name="phone"
          label="Телефон"
          rules={[
            { required: true, message: 'Нужен телефон, чтобы перезвонить' },
            {
              validator: (_, value: string) =>
                !value || value.replace(/\D/g, '').length === 11
                  ? Promise.resolve()
                  : Promise.reject(new Error('Нужно 11 цифр, например +7 900 123-45-67')),
            },
          ]}
        >
          <Input type="tel" autoComplete="tel" placeholder="+7" />
        </Form.Item>
        <Form.Item name="email" label="Почта" rules={[{ type: 'email', message: 'Проверьте адрес почты' }]}>
          <Input type="email" autoComplete="email" />
        </Form.Item>
        <Form.Item name="comment" label="Комментарий">
          <Input.TextArea rows={3} placeholder="Адрес объекта, сроки, что важно" />
        </Form.Item>
        <Form.Item
          name="consent"
          valuePropName="checked"
          rules={[{ validator: (_, v) => (v ? Promise.resolve() : Promise.reject(new Error('Без согласия не сможем ответить'))) }]}
        >
          <Checkbox>Согласен на обработку персональных данных</Checkbox>
        </Form.Item>
        <Button type="primary" htmlType="submit" size="large" block loading={sending}>
          Отправить менеджеру
        </Button>
      </Form>
      {status && <Alert className="lead__status" type={status.ok ? 'success' : 'error'} showIcon title={status.text} />}
    </div>
  )
}
