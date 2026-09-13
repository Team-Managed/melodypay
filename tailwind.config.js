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
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        app: {
          bg: '#FBFBF9',
          dark: '#111113',
          border: '#E2E2DA',
          canvas: '#FBFBF9',
          subtle: '#F4F4F0',
          surface: '#FFFFFF',
          ink: '#111113',
          slate: '#4B4B52',
          muted: '#7A7A85',
          cyan: '#0088FF',
          amber: '#F59E0B',
          emerald: '#10B981',
          purple: '#836EF9',
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
