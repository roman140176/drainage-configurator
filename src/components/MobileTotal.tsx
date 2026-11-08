import { money } from '../engine/format'
import { useCfg } from './context'

// На телефоне лист уезжает вниз, поэтому итог держим в нижней плашке
export default function MobileTotal() {
  const { result } = useCfg()
  return (
    <a className="mobile-total" href="#sheet">
      <span>Итого</span>
      <b>≈ {money(result.plan.total)}</b>
      <span>к чертежу ↓</span>
    </a>
  )
}
