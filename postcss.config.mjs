/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    'postcss-preset-mantine': {},
    'tailwindcss/nesting': {},
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;