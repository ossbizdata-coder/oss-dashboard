module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e8eaf6',
          100: '#c5cae9',
          500: '#3f51b5',
          600: '#3949ab',
          700: '#303f9f',
          800: '#283593',
          900: '#1a237e',
        },
        cafe: { DEFAULT: '#068A4B', light: '#e8f5e9' },
        bookshop: { DEFAULT: '#1565C0', light: '#e3f2fd' },
        foodhut: { DEFAULT: '#B65505', light: '#fff3e0' },
        credits: { DEFAULT: '#E60B31', light: '#fce4ec' },
      },
    },
  },
  plugins: [],
}

