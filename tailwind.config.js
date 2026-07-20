/**
 * @type {import('tailwindcss').Config}
 *
 * ⚠️ Tailwind v4 does NOT load this file (there is no `@config` directive in
 * app/globals.css, and v4 does not auto-detect a JS config). Design tokens live
 * in the `@theme` blocks of app/globals.css — edit colors/spacing/etc. there.
 *
 * Brand colors (primary/secondary ramps) were moved to globals.css @theme.
 * The keyframes/animation below are kept only for reference; they are inert
 * until this file is loaded via `@config` or migrated to CSS.
 */
module.exports = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  darkMode: "class",
  plugins: [require("tailwindcss-animate")],
};
