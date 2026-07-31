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
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
