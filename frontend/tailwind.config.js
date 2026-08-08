/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        marquee: {
          bg: '#0b0b12',
          panel: '#15151f',
          line: '#26263a',
          gold: '#e8b64c',
          crimson: '#c8384a',
          mint: '#39c3a0',
        },
      },
      fontFamily: {
        display: ['"Bebas Neue"', '"Oswald"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
