import type { Src } from '../types'

const NBSP = ' '

export function fmtInt(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
}

// Деньги округляем до десятков, как в смете
export function money(n: number): string {
  return fmtInt(Math.round(n / 10) * 10) + NBSP + '₽'
}

// Число с запятой: num(1.25, 2) -> "1,25"
export function num(n: number, digits = 1): string {
  const p = Math.pow(10, digits)
  return String(Math.round(n * p) / p).replace('.', ',')
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

// "12,5" и "12.5" и "1 200" должны читаться одинаково
export function parseNum(v: string): number {
  return parseFloat(String(v).replace(',', '.').replace(/\s+/g, ''))
}

export const SRC_LABEL: Record<Src, string> = {
  catalog: 'каталог',
  price: 'прайс',
  market: 'ориентир рынка',
  est: 'оценка',
}
