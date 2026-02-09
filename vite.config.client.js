import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { resolve } from 'path';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwind()],
  root: path.join(__dirname, 'game'),
  server: {
    watch: {
      usePolling: false,
      interval: 1000,
    },
  },
  build: {
    outDir: path.join(__dirname, 'dist/client'),
    emptyOutDir: true,
    copyPublicDir: true,
    sourcemap: false,
    assetsDir: 'assets',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'],
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
    },
    base: './',
    chunkSizeWarningLimit: 500,
    cssCodeSplit: true,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'EVAL' && warning.id?.includes('@protobufjs/inquire')) {
          return;
        }
        warn(warning);
      },
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('framer-motion')) {
              return 'framer-motion';
            }
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            return 'vendor';
          }
          // Split by entry point
          if (id.includes('/game/pages/')) {
            const match = id.match(/\/pages\/(\w+)Page/);
            if (match) return `page-${match[1].toLowerCase()}`;
          }
          if (id.includes('/game/components/')) {
            return 'components';
          }
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
      input: {
        landing: resolve(__dirname, 'game', 'html', 'landing.html'),
        create: resolve(__dirname, 'game', 'html', 'create.html'),
        category: resolve(__dirname, 'game', 'html', 'category.html'),
        leaderboard: resolve(__dirname, 'game', 'html', 'leaderboard.html'),
        preview: resolve(__dirname, 'game', 'html', 'preview.html'),
        game: resolve(__dirname, 'game', 'html', 'game.html'),
        gameResults: resolve(__dirname, 'game', 'html', 'gameResults.html'),
        howToPlay: resolve(__dirname, 'game', 'html', 'howToPlay.html'),
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion'],
  },
});
