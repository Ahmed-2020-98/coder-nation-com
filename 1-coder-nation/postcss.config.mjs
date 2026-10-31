// Tailwind runs through PostCSS only in the webpack build (npm run build:webpack, used on hosts where Turbopack's
// loader subprocess is killed). Dev and the default build use the Turbopack loader in next.config.ts instead.
export default {
  plugins: process.env.TAILWIND_POSTCSS ? { "@tailwindcss/postcss": {} } : {},
};
