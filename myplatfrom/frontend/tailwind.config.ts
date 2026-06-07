import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#fff8f0',
        bg2:     '#ffffff',
        bg3:     '#fff2e3',
        border:  '#f3e6d4',
        border2: '#ecd9bf',
        text:    '#2b1c10',
        muted:   '#a3917b',
        accent:  { DEFAULT: '#f97316', 2: '#fb923c' },
        teal:    '#0d9488',
        blue:    '#2563eb',
        violet:  '#7c3aed',
        rose:    '#e11d48',
        green:   '#16a34a',
        yellow:  '#d97706',
      },
      fontFamily: {
        sans:    ['Noto Sans Thai', 'sans-serif'],
        mono:    ['DM Mono', 'monospace'],
        display: ['Mitr', 'Noto Sans Thai', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
