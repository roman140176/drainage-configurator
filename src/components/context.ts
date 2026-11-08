import { createContext, useContext } from 'react'
import type { Configurator } from '../hooks/useConfigurator'
import type { Catalog } from '../types'

export interface Ctx extends Configurator {
  cat: Catalog
}

export const ConfiguratorContext = createContext<Ctx | null>(null)

export function useCfg(): Ctx {
  const ctx = useContext(ConfiguratorContext)
  if (!ctx) throw new Error('useCfg вне ConfiguratorContext')
  return ctx
}
