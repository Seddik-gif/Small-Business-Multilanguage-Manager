/** @type {import('tailwindcss').Config} */
// RTL: Tailwind 3.3+ ships `rtl:`/`ltr:` variants and logical utilities (ms-*, me-*, ps-*, pe-*,
// start-*, end-*, text-start). Use those instead of ml/mr/left/right so layouts mirror automatically
// when <html dir="rtl">. No extra plugin needed.
//
// Fonts: ONE stack for every language, Inter first. A browser picks a font per character down the list,
// so Latin text and digits are always Inter (the one file always in the offline cache), and Arabic,
// Bengali or Chinese characters, including a product name typed in another script than the screen's
// language, fall through to their own font. All four faces are bundled (src/main.tsx).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Inter Variable"',
          '"Noto Sans Arabic Variable"',
          '"Noto Sans Bengali Variable"',
          '"Noto Sans SC Variable"',
          'system-ui',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
