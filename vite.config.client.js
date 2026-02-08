import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { resolve } from 'path';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwind()],
  root: path.join(__dirname, 'game'),
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
      },
    },
    base: './',
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'EVAL' && warning.id?.includes('@protobufjs/inquire')) {
          return;
        }
        warn(warning);
      },
      output: {
        manualChunks: {
          'framer-motion': ['framer-motion'],
          'react-vendor': ['react', 'react-dom'],
        },
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
