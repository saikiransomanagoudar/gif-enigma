/** @type {import('tailwindcss').Config} */
export default {
  content: ['./game/**/*.{js,jsx,ts,tsx}', './src/**/*.{ts,tsx}', './webroot/**/*.{html,js}'],
  darkMode: 'class',
  theme: {
    extend: {
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-5px)' },
          '75%': { transform: 'translateX(5px)' },
        },
        // First, add these keyframe animations to your tailwind.config.js

        keyframes: {
          'modal-fade-in': {
            '0%': { opacity: '0', transform: 'scale(0.8)' },
            '70%': { transform: 'scale(1.05)' },
            '100%': { opacity: '1', transform: 'scale(1)' },
          },
          'float-up': {
            '0%': { transform: 'translateY(0)', opacity: '0' },
            '10%': { opacity: '1' },
            '80%': { opacity: '1' },
            '100%': { transform: 'translateY(-80px)', opacity: '0' },
          },
          'vibrate': {
            '0%': { transform: 'translateX(0)' },
            '25%': { transform: 'translateX(-8px)' },
            '50%': { transform: 'translateX(8px)' },
            '75%': { transform: 'translateX(-8px)' },
            '100%': { transform: 'translateX(0)' },
          },
        },
        animation: {
          shake: 'shake 0.5s ease-in-out',
        },
      },
      fontFamily: {
        comic: ['ComicText', 'cursive'],
      },
    },
    plugins: [],
    extend: {
      animation: {
        'bounce-slow': 'bounce 2s ease-in-out infinite',
        'modal-fade-in': 'modal-fade-in 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        'float-up': 'float-up 3s ease-out infinite',
        'vibrate': 'vibrate 0.6s cubic-bezier(.36,.07,.19,.97) both',
      },
    },
  },
};
