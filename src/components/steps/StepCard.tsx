import type { ReactNode } from 'react'
import { Card } from 'antd'

export default function StepCard({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <Card
      className="step"
      title={
        <span className="step__title">
          <span className="step__n">{n}</span>
          {title}
        </span>
      }
    >
      {children}
    </Card>
  )
}
