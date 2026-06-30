/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        accent:    '#7C5CFC',
        success:   '#1D9E75',
        danger:    '#E24B4A',
        score:     '#E8833B',
        warning:   '#BA7517',
        'bg-page': '#FCFCFD',
        'text-primary':   '#1A1A23',
        'text-secondary': '#6B6B78',
        'text-tertiary':  '#9B9BA8',
        border:    '#ECECEF',
        'accent-light': '#F4F2FE',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      }
    }
  },
  plugins: []
}
