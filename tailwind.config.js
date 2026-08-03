/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        clinical: {
          primary: '#2D6B4F',
          secondary: '#5A8A6B',
          background: '#F4F7F4',
          surface: '#FFFFFF',
          border: '#BCE0C2',
          error: '#CC3333',
          warning: '#D98C26',
          info: '#3373CC',
          success: '#2D6B4F',
        },
        outpatient: {
          primary: '#6D28D9',
          secondary: '#8B5CF6',
          accent: '#A78BFA',
          surface: '#F5F3FF',
          border: '#DDD6FE',
          background: '#FAF5FF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
