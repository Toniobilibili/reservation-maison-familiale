import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#e9efff',
          200: '#cdd7ff',
          300: '#abb8ff',
          400: '#7f88ff',
          500: '#5b5ef2',
          600: '#494fd6',
          700: '#3d41b0',
          800: '#343887',
          900: '#2f3170',
        },
      },
      boxShadow: {
        soft: '0 12px 30px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
