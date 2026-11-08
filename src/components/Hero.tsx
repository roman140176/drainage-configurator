import { useCfg } from './context'

export default function Hero() {
  const { cat } = useCfg()

  const facts = [
    [cat.series.length, 'серий каналов, от щелевого S60 до S370'],
    [cat.grates.length, 'типа решёток под нагрузку от A15 до D400'],
    [cat.traps.length, 'трапов с ценами и пропускной способностью'],
  ] as const

  return (
    <header className="hero">
      <div className="wrap hero__in">
        <div className="hero__text">
          <p className="eyebrow">Конфигуратор · водоотвод из нержавеющей стали</p>
          <h1 className="hero__h1">Соберите линейный водоотвод с чертежом и сметой</h1>
          <p className="hero__lead">
            Опишите объект и трассу. Конфигуратор подберёт сечение канала по расходу воды и решётку под нагрузку,
            разложит трассу на секции с уклоном и выпусками и посчитает стоимость.
          </p>
        </div>
        <ul className="facts">
          {facts.map(([n, text]) => (
            <li key={text}>
              <b>{n}</b>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="wrap">
        <p className="demo-note">
          Цены демонстрационные: канал по прайсу, решётки и комплектующие по открытым ценам рынка, монтаж и
          доставка по нашей оценке. Данные отдаёт мок-сервер, их можно править в <code>mock/db.json</code>.
        </p>
      </div>
    </header>
  )
}
