/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './lib/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Jageer's "professional blues and grays" theme.
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        // App-wide brand accent lives on Tailwind's "orange" scale (every
        // `bg-orange-500` / `text-orange-600` / etc across the app resolves
        // through this one override), so a rebrand is one edit here instead
        // of touching every screen. Currently indigo, matching the reseller
        // design handoff's Primary (#4F46E5 = key 500) and Primary Dark
        // (#4338CA = key 600) exactly, since those are the two most-used
        // shades in the app for buttons/active states.
        orange: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#4F46E5',
          600: '#4338CA',
          700: '#3730A3',
          800: '#312E81',
          900: '#1E1B4B',
          950: '#14123A',
        },
      },
    },
  },
  plugins: [],
};
