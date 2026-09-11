/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./receiver-web/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['"Playfair Display"', 'serif'],
      },
      colors: {
        app: {
          bg: '#F7F7F5',
          dark: '#1C1C1E',
          border: '#E5E5E5'
        }
      },
      animation: {
        'marquee': 'marquee 30s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        }
      }
    },
  },
  plugins: [],
}
