import { useTheme } from '@/context/theme-context'

// Values from the dataviz skill's validated reference palette (references/palette.md).
// Categorical slots are used in fixed order — never cycled/reassigned by filter state.
const CATEGORICAL = {
  light: ['#2a78d6', '#008300', '#e87ba4', '#eda100', '#1baf7a', '#eb6834', '#4a3aa7', '#e34948'],
  dark: ['#3987e5', '#008300', '#d55181', '#c98500', '#199e70', '#d95926', '#9085e9', '#e66767'],
}

const SEQUENTIAL_HUE = { light: '#2a78d6', dark: '#3987e5' } // step 450, same as categorical slot 1

const CHROME = {
  light: {
    surface: '#fcfcfb',
    primaryInk: '#0b0b0b',
    secondaryInk: '#52514e',
    mutedInk: '#898781',
    gridline: '#e1e0d9',
    baseline: '#c3c2b7',
  },
  dark: {
    surface: '#1a1a19',
    primaryInk: '#ffffff',
    secondaryInk: '#c3c2b7',
    mutedInk: '#898781',
    gridline: '#2c2c2a',
    baseline: '#383835',
  },
}

export function useChartPalette() {
  const { theme } = useTheme()
  return {
    categorical: CATEGORICAL[theme],
    sequentialHue: SEQUENTIAL_HUE[theme],
    chrome: CHROME[theme],
  }
}
