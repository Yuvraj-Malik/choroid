/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Public Sans"', 'system-ui', 'sans-serif'] },
      colors: {
        canvas: '#F4F5F7',
        surface: '#FFFFFF',
        line: { DEFAULT: '#D9DDE3', soft: '#E9ECF0' },
        ink: { DEFAULT: '#14181D', 2: '#2F3640' },
        muted: '#5A6472',
        subtle: '#8A93A0',
        icg: { DEFAULT: '#0E6B5A', hover: '#0B5A4C', tint: '#E7F2EF' },
        fluo: { DEFAULT: '#B7791F', tint: '#FBF3E4' },
        danger: { DEFAULT: '#B42318', tint: '#FDECEA' },
      },
      borderRadius: { DEFAULT: '4px', md: '6px' },
      fontSize: { '2xs': ['11px', '16px'] },
    },
  },
  plugins: [],
}
