/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ct: {
          orange: '#E8440A',
          'orange-dark': '#C73A08',
          'orange-light': '#F5672D',
          navy: '#1A2B5F',
          'navy-light': '#263D80',
          gray: '#F4F5F7',
          'gray-dark': '#8B95A5',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
