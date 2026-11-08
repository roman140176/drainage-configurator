import { useCallback, useEffect, useMemo, useState } from 'react'
import { solve } from '../engine/plan'
import { fromHash, initialState, toHash, update } from '../engine/state'
import type { Catalog, State } from '../types'

// Состояние конфигуратора. Расчёт пересобирается на каждое изменение, он быстрый.
export function useConfigurator(cat: Catalog) {
  const [state, setState] = useState<State>(() => fromHash(window.location.hash, cat) ?? initialState(cat))

  const set = useCallback((patch: Partial<State>) => setState((s) => update(s, patch, cat)), [cat])

  const result = useMemo(() => solve(state, cat), [state, cat])

  // Держим расчёт в адресе, чтобы ссылкой можно было поделиться
  useEffect(() => {
    window.history.replaceState(null, '', '#' + toHash(state))
  }, [state])

  // Вставили в адресную строку чужую ссылку: страница не перезагрузится, применяем сами
  useEffect(() => {
    const onHash = () => {
      const next = fromHash(window.location.hash, cat)
      if (next) setState(next)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [cat])

  return { state, set, result }
}

export type Configurator = ReturnType<typeof useConfigurator>
