import type { ThemeConfig } from 'antd'

// Палитра: синий как на чертежах, тёплый акцент для выпусков и размеров
export const palette = {
  primary: '#2453d6',
  ink: '#111c33',
  ink2: '#46536b',
  bg: '#f3f5f9',
  line: '#e3e8f0',
}

export const theme: ThemeConfig = {
  token: {
    colorPrimary: palette.primary,
    colorText: palette.ink,
    colorTextSecondary: palette.ink2,
    colorBgLayout: palette.bg,
    colorBorderSecondary: palette.line,
    borderRadius: 8,
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  components: {
    Card: { headerFontSize: 17 },
    Segmented: { itemSelectedColor: palette.primary },
  },
}
