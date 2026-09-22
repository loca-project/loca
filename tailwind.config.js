/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        loca: {
          50: '#eef6ff',
          100: '#d9eaff',
          500: '#2f7de1',
          600: '#1f63bd',
          700: '#184c93',
        },
      },
    },
  },
  plugins: [],
};
