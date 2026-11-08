import { useEffect, useState } from 'react'
import { Button, Result, Spin } from 'antd'
import { loadCatalog } from './api/client'
import Configurator from './components/Configurator'
import { prepareCatalog } from './engine/catalog'
import type { Catalog } from './types'

export default function App() {
  const [cat, setCat] = useState<Catalog | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    setError('')
    loadCatalog()
      .then((raw) => setCat(prepareCatalog(raw)))
      .catch((e: Error) => setError(e.message))
  }

  useEffect(load, [])

  if (error) {
    return (
      <Result
        status="warning"
        title="Не удалось загрузить данные"
        subTitle={`Проверь, что запущен мок-сервер: npm run mock (${error})`}
        extra={<Button onClick={load}>Попробовать снова</Button>}
      />
    )
  }

  if (!cat) {
    return (
      <div className="loading">
        <Spin size="large" />
      </div>
    )
  }

  return <Configurator cat={cat} />
}
