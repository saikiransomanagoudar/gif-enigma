/** @type {import('tailwindcss').Config} */
export default {
    content: ["./game/**/*.{js,jsx,ts,tsx}"],
    darkMode: 'class',
    theme: {
      extend: {
        keyframes: {
          shake: {
            '0%, 100%': { transform: 'translateX(0)' },
            '25%': { transform: 'translateX(-5px)' },
            '75%': { transform: 'translateX(5px)' },
          },
        },
        animation: {
          shake: 'shake 0.5s ease-in-out',
        },
      },
    },
    plugins: [],
  };