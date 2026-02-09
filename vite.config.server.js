import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';
import path from 'path';

export default defineConfig({
  ssr: {
    noExternal: true,
  },
  server: {
    watch: {
      usePolling: false,
      interval: 1000,
    },
  },
  build: {
    ssr: path.join(__dirname, 'src/server/index.ts'),
    outDir: 'dist/server',
    emptyOutDir: false,
    target: 'node22',
    sourcemap: true,
    rollupOptions: {
      external: [...builtinModules, /^node:/, '@devvit/web'],
      output: {
        format: 'cjs',
        entryFileNames: 'index.cjs',
        inlineDynamicImports: true,
      },
    },
  },
});
