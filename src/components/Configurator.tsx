import { useState } from 'react'
import { useConfigurator } from '../hooks/useConfigurator'
import type { Catalog } from '../types'
import Alternatives from './Alternatives'
import { ConfiguratorContext } from './context'
import Hero from './Hero'
import HowItWorks from './HowItWorks'
import LeadForm from './LeadForm'
import MobileTotal from './MobileTotal'
import Sheet from './sheet/Sheet'
import SpecTable from './SpecTable'
import BuildStep from './steps/BuildStep'
import ObjectStep from './steps/ObjectStep'
import RouteStep from './steps/RouteStep'
import WaterStep from './steps/WaterStep'
import WorksStep from './steps/WorksStep'
import TraceModal from './TraceModal'

export default function Configurator({ cat }: { cat: Catalog }) {
  const cfg = useConfigurator(cat)
  // ?trace=plan сразу открывает обводку трассы
  const [traceOpen, setTraceOpen] = useState(() => /[?&]trace=plan\b/.test(window.location.search))

  return (
    <ConfiguratorContext.Provider value={{ ...cfg, cat }}>
      <Hero />

      <section className="band band--tool">
        <div className="wrap tool">
          <div className="steps">
            <ObjectStep />
            <RouteStep onTrace={() => setTraceOpen(true)} />
            <WaterStep />
            <BuildStep />
            <WorksStep />
          </div>
          <Sheet />
        </div>
      </section>

      <Alternatives />

      <section className="band band--spec" id="spec">
        <div className="wrap spec-grid">
          <SpecTable />
          <LeadForm />
        </div>
      </section>

      <HowItWorks />

      <footer className="footer">
        <div className="wrap">Демо-проект. Цены условные, расчёт ориентировочный.</div>
      </footer>

      <MobileTotal />
      <TraceModal open={traceOpen} onClose={() => setTraceOpen(false)} />
    </ConfiguratorContext.Provider>
  )
}
