import type { Catalog, RawCatalog } from '../types'

// Object.create(null), чтобы ключ из адреса вроде "constructor" не нашёлся в словаре
function byKey<T extends { key: string }>(list: T[]): Record<string, T> {
  const map: Record<string, T> = Object.create(null)
  list.forEach((item) => {
    map[item.key] = item
  })
  return map
}

export function prepareCatalog(raw: RawCatalog): Catalog {
  return {
    ...raw,
    objectsBy: byKey(raw.objects),
    seriesBy: byKey(raw.series),
    gratesBy: byKey(raw.grates),
    surfacesBy: byKey(raw.surfaces),
    partsBy: byKey(raw.parts),
    worksBy: byKey(raw.works),
    floorsBy: byKey(raw.floors),
    classOrder: raw.classes.map((c) => c.key),
  }
}

export function classRank(cat: Catalog, key: string): number {
  const i = cat.classOrder.indexOf(key)
  return i < 0 ? 0 : i
}

export function classWhat(cat: Catalog, key: string): string {
  return cat.classes.find((c) => c.key === key)?.what ?? ''
}
